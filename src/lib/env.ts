const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const env = {
  supabaseUrl: url?.trim() || null,
  supabaseAnonKey: key?.trim() || null,
  /** Demo mode: no backend configured. Everything stays in this browser. */
  get demo() { return !this.supabaseUrl || !this.supabaseAnonKey; },
  appVersion: '1.0.0',
};
