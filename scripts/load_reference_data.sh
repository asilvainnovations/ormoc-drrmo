#!/usr/bin/env bash
# Load MODE reference data into a Supabase project in one run (ADR-034).
#
# Replaces pasting 40+ files into the Supabase SQL editor. In order, and stopping at the first error:
#   1. preflight   connect; every migration in migration_status.sql must show "applied"
#   2. cleanup     supabase/cleanup/*.sql (release cleanup scripts; each is safe to run again)
#   3. seed        supabase/seed/parts/*.sql in file-name order (01..26, 26a..26d, 27.., 37_raci, 38a-38c_eoc_assessment)
#   4. IAT update  supabase/seed/operational/07_iat_v1_7_update.sql (safe to run again; skip with --no-iat-update)
#   5. verify      every reference row in src/data/reference.json and every RACI matrix/activity in part 37
#                  and EOC capability item in part 38a is in the database
#
# Each seed file is its own transaction: a failure rolls that file back and stops the run; files
# before it stay applied, and re-running the whole script is safe (rows are upserted by fixed ids).
# The one-time operational files (baseline responses, evidence, Vault register) are NOT run here.
#
# Connection: DATABASE_URL (Supabase Dashboard -> Connect -> Session pooler, which works over IPv4),
# or the usual PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE variables for a local database.
# Runs as the database owner, like the SQL editor, so seed writes pass the app.guard_* triggers.
#
# Usage: bash scripts/load_reference_data.sh [--check-only] [--no-iat-update]
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C

CHECK_ONLY=0
IAT_UPDATE=1
for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    --no-iat-update) IAT_UPDATE=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
if [ -n "${DATABASE_URL:-}" ]; then PSQL+=(-d "$DATABASE_URL"); fi
IAT_UPDATE_FILE=supabase/seed/operational/07_iat_v1_7_update.sql
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '%s\n' "$*"; }
run_file() {  # run one SQL file; print its last result line (seed parts end with a check)
  local f="$1" start=$SECONDS
  if ! "${PSQL[@]}" -f "$f" >"$TMP/out" 2>&1; then
    say "  FAILED  $f"
    grep -E 'ERROR|DETAIL|HINT' "$TMP/out" | sed 's/^/          /' | head -6
    say "Stopped at $f. Files before it are applied; fix the cause and run again (safe to repeat)."
    printf '\n**Stopped at `%s`**\n\n```\n%s\n```\n' "$f" "$(grep -E 'ERROR|DETAIL' "$TMP/out" | head -4)" >>"$SUMMARY"
    exit 1
  fi
  say "  ok  $f ($((SECONDS - start))s)"
}

# 1. Preflight -----------------------------------------------------------------------------------
say "1. Preflight"
"${PSQL[@]}" -At -c "select 'connected to ' || current_database() || ' as ' || current_user || ', Postgres ' || current_setting('server_version')"
"${PSQL[@]}" -At -F '|' -f supabase/migrations/migration_status.sql >"$TMP/status"
missing=$(grep -E '^[0-9]{14}_' "$TMP/status" | awk -F'|' '$2 != "applied" {print $1}' || true)
if [ -n "$missing" ]; then
  say "These migrations are not applied, so the seed cannot load. Apply them first (DEPLOY.md):"
  printf '  %s\n' $missing
  printf '\n**Migrations missing:** %s\n' "$(echo $missing)" >>"$SUMMARY"
  exit 1
fi
say "  all $(grep -cE '^[0-9]{14}_' "$TMP/status") migrations applied"

# 2-4. Load --------------------------------------------------------------------------------------
if [ "$CHECK_ONLY" = 0 ]; then
  say "2. Cleanup scripts"
  shopt -s nullglob
  for f in supabase/cleanup/*.sql; do run_file "$f"; done
  say "3. Seed parts"
  n=0
  for f in supabase/seed/parts/*.sql; do run_file "$f"; n=$((n + 1)); done
  say "  $n parts loaded"
  if [ "$IAT_UPDATE" = 1 ] && [ -f "$IAT_UPDATE_FILE" ]; then
    say "4. IAT baseline update"
    run_file "$IAT_UPDATE_FILE"
  fi
else
  say "Check only: nothing is changed."
fi

# 5. Verify --------------------------------------------------------------------------------------
say "5. Verify"
python3 -I - "$TMP/verify.sql" <<'PY'
import json, sys
ref = json.load(open('src/data/reference.json'))
# reference.json key -> table. Required tables must hold every generated row; moo_versions only warns,
# because a version can legitimately be removed in the Library after loading.
tables = [('indicators', 'iat_indicators', True), ('master_requirements', 'master_requirements', True),
          ('offices', 'offices', True), ('moo_documents', 'moo_documents', True),
          ('form_templates', 'form_templates', True), ('protocol_templates', 'protocol_templates', True),
          ('protocol_steps', 'protocol_steps', True), ('aa_action_templates', 'aa_action_templates', True),
          ('moo_versions', 'moo_versions', False)]
q = lambda s: "'" + str(s).replace("'", "''") + "'"
parts = []
for key, table, required in tables:
    ids = ','.join(f'({q(r["id"])})' for r in ref[key])
    parts.append(f"select {q(table)} as tbl, {len(ref[key])} as expected, "
                 f"(select count(*) from public.{table}) as in_db, "
                 f"(select count(*) from (values {ids}) v(id) where not exists "
                 f"(select 1 from public.{table} t where t.id::text = v.id)) as missing, {str(required).lower()} as required")
# RACI board: matrix and activity ids come from seed part 37 (scripts/raci_seed.py), one row per tuple.
import re
raci = open('supabase/seed/parts/37_raci.sql', encoding='utf-8').read()
for table in ('raci_matrices', 'raci_activities'):
    block = re.search(r'insert into public\.' + table + r' \(id,[^)]*\) values\n(.*?)\non conflict', raci, re.S).group(1)
    ids = sorted(set(re.findall(r"\('([0-9a-f-]{36})'::uuid", block)))
    vals = ','.join(f'({q(i)})' for i in ids)
    parts.append(f"select {q(table)}, {len(ids)}, (select count(*) from public.{table}), "
                 f"(select count(*) from (values {vals}) v(id) where not exists "
                 f"(select 1 from public.{table} t where t.id::text = v.id)), true")
# EOC capability assessment: item ids come from seed part 38 (scripts/eoc_assessment_seed.py);
# each tuple starts with its id, and every seeded item must be in the database.
eoc = open('supabase/seed/parts/38a_eoc_assessment.sql', encoding='utf-8').read()
block = re.search(r'insert into public\.eoc_assessment_items \(id,[^)]*\) values\n(.*?)\non conflict', eoc, re.S).group(1)
ids = sorted(set(re.findall(r"\('([0-9a-f-]{36})'::uuid", block)))
vals = ','.join(f'({q(i)})' for i in ids)
parts.append(f"select 'eoc_assessment_items', {len(ids)}, (select count(*) from public.eoc_assessment_items), "
             f"(select count(*) from (values {vals}) v(id) where not exists "
             f"(select 1 from public.eoc_assessment_items t where t.id::text = v.id)), true")
open(sys.argv[1], 'w').write('\nunion all\n'.join(parts) + ';\n')
PY
"${PSQL[@]}" -At -F '|' -f "$TMP/verify.sql" >"$TMP/verify"
{
  printf '\n| table | expected | in database | missing |\n|---|---:|---:|---:|\n'
  awk -F'|' '{printf "| %s | %s | %s | %s%s |\n", $1, $2, $3, $4, ($4 > 0 && $5 == "t") ? " ⚠" : ""}' "$TMP/verify"
} >>"$SUMMARY"
awk -F'|' '{printf "  %-22s expected %5s  in db %5s  missing %s\n", $1, $2, $3, $4}' "$TMP/verify"
bad=$(awk -F'|' '$4 > 0 && $5 == "t" {print $1}' "$TMP/verify")
warn=$(awk -F'|' '$4 > 0 && $5 == "f" {print $1}' "$TMP/verify")
[ -n "$warn" ] && say "  note: some rows in $(echo $warn) are not in the database (removed in the app?)"
if [ -n "$bad" ]; then
  say "Reference data is incomplete in: $(echo $bad | sed 's/ /, /g')"
  [ "$CHECK_ONLY" = 1 ] && say "Run without --check-only to load it."
  exit 1
fi
say "Reference data is complete."
printf '\n**Reference data is complete.**\n' >>"$SUMMARY"
