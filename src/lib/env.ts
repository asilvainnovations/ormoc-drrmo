const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Supabase now issues publishable keys (sb_publishable_…); older projects have a JWT anon key.
// Either works with supabase-js. The publishable key wins when both are set.
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const env = {
  supabaseUrl: url?.trim().replace(/\/+$/, '') || null,
  supabaseAnonKey: key?.trim() || null,
  /** Demo mode: no backend configured. Everything stays in this browser. */
  get demo() { return !this.supabaseUrl || !this.supabaseAnonKey; },
  appVersion: '1.1.0',
};
