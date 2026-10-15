// Minimal stand-in for the Supabase gateway, for integration tests only.
// /rest/v1/*  -> PostgREST (real RLS, triggers and errors)
// /auth/v1/*  -> password sign-in that issues an HS256 JWT for a test user
// /storage/v1 -> accepts uploads (bucket policies are covered by the SQL suite)
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SECRET = process.env.JWT_SECRET;
const PGRST = 'http://127.0.0.1:3010';
const PASSWORD = 'integration-only';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (claims) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64(claims);
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const userByEmail = (email) => {
  const out = execFileSync('psql', ['-At', '-d', process.env.IT_DB, '-c', `select id from auth.users where email = '${email.replace(/'/g, "''")}'`]).toString().trim();
  return out || null;
};
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
  if (req.url.startsWith('/auth/v1/token')) {
    const { email, password } = JSON.parse(body.toString() || '{}');
    const id = password === PASSWORD ? userByEmail(email) : null;
    if (!id) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
    const now = Math.floor(Date.now() / 1000);
    const user = { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    return send(res, 200, { access_token: sign({ sub: id, role: 'authenticated', aud: 'authenticated', email, iat: now, exp: now + 3600 }),
      token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: crypto.randomUUID(), user });
  }
  if (req.url.startsWith('/auth/v1/user')) return send(res, 200, {});
  if (req.url.startsWith('/auth/v1/logout')) { res.writeHead(204); return res.end(); }
  if (req.url.startsWith('/storage/v1/object/')) return send(res, 200, { Key: req.url.split('/storage/v1/object/')[1] });
  if (req.url.startsWith('/rest/v1')) {
    const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
    const r = await fetch(PGRST + req.url.slice('/rest/v1'.length), { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const out = Buffer.from(await r.arrayBuffer());
    const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
    res.writeHead(r.status, { ...h, 'access-control-allow-origin': '*' }); return res.end(out);
  }
  send(res, 404, { message: 'not found' });
}).listen(54321, '127.0.0.1', () => console.log('proxy on 54321'));
