// Supabase Auth as an OAuth 2.1 / OpenID Connect provider for other City systems
// ("Sign in with Ormoc DRRM"). Supabase issues the codes and tokens; this app supplies the
// consent screen at CONSENT_PATH and lets people see and revoke the apps they allowed.
//
// Endpoints are derived from VITE_SUPABASE_URL, so a training project and the production
// project each advertise their own. For the City's production project they are:
//   authorize  https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/authorize
//   token      https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/token
//   JWKS       https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/jwks.json
//   discovery  https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/openid-configuration
import type { JWK } from '@supabase/supabase-js';
import { env } from './env';

/** Must match Authentication → OAuth Server → Authorization Path in the Supabase dashboard. */
export const CONSENT_PATH = '/oauth/consent';

export interface OAuthEndpoints { issuer: string; authorize: string; token: string; jwks: string; discovery: string }

export function oauthEndpoints(supabaseUrl: string = env.supabaseUrl): OAuthEndpoints {
  const issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  return {
    issuer,
    authorize: `${issuer}/oauth/authorize`,
    token: `${issuer}/oauth/token`,
    jwks: `${issuer}/.well-known/jwks.json`,
    discovery: `${issuer}/.well-known/openid-configuration`,
  };
}

/** Plain-language meaning of each scope Supabase Auth can grant. Unknown scopes are shown as is. */
const SCOPES: Record<string, string> = {
  openid: 'Confirm that you are signed in to Ormoc DRRM, and who you are',
  email: 'See your email address',
  profile: 'See your name',
  phone: 'See your phone number, if your account has one',
};
export const describeScopes = (scope: string | string[]) =>
  (Array.isArray(scope) ? scope : scope.split(/\s+/)).filter(Boolean)
    .map((s) => ({ scope: s, text: SCOPES[s] ?? `Access named "${s}"` }));

/**
 * A same-site path to return to after sign-in, or '/'. Refuses absolute URLs,
 * protocol-relative '//host' and backslash tricks, so a link cannot send someone elsewhere.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, 'https://app.invalid');
    if (u.origin !== 'https://app.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch { return fallback; }
}

/** The consent screen's own address for an authorization request, for the return trip after sign-in. */
export const consentReturnPath = (authorizationId: string) =>
  `${CONSENT_PATH}?authorization_id=${encodeURIComponent(authorizationId)}`;

/** Only send people on to a real web address (the app's registered redirect URI, with the code). */
export function isSafeRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname));
  } catch { return false; }
}

/** Short host name for display, e.g. "reports.ormoc.gov.ph". */
export const hostOf = (url: string | null | undefined) => {
  try { return url ? new URL(url).host : ''; } catch { return ''; }
};

// ------------------------------------------------------------------- JWKS ---
// The project's public signing keys. Cached so the stored session can be checked
// on a phone with no signal (see auth.tsx). Keys rotate rarely; refresh daily.
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedJwks { keys: JWK[]; fetchedAt: number }

export async function fetchJwks(url = oauthEndpoints().jwks, fetcher: typeof fetch = fetch): Promise<CachedJwks | null> {
  try {
    const res = await fetcher(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: JWK[] };
    return Array.isArray(body.keys) ? { keys: body.keys, fetchedAt: Date.now() } : null;
  } catch { return null; }
}

export const jwksIsStale = (c: CachedJwks | null, now = Date.now()) => !c || now - c.fetchedAt > JWKS_TTL_MS;

/** Asymmetric keys (RS256/ES256) can be checked on the device; legacy shared-secret (HS256) keys cannot. */
export const canVerifyLocally = (c: CachedJwks | null) => !!c && c.keys.some((k) => k.kty === 'RSA' || k.kty === 'EC' || k.kty === 'OKP');
