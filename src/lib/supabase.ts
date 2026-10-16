import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/** Where supabase-js keeps the session in localStorage (its default name for this project). */
export const AUTH_STORAGE_KEY = (() => {
  try { return `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`; } catch { return 'sb-auth-token'; }
})();

// main.tsx shows the configuration screen and never loads the app when env.configError is
// set, so this placeholder client is never used for requests.
export const supabase: SupabaseClient = createClient(env.configError ? 'http://localhost' : env.supabaseUrl, env.configError ? 'unconfigured' : env.supabaseAnonKey, {
  auth: {
    persistSession: true, autoRefreshToken: !env.configError, flowType: 'pkce',
    // Email links are handled by /auth/confirm (AuthCallbackPage), which understands every
    // link shape Supabase sends: token_hash, PKCE code and the older #access_token form.
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
  realtime: { params: { eventsPerSecond: 5 } },
});
