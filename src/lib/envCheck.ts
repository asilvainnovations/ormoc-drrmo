// Shared by the app (env.ts) and the build (vite.config.ts): one definition of a
// usable Supabase connection.

export interface SupabaseConfig { url: string; key: string; error: null }
export interface SupabaseConfigError { url: string; key: string; error: string }

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = typeof atob === 'function'
      ? atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
      : Buffer.from(parts[1]!, 'base64url').toString('utf8');
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch { return null; }
}

/**
 * Validate the project URL and browser key. Secret keys (sb_secret_…, or a JWT with
 * role service_role) are refused outright: they would be published in the app bundle.
 */
export function checkSupabaseConfig(rawUrl: string | undefined, rawKey: string | undefined): SupabaseConfig | SupabaseConfigError {
  const url = (rawUrl ?? '').trim().replace(/\/+$/, '');
  const key = (rawKey ?? '').trim();
  const fail = (error: string): SupabaseConfigError => ({ url, key, error });
  if (!url) return fail('VITE_SUPABASE_URL is not set.');
  if (!key) return fail('VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) is not set.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { return fail(`VITE_SUPABASE_URL "${url}" is not a web address. It looks like https://<project-ref>.supabase.co`); }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !local) return fail('VITE_SUPABASE_URL must start with https://');
  if (parsed.pathname !== '/' && parsed.pathname !== '') return fail('VITE_SUPABASE_URL must be the project address only, without /rest/v1 or any other path.');
  if (/^sb_secret_/.test(key) || jwtRole(key) === 'service_role') {
    return fail('The key is a SECRET (service role) key. Never put it in the app: use the publishable key (sb_publishable_…) or the anon key.');
  }
  if (!/^sb_publishable_/.test(key) && jwtRole(key) !== 'anon') {
    return fail('The key is not a Supabase publishable key (sb_publishable_…) or anon key.');
  }
  return { url, key, error: null };
}
