#!/usr/bin/env bash
# Score a deterministic pseudo-random cycle in PostgreSQL and save the inputs and
# the SQL results. src/domain/scoring.parity.test.ts checks the TypeScript engine
# returns exactly the same numbers (ADR-004).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=drrm_parity
scripts/db_test_reset.sh $DB >/dev/null
psql -q -v ON_ERROR_STOP=1 -d $DB << 'SQL'
insert into public.assessment_cycles (id, name, cycle_year) values ('11111111-1111-1111-1111-111111111111', 'Parity', 2026);
insert into public.responses (id, cycle_id, indicator_id)
select gen_random_uuid(), '11111111-1111-1111-1111-111111111111', i.id from public.iat_indicators i
where (abs(hashtext(i.id)) % 10) <> 0;                       -- ~10% left unanswered
insert into public.evidence (response_id, kind, strength, title)
select r.id, 'test', 'tested_improved', 'fixture' from public.responses r;
update public.responses r set
  is_na = (abs(hashtext(r.indicator_id || 'na')) % 17 = 0),
  na_justification = case when abs(hashtext(r.indicator_id || 'na')) % 17 = 0 then 'fixture' end,
  score = case when abs(hashtext(r.indicator_id || 'na')) % 17 = 0 then null else (abs(hashtext(r.indicator_id || 's')) % 5)::smallint end,
  version = r.version;
SQL
psql -At -d $DB -c "
select json_build_object(
  'responses', (select json_agg(json_build_object('indicator_id', indicator_id, 'score', score, 'is_na', is_na) order by indicator_id) from public.responses),
  'domains', (select json_agg(json_build_object('domain', domain, 'scored', scored, 'maturity_index', maturity_index, 'mandatory_compliance', mandatory_compliance, 'high_gaps', high_gaps) order by domain) from public.v_domain_results),
  'cycle', (select json_agg(json_build_object('grp', grp, 'scored', scored, 'maturity_index', maturity_index, 'mandatory_compliance', mandatory_compliance, 'high_gaps', high_gaps) order by grp) from public.v_cycle_results),
  'uuidv5', (select json_agg(json_build_object('ns', ns, 'name', nm, 'id', extensions.uuid_generate_v5(ns::uuid, nm))) from (values
     ('90000000-0000-0000-0000-000000000001','1'), ('90000000-0000-0000-0000-000000000001','12'),
     ('80000000-0000-0000-0000-000000000001', '0b2f7e3a-8f6b-5c1d-9a4e-2d3c4b5a6f70')) v(ns, nm))
)" > src/test/fixtures/scoring-parity.json
psql -q -d postgres -c "drop database $DB"
echo "fixture written: $(wc -c < src/test/fixtures/scoring-parity.json) bytes"
