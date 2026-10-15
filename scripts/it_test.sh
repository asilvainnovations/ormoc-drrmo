#!/usr/bin/env bash
# Integration tests: real supabase-js -> PostgREST 12 -> PostgreSQL with all migrations and RLS.
# Needs: PGHOST/PGPORT/PGUSER for a local superuser, and POSTGREST_BIN (PostgREST 12.x).
set -euo pipefail
cd "$(dirname "$0")/.."
export IT_DB=drrm_it
export JWT_SECRET=${JWT_SECRET:-integration-secret-at-least-32-characters-long}
scripts/db_test_reset.sh $IT_DB
psql -q -v ON_ERROR_STOP=1 -d $IT_DB -f tests/integration/fixtures.sql
cat > /tmp/pgrst-it.conf << CONF
db-uri = "postgres://authenticator:authenticator-it@/$IT_DB?host=${PGHOST}&port=${PGPORT}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3010
CONF
"${POSTGREST_BIN:-postgrest}" /tmp/pgrst-it.conf > /tmp/pgrst-it.log 2>&1 & PG_PID=$!
node tests/integration/proxy.mjs > /tmp/proxy-it.log 2>&1 & PX_PID=$!
trap 'kill $PG_PID $PX_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3010/ >/dev/null && curl -s http://127.0.0.1:54321/ >/dev/null && break; sleep 0.5; done
# anon key: a JWT with role anon, signed with the same secret
export ANON_KEY=$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'it'});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url'))")
npx vitest run --config vitest.it.config.ts
