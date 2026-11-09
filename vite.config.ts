import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { checkSupabaseConfig } from './src/lib/envCheck';

// Public, indexable paths; keep in step with PUBLIC_PATHS in src/lib/site.ts (a unit test checks).
export const SEO_PATHS = ['/', '/about', '/faq', '/support',
  '/policies/privacy', '/policies/terms', '/policies/accessibility', '/policies/cookies'];
// Workspace paths: never indexed (also sent as X-Robots-Tag in vercel.json and netlify.toml).
export const NOINDEX_PREFIXES = ['/today', '/assess', '/drrm', '/protocols', '/eoc', '/library', '/settings', '/vault', '/tools', '/login', '/auth', '/oauth'];

/** robots.txt and sitemap.xml from VITE_SITE_URL (1.10.0). Without a site URL the sitemap is left out. */
function seoFiles(siteUrl: string): Plugin {
  return {
    name: 'mode-seo-files',
    apply: 'build',
    generateBundle() {
      const base = siteUrl.replace(/\/$/, '');
      const robots = ['User-agent: *', 'Allow: /$', ...SEO_PATHS.filter((p) => p !== '/').map((p) => `Allow: ${p}`),
        ...NOINDEX_PREFIXES.map((p) => `Disallow: ${p}`), ...(base ? ['', `Sitemap: ${base}/sitemap.xml`] : [])].join('\n') + '\n';
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      if (!base) return;
      const urls = SEO_PATHS.map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc></url>`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
    },
  };
}

const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig(({ command, mode }) => {
  // A production build must point at the City's Supabase project with a browser-safe key.
  // Without this check a missing or mistyped variable ships an app that cannot sign anyone in.
  if (command === 'build' && mode === 'production' && process.env.ALLOW_UNCONFIGURED_BUILD !== '1') {
    const e = loadEnv(mode, process.cwd(), 'VITE_');
    const c = checkSupabaseConfig(e.VITE_SUPABASE_URL, e.VITE_SUPABASE_PUBLISHABLE_KEY ?? e.VITE_SUPABASE_ANON_KEY);
    if (c.error) throw new Error(`Build stopped: ${c.error} Set it in the hosting environment variables (DEPLOY.md, section 6).`);
  }
  // Keep the default in step with SITE.url in src/lib/site.ts.
  const siteUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || 'https://www.mode-cddrmo-ormoc.online';
  return {
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    seoFiles(siteUrl),
    VitePWA({
      registerType: 'prompt',            // staff choose when to reload; never mid-entry
      injectRegister: false,
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        // Keep in step with src/lib/product.ts.
        name: 'MODE: Ormoc City DRRMO & EOC Manual of Operations',
        short_name: 'MODE',
        description: 'Ormoc City DRRMO & EOC Manual of Operations Development Platform: assessment, manuals, protocols and EOC operations',
        lang: 'en-PH',
        // 1.10: the installed app opens the workspace; the public home page is for browsers and search.
        start_url: '/today',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#EEF5FB',
        theme_color: '#0F3D66',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Logbook entry', url: '/eoc/log', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Run a protocol', url: '/drrm/protocols', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // kml: the EOC placemark (ADR-015) downloads offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp,woff2,kml}'],
        // The original logo and banner files are kept for print and reuse, but are too large to
        // ship to every phone; the app uses the compressed copies in /brand.
        globIgnores: ['App_Banner.png', 'Ormoc_City_Logo.png', 'Ormoc_CDRRMO_Logo.png', 'brand/*.jpg',
          // Full-size source images never ship to phones (a 3.4 MB copy here stopped the 5 Nov build).
          'brand/*.png',
          // Latin is all the app needs; other script subsets still load on demand if ever used.
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,devanagari,math,symbols,latin-ext}-*.woff2',
          'brand/*-512.webp', 'brand/*-64.webp',
          // Manual figures load when online; the manual text itself is in the bundled reference data.
          'library/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth\//],
        // Supabase API calls are never cached by the service worker; the app keeps its own
        // offline copy in IndexedDB and syncs through an outbox (ADR-003).
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['dexie', 'dexie-react-hooks', '@supabase/supabase-js'],
          markdown: ['marked', 'dompurify'],
        },
      },
    },
  },
  server: { port: 5173 },
  };
});
