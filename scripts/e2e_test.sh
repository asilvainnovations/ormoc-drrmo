#!/usr/bin/env bash
# End-to-end tests: the production build in a real browser, against PostgREST + PostgreSQL with
# every migration and RLS policy, behind the local gateway stand-in (tests/integration/proxy.mjs).
# Each Playwright project (phone, desktop) gets a fresh database.
# Needs: PGHOST/PGPORT/PGUSER for a local superuser, POSTGREST_BIN (PostgREST 12.x), Chromium.
set -euo pipefail
cd "$(dirname "$0")/.."
export IT_DB=drrm_e2e
export JWT_SECRET=${JWT_SECRET:-integration-secret-at-least-32-characters-long}
ANON_KEY=$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'anon',iss:'e2e'});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url'))")
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=$ANON_KEY npm run build
CONF=$(mktemp)
cat > "$CONF" << CONF
db-uri = "postgres://authenticator:authenticator-it@/$IT_DB?host=${PGHOST}&port=${PGPORT}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3010
CONF
PIDS=()
trap 'kill ${PIDS[@]:-} 2>/dev/null || true' EXIT
status=0
for project in ${E2E_PROJECTS:-phone desktop}; do
  kill ${PIDS[@]:-} 2>/dev/null || true; PIDS=(); sleep 0.5
  bash scripts/db_test_reset.sh $IT_DB >/dev/null
  psql -q -v ON_ERROR_STOP=1 -d $IT_DB -f tests/e2e/fixtures.sql
  "${POSTGREST_BIN:-postgrest}" "$CONF" > /tmp/pgrst-e2e.log 2>&1 & PIDS+=($!)
  node tests/integration/proxy.mjs > /tmp/proxy-e2e.log 2>&1 & PIDS+=($!)
  for i in $(seq 1 30); do curl -sf http://127.0.0.1:3010/ >/dev/null && curl -s http://127.0.0.1:54321/ >/dev/null && break; sleep 0.5; done
  npx playwright test "$@" --project "$project" || status=$?
done
exit $status
