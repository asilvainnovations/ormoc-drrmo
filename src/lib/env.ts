// Connection settings, fixed at build time. The app always runs against the City's
// Supabase project; there is no offline demo mode (v1.2). A build without valid
// settings shows a configuration screen instead of a half-working app, and
// `vite build` refuses to produce one for production (see vite.config.ts).
import { checkSupabaseConfig } from './envCheck';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Supabase issues publishable keys (sb_publishable_…); older projects have a JWT anon key.
// Either works with supabase-js. The publishable key wins when both are set.
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const checked = checkSupabaseConfig(url, key);

/**
 * The City-hosted basemap (ADR-015): a PMTiles extract of Ormoc in the City's public `basemap` bucket.
 * VITE_BASEMAP_URL overrides it (for a City web server); it must be allowed by the CSP connect-src.
 */
const basemapOverride = (import.meta.env.VITE_BASEMAP_URL as string | undefined)?.replace(/\/$/, '');

export const env = {
  supabaseUrl: checked.url,
  supabaseAnonKey: checked.key,
  /** Why the app cannot connect, or null when the settings look right. */
  configError: checked.error,
  appVersion: '1.9.0',
  /** Folder holding ormoc.pmtiles, fonts/ and sprites/ (scripts/build_basemap.sh makes and uploads them). */
  basemapBase: basemapOverride || (checked.url ? `${checked.url}/storage/v1/object/public/basemap` : ''),
};
