#!/usr/bin/env bash
# Rebuild the local test database: Supabase stub + all migrations + seed.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/db_test_reset.sh [dbname]
set -euo pipefail
DB="${1:-drrm_test}"
cd "$(dirname "$0")/.."
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null && echo "  ok  $1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed/seed.sql
