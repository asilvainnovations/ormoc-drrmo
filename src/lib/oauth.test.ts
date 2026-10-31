import { describe, expect, it } from 'vitest';
import { canVerifyLocally, describeScopes, fetchJwks, isSafeRedirect, jwksIsStale, oauthEndpoints, safeNext } from './oauth';
import { checkTokenSignature } from './auth';
import { setMeta } from './db';

describe('OAuth endpoints', () => {
  it('derives the City project endpoints from the project URL', () => {
    const e = oauthEndpoints('https://jmctsspadywjcbbqwweh.supabase.co/');
    expect(e.authorize).toBe('https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/authorize');
    expect(e.token).toBe('https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/token');
    expect(e.jwks).toBe('https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/jwks.json');
    expect(e.discovery).toBe('https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/openid-configuration');
    expect(e.issuer).toBe('https://jmctsspadywjcbbqwweh.supabase.co/auth/v1');
  });
});

describe('safeNext', () => {
  it('keeps same-site paths with their query', () => {
    expect(safeNext('/oauth/consent?authorization_id=abc')).toBe('/oauth/consent?authorization_id=abc');
    expect(safeNext('/eoc/logbook')).toBe('/eoc/logbook');
  });
  it('refuses anything that could leave the site', () => {
    for (const bad of ['//evil.example', 'https://evil.example/x', '/\\evil.example', 'javascript:alert(1)', '', null, undefined, 'eoc']) {
      expect(safeNext(bad as string)).toBe('/');
    }
  });
});

describe('redirects and scopes', () => {
  it('only follows https (or localhost) return addresses', () => {
    expect(isSafeRedirect('https://reports.example.gov.ph/cb?code=1')).toBe(true);
    expect(isSafeRedirect('http://localhost:3000/cb')).toBe(true);
    expect(isSafeRedirect('http://reports.example.gov.ph/cb')).toBe(false);
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
  });
  it('explains scopes in plain words, including unknown ones', () => {
    expect(describeScopes('openid email  custom').map((s) => s.scope)).toEqual(['openid', 'email', 'custom']);
    expect(describeScopes(['profile'])[0]!.text).toMatch(/name/);
  });
});

// A real RS256 key pair, so the JWKS signature check runs end to end with no network.
const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');
async function keyAndToken(kid: string) {
  const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const pair = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256', use: 'sig' };
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })));
  const body = b64url(enc.encode(JSON.stringify({ sub: 'u1', role: 'authenticated', exp: 1, iat: 0 })));
  const sig = await crypto.subtle.sign(alg, pair.privateKey, enc.encode(`${head}.${body}`));
  return { jwk, token: `${head}.${body}.${b64url(sig)}` };
}

describe('JWKS signature check (works offline)', () => {
  it('accepts a token signed by the cached key, even when expired', async () => {
    const { jwk, token } = await keyAndToken('k1');
    await setMeta('jwks', { keys: [jwk], fetchedAt: Date.now() });
    expect(await checkTokenSignature(token)).toBe('valid');
  });
  it('rejects a token whose signature was altered', async () => {
    const { jwk, token } = await keyAndToken('k2');
    await setMeta('jwks', { keys: [jwk], fetchedAt: Date.now() });
    const [h, p] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'someone-else', exp: 9e9 })).toString('base64url')}.${token.split('.')[2]}`;
    expect(p).toBeTruthy();
    expect(await checkTokenSignature(forged)).toBe('invalid');
  });
  it('says unknown when the project still uses shared-secret keys', async () => {
    await setMeta('jwks', { keys: [{ kty: 'oct', kid: 'x' }], fetchedAt: Date.now() });
    expect(await checkTokenSignature('a.b.c')).toBe('unknown');
    expect(canVerifyLocally({ keys: [{ kty: 'oct' }], fetchedAt: 0 } as never)).toBe(false);
  });
  it('fetches and ages the key set', async () => {
    const fake = (async () => new Response(JSON.stringify({ keys: [{ kty: 'EC', kid: 'e' }] }), { status: 200 })) as typeof fetch;
    const got = await fetchJwks('https://x.supabase.co/auth/v1/.well-known/jwks.json', fake);
    expect(got?.keys).toHaveLength(1);
    expect(jwksIsStale(got, Date.now())).toBe(false);
    expect(jwksIsStale(got, Date.now() + 25 * 3600_000)).toBe(true);
    const down = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await fetchJwks('https://x', down)).toBeNull();
  });
});
