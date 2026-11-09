// Minimal stand-in for the Supabase gateway, for integration and end-to-end tests only.
// /rest/v1/*  -> PostgREST (real RLS, triggers and errors)
// /auth/v1/*  -> a small GoTrue stand-in (1.11.0): password sign-in, sign-up with email confirmation,
//                password recovery, one-time links (verify), resend, password change and the current user.
//                Mail is not sent: links are kept in memory and read by tests at /__mail?email=…
// /storage/v1 -> accepts uploads (bucket policies are covered by the SQL suite)
// Accounts from the fixtures sign in with PASSWORD; accounts made by sign-up keep the password they chose.
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SECRET = process.env.JWT_SECRET;
const PGRST = 'http://127.0.0.1:3010';
const PASSWORD = 'integration-only';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (claims) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64(claims);
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const verifyJwt = (token) => {
  const [h, p, s] = (token ?? '').split('.');
  if (!h || !p || !s) return null;
  const good = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (good !== s) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  return claims.exp > Date.now() / 1000 ? claims : null;
};
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const psql = (sql) => execFileSync('psql', ['-At', '-v', 'ON_ERROR_STOP=1', '-d', process.env.IT_DB, '-c', sql]).toString().trim();
const userByEmail = (email) => psql(`select id from auth.users where lower(email) = lower(${lit(email)})`) || null;
const isConfirmed = (id) => psql(`select email_confirmed_at is not null from auth.users where id = ${lit(id)}`) === 't';

const passwords = new Map();   // user id -> password (sign-up and reset); fixtures fall back to PASSWORD
const tokens = new Map();      // token_hash -> { id, email, type, exp }
const mail = new Map();        // email -> last { type, token_hash }
const refresh = new Map();     // refresh token -> user id

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
const fail = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });
const userJson = (id, email) => ({ id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: isConfirmed(id) ? new Date().toISOString() : null,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ id, user_id: id, provider: 'email', identity_data: { email } }],
  created_at: new Date().toISOString() });
const session = (id, email) => {
  const now = Math.floor(Date.now() / 1000);
  const rt = crypto.randomUUID();
  refresh.set(rt, id);
  psql(`update auth.users set last_sign_in_at = now() where id = ${lit(id)}`);
  return { access_token: sign({ sub: id, role: 'authenticated', aud: 'authenticated', email, iat: now, exp: now + 3600 }),
    token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userJson(id, email) };
};
const issueLink = (id, email, type) => {
  const token_hash = crypto.randomBytes(24).toString('hex');
  tokens.set(token_hash, { id, email, type, exp: Date.now() + 3600_000 });
  mail.set(email.toLowerCase(), { type, token_hash });
};
const bearer = (req) => verifyJwt((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const json = () => { try { return JSON.parse(body.toString() || '{}'); } catch { return {}; } };
  const url = new URL(req.url, 'http://gateway');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }

  // ---- test mailbox
  if (url.pathname === '/__mail') {
    const m = mail.get((url.searchParams.get('email') ?? '').toLowerCase());
    return m ? send(res, 200, m) : send(res, 404, { message: 'no mail' });
  }

  // ---- auth
  if (url.pathname === '/auth/v1/token') {
    const b = json();
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const id = refresh.get(b.refresh_token);
      if (!id) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      refresh.delete(b.refresh_token);
      return send(res, 200, session(id, psql(`select email from auth.users where id = ${lit(id)}`)));
    }
    const id = userByEmail(b.email ?? '');
    if (!id || b.password !== (passwords.get(id) ?? PASSWORD)) return fail(res, 400, 'invalid_credentials', 'Invalid login credentials');
    if (!isConfirmed(id)) return fail(res, 400, 'email_not_confirmed', 'Email not confirmed');
    return send(res, 200, session(id, b.email));
  }
  if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
    const b = json();
    const email = String(b.email ?? '').trim();
    if (!email || !b.password) return fail(res, 422, 'validation_failed', 'Email and password are required');
    let id = userByEmail(email);
    if (!id) {   // a new account; the profile trigger copies full_name and position from the metadata
      id = crypto.randomUUID();
      psql(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values (${lit(id)}, ${lit(email)}, ${lit(JSON.stringify(b.data ?? {}))}::jsonb, null)`);
      passwords.set(id, b.password);
      issueLink(id, email, 'signup');
    }
    // Same answer for an existing address (Supabase sends no second email and does not say the address exists).
    return send(res, 200, { ...userJson(id, email), confirmation_sent_at: new Date().toISOString() });
  }
  if (url.pathname === '/auth/v1/resend' && req.method === 'POST') {
    const b = json(); const id = userByEmail(b.email ?? '');
    if (id && !isConfirmed(id)) issueLink(id, b.email, 'signup');
    return send(res, 200, {});
  }
  if (url.pathname === '/auth/v1/recover' && req.method === 'POST') {
    const b = json(); const id = userByEmail(b.email ?? '');
    if (id) issueLink(id, b.email, 'recovery');
    return send(res, 200, {});
  }
  if (url.pathname === '/auth/v1/otp' && req.method === 'POST') {   // magic link for an existing account
    const b = json(); const id = userByEmail(b.email ?? '');
    if (id) issueLink(id, b.email, 'magiclink');
    return send(res, 200, {});
  }
  if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
    const b = json();
    const t = tokens.get(b.token_hash);
    if (!t || t.exp < Date.now() || (b.type && t.type !== b.type && !(b.type === 'email' && t.type !== 'recovery'))) {
      return fail(res, 403, 'otp_expired', 'Email link is invalid or has expired');
    }
    tokens.delete(b.token_hash);   // one use only
    if (t.type === 'signup') psql(`update auth.users set email_confirmed_at = now() where id = ${lit(t.id)}`);
    return send(res, 200, session(t.id, t.email));
  }
  if (url.pathname === '/auth/v1/user') {
    const c = bearer(req);
    if (!c) return fail(res, 401, 'bad_jwt', 'invalid JWT');
    if (req.method === 'PUT') {
      const b = json();
      if (b.password) passwords.set(c.sub, b.password);
    }
    return send(res, 200, userJson(c.sub, c.email));
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204, { 'access-control-allow-origin': '*' }); return res.end(); }

  // ---- storage and REST
  if (url.pathname.startsWith('/storage/v1/object/')) return send(res, 200, { Key: req.url.split('/storage/v1/object/')[1] });
  if (url.pathname.startsWith('/rest/v1')) {
    const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
    const r = await fetch(PGRST + req.url.slice('/rest/v1'.length), { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const out = Buffer.from(await r.arrayBuffer());
    const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
    res.writeHead(r.status, { ...h, 'access-control-allow-origin': '*' }); return res.end(out);
  }
  send(res, 404, { message: 'not found' });
}).listen(54321, '127.0.0.1', () => console.log('proxy on 54321'));
