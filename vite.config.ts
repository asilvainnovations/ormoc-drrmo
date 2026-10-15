import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',            // staff choose when to reload; never mid-entry
      injectRegister: false,
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Ormoc City DRRM and Emergency Operations',
        short_name: 'DRRM Ops',
        description: 'CDRRMO and EOC operations, assessment and manuals for the City of Ormoc',
        lang: 'en-PH',
        start_url: '/',
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
          { name: 'Run a protocol', url: '/protocols', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // The original logo and banner files are kept for print and reuse, but are too large to
        // ship to every phone; the app uses the compressed copies in /brand.
        globIgnores: ['App_Banner.png', 'Ormoc_City_Logo.png', 'Ormoc_CDRRMO_Logo.png', 'brand/*.jpg',
          // Latin is all the app needs; other script subsets still load on demand if ever used.
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,devanagari,math,symbols,latin-ext}-*.woff2',
          'brand/*-512.webp', 'brand/*-64.webp'],
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
    sourcemap: true,
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
});
