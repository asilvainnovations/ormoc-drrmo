#!/usr/bin/env bash
# Bring a Supabase database up to this release in one command (ADR-034).
#
#   export SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
#   scripts/apply_db.sh                  # missing migrations, then cleanup + seed parts + IAT update + verify
#   scripts/apply_db.sh --operational    # also the one-time operational seeds (a NEW database only)
#   scripts/apply_db.sh --check-only     # change nothing: show migration status and what reference data is missing
#   scripts/apply_db.sh --no-migrations  # reference data only (the "Load reference data" workflow's default)
#   scripts/apply_db.sh --no-iat-update  # skip operational/07_iat_v1_7_update.sql
#
# Connection: SUPABASE_DB_URL from the environment, or a SUPABASE_DB_URL= line in .env (git-ignored; the
# file is read, never executed). Use the Session pooler string (Dashboard -> Connect -> Session pooler,
# port 5432): it works over IPv4 and is free. The direct string (db.<ref>.supabase.co) is IPv6-only on the
# Free plan, and the transaction pooler (port 6543) is refused here: it is not suitable for migrations.
#
# Migrations: only the ones migration_status.sql reports as missing are run, in file order. Not every
# migration is safe to run twice (the first creates the app_role type), so applied ones are never re-run.
# Each applied migration is then recorded in supabase_migrations.schema_migrations, the history the
# Supabase GitHub integration reads, so the two never try to apply the same migration.
# Reference data: scripts/load_reference_data.sh (cleanup scripts, every seed part, IAT update, verify).
# Never runs supabase/tests/ (the local test stub must never touch a Supabase project).
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C

OPERATIONAL=0; MIGRATIONS=1; CHECK_ONLY=0; LOADER_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --operational) OPERATIONAL=1 ;;
    --no-migrations) MIGRATIONS=0 ;;
    --check-only) CHECK_ONLY=1; LOADER_ARGS+=(--check-only) ;;
    --no-iat-update) LOADER_ARGS+=(--no-iat-update) ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

# Connection string ---------------------------------------------------------------------------------
if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f .env ]; then
  line=$(grep -E '^[[:space:]]*(export[[:space:]]+)?SUPABASE_DB_URL=' .env | tail -1 || true)
  SUPABASE_DB_URL=$(printf '%s' "${line#*=}" | sed -E "s/^[[:space:]]*['\"]?//; s/['\"]?[[:space:]]*$//")
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Copy the Session pooler string from Supabase Dashboard -> Connect" >&2
  echo "-> Session pooler (port 5432), fill in the password, and export it or put it in .env." >&2
  exit 2
fi
case "$SUPABASE_DB_URL" in
  *'[YOUR-PASSWORD]'*|*'<password>'*)
    echo "SUPABASE_DB_URL still has the password placeholder; put the database password in its place." >&2; exit 2 ;;
  *:6543/*|*:6543)
    echo "That is the transaction pooler (port 6543), which is not suitable for migrations." >&2
    echo "Use the Session pooler string instead: Supabase Dashboard -> Connect -> Session pooler (port 5432)." >&2
    exit 2 ;;
  *@db.*.supabase.co*)
    echo "Note: the direct string (db.<ref>.supabase.co) is IPv6-only on the Free plan. If the connection" >&2
    echo "fails, use the Session pooler string (Dashboard -> Connect -> Session pooler)." >&2 ;;
esac
export DATABASE_URL="$SUPABASE_DB_URL"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DATABASE_URL")

# Migrations ----------------------------------------------------------------------------------------
migration_files() { ls supabase/migrations/[0-9]*_*.sql; }
status() {  # prints "<version_name>|applied|missing" lines; a database with no app schema is new
  if [ "$("${PSQL[@]}" -At -c "select to_regnamespace('app') is null")" = t ]; then
    for f in $(migration_files); do b=$(basename "$f" .sql); echo "$b|missing"; done
  else
    "${PSQL[@]}" -At -F '|' -f supabase/migrations/migration_status.sql | grep -E '^[0-9]{14}_'
  fi
}

echo "Migrations"
"${PSQL[@]}" -At -c "select '  connected to ' || current_database() || ' as ' || current_user"
missing=$(status | awk -F'|' '$2 != "applied" {print $1}')
if [ "$MIGRATIONS" = 1 ] && [ "$CHECK_ONLY" = 0 ] && [ -n "$missing" ]; then
  for name in $missing; do
    f="supabase/migrations/$name.sql"
    [ -f "$f" ] || { echo "  migration_status.sql names $name but $f does not exist" >&2; exit 1; }
    start=$SECONDS
    if ! "${PSQL[@]}" -f "$f" >/tmp/apply_db.$$ 2>&1; then
      echo "  FAILED  $f"; grep -E 'ERROR|DETAIL|HINT' /tmp/apply_db.$$ | sed 's/^/          /' | head -6
      rm -f /tmp/apply_db.$$; exit 1
    fi
    rm -f /tmp/apply_db.$$
    echo "  applied  $name ($((SECONDS - start))s)"
  done
elif [ -n "$missing" ]; then
  echo "  not applied (this run does not apply migrations):"; printf '    %s\n' $missing
fi

# Record every applied migration in the history the Supabase GitHub integration reads.
applied=$(status | awk -F'|' '$2 == "applied" {print $1}')
if [ "$CHECK_ONLY" = 0 ] && [ -n "$applied" ]; then
  values=$(for name in $applied; do printf "('%s','%s')," "${name%%_*}" "${name#*_}"; done)
  "${PSQL[@]}" <<SQL
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
insert into supabase_migrations.schema_migrations (version, name) values ${values%,}
on conflict (version) do nothing;
SQL
fi
total=$(migration_files | wc -l | tr -d ' ')
n_applied=$(printf '%s\n' $applied | grep -c . || true)
echo "  migration status: $n_applied of $total applied"
status | awk -F'|' '{printf "    %-48s %s\n", $1, $2}'
if [ "$n_applied" != "$total" ]; then
  echo "  Not every migration is applied, so reference data cannot load. Run without --check-only/--no-migrations."
  exit 1
fi

# Reference data --------------------------------------------------------------------------------------
echo
# With --operational the IAT update runs after the baseline it updates (operational 01..07 below).
[ "$OPERATIONAL" = 1 ] && [ "$CHECK_ONLY" = 0 ] && LOADER_ARGS+=(--no-iat-update)
bash scripts/load_reference_data.sh "${LOADER_ARGS[@]+"${LOADER_ARGS[@]}"}"

# One-time operational seeds (new database) -----------------------------------------------------------
if [ "$OPERATIONAL" = 1 ] && [ "$CHECK_ONLY" = 0 ]; then
  echo
  echo "Operational seeds (one-time; for a new database)"
  for f in supabase/seed/operational/*.sql; do   # in order: baseline 01-06, then the 07 IAT update
    "${PSQL[@]}" -f "$f" >/dev/null || { echo "  FAILED  $f"; exit 1; }
    echo "  ok  $f"
  done
fi
