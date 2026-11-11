#!/usr/bin/env bash
# Read-only check of a live MODE database (audit 11 Nov 2026).
#
# Usage (from a City ICT computer with psql 15+ installed):
#   export DATABASE_URL='postgresql://postgres.<project-ref>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
#   export PGPASSWORD='...'          # type it in the shell; never save it in a file or in the repo
#   bash scripts/live_audit.sh [output-file]
#
# Use the SESSION POOLER string (port 5432) from Project Settings -> Database -> Connect. It works
# on IPv4 networks; the direct connection needs IPv6, and the transaction pooler (port 6543) is
# for serverless functions, which MODE does not have (ADR-001).
#
# The session is forced read-only, so this script cannot change data even by mistake. It runs
# migration_status.sql, then supabase/admin/live_audit.sql, and writes the result to a file to
# keep with the audit record.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL to the session pooler connection string (see the top of this script)." >&2
  exit 2
fi
case "$DATABASE_URL" in
  *:6543/*) echo "That is the transaction pooler (port 6543). Use the session pooler (port 5432)." >&2; exit 2 ;;
  *'[YOUR-PASSWORD]'*) echo "Remove [YOUR-PASSWORD] from DATABASE_URL and set PGPASSWORD instead." >&2; exit 2 ;;
esac

OUT="${1:-live_audit_$(date +%Y%m%d_%H%M).txt}"
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000'
export PGAPPNAME='mode-live-audit'

{
  echo "MODE live audit, $(date '+%d %b %Y, %H:%M %Z'), repo $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo
  echo "== Migrations (supabase/migrations/migration_status.sql)"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=0 -P pager=off -f supabase/migrations/migration_status.sql
  echo
  echo "== Readiness checks (supabase/admin/live_audit.sql)"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=0 -P pager=off -f supabase/admin/live_audit.sql
} 2>&1 | tee "$OUT"

echo
echo "Saved to $OUT. It holds counts and settings only; share it with the developer and keep it with the audit record."
