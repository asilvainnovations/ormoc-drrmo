#!/usr/bin/env bash
# Rebuild the local test database and run the rule/security suite.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/db_test_reset.sh "${1:-drrm_test}"
psql -q -v ON_ERROR_STOP=1 -d "${1:-drrm_test}" -f supabase/tests/10_rules_and_security.sql
