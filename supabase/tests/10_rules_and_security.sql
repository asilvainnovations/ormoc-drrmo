-- =============================================================================
-- Rule and security tests. Run after the stub, migrations and seed:
--   scripts/db_test.sh
-- Every check acts as a signed-in user (role "authenticated"), so RLS applies.
-- The script stops at the first failure (ON_ERROR_STOP) and prints a summary.
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null

create schema tests;
grant usage on schema tests to authenticated;

create table tests.results (n serial, name text, ok boolean);
grant insert, select on tests.results to authenticated;
grant usage on sequence tests.results_n_seq to authenticated;

-- 1.9.0: a complete, valid answer for a form's fields (the first option, today's date, 1, true ...).
create or replace function tests.sample_form(p_schema jsonb) returns jsonb language sql immutable as $f$
  select coalesce(jsonb_object_agg(f ->> 'key',
    case f ->> 'type'
      when 'number' then to_jsonb(1) when 'integer' then to_jsonb(1)
      when 'checkbox' then to_jsonb(true)
      when 'date' then to_jsonb('2026-11-06'::text) when 'datetime' then to_jsonb('2026-11-06T08:00'::text)
      when 'time' then to_jsonb('08:00'::text)
      when 'select' then f -> 'options' -> 0
      when 'multiselect' then jsonb_build_array(f -> 'options' -> 0)
      else to_jsonb('sample'::text) end), '{}'::jsonb)
  from jsonb_array_elements(p_schema -> 'fields') f
$f$;
grant execute on function tests.sample_form(jsonb) to authenticated;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('role', 'authenticated', false);
end $$;

create function tests.pass(p_name text) returns void language plpgsql as $$
begin insert into tests.results(name, ok) values (p_name, true); end $$;

create function tests.expect_error(p_name text, p_sql text, p_state text) returns void language plpgsql as $$
declare v_failed boolean := false; v_state text; v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true; v_state := sqlstate; v_msg := sqlerrm;
  end;
  if not v_failed then
    raise exception 'FAIL [%]: expected error %, statement succeeded', p_name, p_state;
  elsif v_state <> p_state then
    raise exception 'FAIL [%]: expected error %, got % (%)', p_name, p_state, v_state, v_msg;
  end if;
  perform tests.pass(p_name);
end $$;

create function tests.expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then raise exception 'FAIL [%]: % (%)', p_name, sqlerrm, sqlstate; end;
  perform tests.pass(p_name);
end $$;

create function tests.expect_rows(p_name text, p_sql text, p_expected bigint) returns void language plpgsql as $$
declare v bigint;
begin
  execute p_sql into v;
  if v is distinct from p_expected then
    raise exception 'FAIL [%]: expected %, got %', p_name, p_expected, v;
  end if;
  perform tests.pass(p_name);
end $$;

create function tests.expect_eq(p_name text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL [%]: expected %, got %', p_name, p_expected, p_actual;
  end if;
  perform tests.pass(p_name);
end $$;
grant execute on all functions in schema tests to authenticated;

-- ------------------------------------------------------------- fixtures -----
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'admin@test.local',     '{"full_name":"Admin"}'),
 ('00000000-0000-0000-0000-00000000000b', 'assessor@test.local',  '{"full_name":"Assessor"}'),
 ('00000000-0000-0000-0000-00000000000c', 'validator@test.local', '{"full_name":"Validator"}'),
 ('00000000-0000-0000-0000-00000000000d', 'eocmgr@test.local',    '{"full_name":"EOC Manager"}'),
 ('00000000-0000-0000-0000-00000000000e', 'duty@test.local',      '{"full_name":"Duty Officer"}'),
 ('00000000-0000-0000-0000-00000000000f', 'cpdo@test.local',      '{"full_name":"CPDO focal"}'),
 ('00000000-0000-0000-0000-000000000010', 'viewer@test.local',    '{"full_name":"Viewer"}'),
 ('00000000-0000-0000-0000-000000000011', 'head@test.local',      '{"full_name":"CDRRMO Head"}'),
 ('00000000-0000-0000-0000-000000000012', 'author@test.local',    '{"full_name":"Author"}'),
 ('00000000-0000-0000-0000-000000000013', 'staff@test.local',     '{"full_name":"EOC Staff"}');
update public.profiles set office_id = (select id from public.offices where code = 'CPDO')
 where id = '00000000-0000-0000-0000-00000000000f';
insert into public.user_roles (user_id, role) values
 ('00000000-0000-0000-0000-00000000000a','admin'),
 ('00000000-0000-0000-0000-00000000000b','assessor'),
 ('00000000-0000-0000-0000-00000000000c','validator'),
 ('00000000-0000-0000-0000-00000000000d','eoc_manager'),
 ('00000000-0000-0000-0000-00000000000e','duty_officer'),
 ('00000000-0000-0000-0000-00000000000f','lead_office_focal'),
 ('00000000-0000-0000-0000-000000000010','viewer'),
 ('00000000-0000-0000-0000-000000000011','cdrrmo_head'),
 ('00000000-0000-0000-0000-000000000012','author'),
 ('00000000-0000-0000-0000-000000000013','eoc_staff');

-- =============================================================== IAT =========
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
insert into public.assessment_cycles (id, name, cycle_year) values ('10000000-0000-0000-0000-000000000001', 'Baseline 2026', 2026);
insert into public.responses (id, cycle_id, indicator_id) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A1.1');

select tests.expect_error('score 3 without evidence is refused',
  $$update public.responses set score = 3, version = 1 where id = '20000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_ok('interview evidence recorded',
  $$insert into public.evidence (id, response_id, kind, strength, title, source)
    values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','interview','verbal','KII CDRRMO Head','CDRRMO Head')$$);
select tests.expect_error('interviews alone cannot support 3',
  $$update public.responses set score = 3, version = 1 where id = '20000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_ok('interviews support 2',
  $$update public.responses set score = 2, version = 1 where id = '20000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('an interview cannot be labelled as approved evidence',
  $$insert into public.evidence (response_id, kind, strength, title) values ('20000000-0000-0000-0000-000000000001','interview','approved_in_use','x')$$, '23514');
select tests.expect_ok('approved document in use recorded',
  $$insert into public.evidence (id, response_id, kind, strength, title, doc_date)
    values ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','document','approved_in_use','EO creating the CDRRMO','2019-02-01')$$);
select tests.expect_error('stale version is a conflict',
  $$update public.responses set score = 3, version = 1 where id = '20000000-0000-0000-0000-000000000001'$$, 'PT409');
select tests.expect_ok('approved document supports 3',
  $$update public.responses set score = 3, version = 2 where id = '20000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('approved document cannot support 4',
  $$update public.responses set score = 4, version = 3 where id = '20000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_error('removing the evidence a score depends on is refused',
  $$set constraints all immediate; delete from public.evidence where id = '30000000-0000-0000-0000-000000000002'$$, '23514');
select tests.expect_error('assessor cannot validate',
  $$update public.responses set status = 'validated', version = 3 where id = '20000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_rows('score history kept', $$select count(*) from public.response_history where response_id = '20000000-0000-0000-0000-000000000001'$$, 3);

select tests.login('00000000-0000-0000-0000-00000000000c');  -- validator
select tests.expect_ok('validator validates',
  $$update public.responses set status = 'validated', version = 3 where id = '20000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('validated_by stamped',
  (select validated_by::text from public.responses where id = '20000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000c');

select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_error('validated score is locked to validators',
  $$update public.responses set score = 2, version = 4 where id = '20000000-0000-0000-0000-000000000001'$$, '42501');

-- Part C: a lead-office focal person answers only their office's indicators.
select tests.login('00000000-0000-0000-0000-00000000000f');  -- CPDO focal
select tests.expect_ok('CPDO answers C1.1',
  $$insert into public.responses (cycle_id, indicator_id, gap_remarks) values ('10000000-0000-0000-0000-000000000001','C1.1','CDP references CDRA')$$);
select tests.expect_error('CPDO cannot answer C2.1 (Building Official)',
  $$insert into public.responses (cycle_id, indicator_id) values ('10000000-0000-0000-0000-000000000001','C2.1')$$, '42501');
select tests.expect_error('CPDO cannot answer Part A',
  $$insert into public.responses (cycle_id, indicator_id) values ('10000000-0000-0000-0000-000000000001','A1.2')$$, '42501');

-- Evidence validation status (IAT v1-6 column V; 1.13.0).
select tests.expect_eq('a new response starts with its evidence pending validation',
  (select evidence_check from public.responses where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'), 'pending');
select tests.expect_ok('CPDO still edits its own C1.1 notes',
  $$update public.responses set gap_remarks = 'CDP and CLUP reference the CDRA', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$);
select tests.expect_error('a lead office cannot verify its own evidence',
  $$update public.responses set evidence_check = 'verified', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_ok('the assessor records the evidence check',
  $$update public.responses set evidence_check = 'partially_verified', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$);
select tests.expect_eq('the server stamps who checked the evidence',
  (select evidence_checked_by::text from public.responses where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'),
  '00000000-0000-0000-0000-00000000000b');
select tests.expect_ok('a device cannot rewrite who checked the evidence',
  $$update public.responses set gap_remarks = 'checked', evidence_checked_by = '00000000-0000-0000-0000-000000000010',
       evidence_checked_at = '2020-01-01', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$);
select tests.expect_eq('the stamp survives a device edit',
  (select evidence_checked_by::text || '|' || (evidence_checked_at > now() - interval '1 hour')::text from public.responses
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'),
  '00000000-0000-0000-0000-00000000000b|true');
select tests.expect_error('an unknown evidence status is refused',
  $$update public.responses set evidence_check = 'approved', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$, '23514');
select tests.expect_ok('the check can be set back to pending',
  $$update public.responses set evidence_check = 'pending', version = version
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'$$);
select tests.expect_eq('pending clears the stamps',
  (select coalesce(evidence_checked_by::text, 'none') || '|' || coalesce(evidence_checked_at::text, 'none') from public.responses
    where cycle_id = '10000000-0000-0000-0000-000000000001' and indicator_id = 'C1.1'), 'none|none');
select tests.expect_error('a validated response keeps its evidence check locked to validators',
  $$update public.responses set evidence_check = 'missing', version = version where id = '20000000-0000-0000-0000-000000000001'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000f');  -- back to the CPDO focal for the next checks

select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_error('viewer cannot score',
  $$insert into public.responses (cycle_id, indicator_id) values ('10000000-0000-0000-0000-000000000001','A1.3')$$, '42501');
select tests.expect_rows('viewer cannot read the audit log', $$select count(*) from public.audit_log$$, 0);

-- Scoring results: build a known set and check the computed indices.
reset role;
insert into public.assessment_cycles (id, name, cycle_year) values ('10000000-0000-0000-0000-000000000002', 'Scoring fixture', 2026);
-- A1 (8 indicators): give each an approved/tested evidence row and a score.
with s(ind, score) as (values ('A1.1',4),('A1.2',3),('A1.3',2),('A1.4',1),('A1.5',0),('A1.6',3),('A1.7',2))
insert into public.responses (id, cycle_id, indicator_id) select gen_random_uuid(), '10000000-0000-0000-0000-000000000002', ind from s;
insert into public.evidence (response_id, kind, strength, title)
select r.id, 'test', 'tested_improved', 'fixture' from public.responses r where r.cycle_id = '10000000-0000-0000-0000-000000000002';
update public.responses r set score = s.score, version = r.version
from (values ('A1.1',4),('A1.2',3),('A1.3',2),('A1.4',1),('A1.5',0),('A1.6',3),('A1.7',2)) s(ind, score)
where r.cycle_id = '10000000-0000-0000-0000-000000000002' and r.indicator_id = s.ind;
insert into public.responses (cycle_id, indicator_id, is_na, na_justification)
values ('10000000-0000-0000-0000-000000000002','A1.8','true','No State of Imminent Disaster expected in fixture');

select tests.login('00000000-0000-0000-0000-000000000010');  -- results readable by viewer
-- Expected, from the IAT formula with v1.1 weights and types (computed independently below)
select tests.expect_eq('domain bands use the unrounded index (1.13.0)',
  (select count(*)::text from public.v_domain_results dr
    where dr.maturity_band is distinct from (
      select public.maturity_band(sum(rr.score * rr.weight)::numeric / nullif(sum(rr.weight), 0))
      from public.v_response_results rr join public.iat_indicators i on i.id = rr.indicator_id
      where rr.cycle_id = dr.cycle_id and i.domain = dr.domain and rr.is_scored = 1)), '0');
select tests.expect_eq('A1 maturity index',
  (select maturity_index::text from public.v_domain_results where cycle_id = '10000000-0000-0000-0000-000000000002' and domain = 'A1'),
  (select round(sum(s.score * i.weight)::numeric / sum(i.weight), 2)::text
     from (values ('A1.1',4),('A1.2',3),('A1.3',2),('A1.4',1),('A1.5',0),('A1.6',3),('A1.7',2)) s(ind, score)
     join public.iat_indicators i on i.id = s.ind));
select tests.expect_eq('A1 scored excludes NA', (select scored::text from public.v_domain_results
  where cycle_id = '10000000-0000-0000-0000-000000000002' and domain = 'A1'), '7');
select tests.expect_eq('A1 mandatory compliance',
  (select mandatory_compliance::text from public.v_domain_results where cycle_id = '10000000-0000-0000-0000-000000000002' and domain = 'A1'),
  (select round(count(*) filter (where s.score >= 3)::numeric / count(*), 4)::text
     from (values ('A1.1',4),('A1.2',3),('A1.3',2),('A1.4',1),('A1.5',0),('A1.6',3),('A1.7',2)) s(ind, score)
     join public.iat_indicators i on i.id = s.ind where i.type = 'M'));
select tests.expect_eq('a score of 4 leaves no gap',
  (select gap_priority_score::text || ' ' || priority from public.v_response_results rr
     join public.iat_indicators i on i.id = rr.indicator_id
    where rr.cycle_id = '10000000-0000-0000-0000-000000000002' and rr.indicator_id = 'A1.1'), '0.0 Low');
select tests.expect_eq('priority band function', public.priority_band(9) || ',' || public.priority_band(8.9) || ',' || public.priority_band(3.9), 'High,Medium,Low');
select tests.expect_eq('maturity band edges',
  public.maturity_band(0.49) || ',' || public.maturity_band(0.5) || ',' || public.maturity_band(2.49) || ',' || public.maturity_band(2.5) || ',' || public.maturity_band(3.5),
  'Absent,Initial,Developing,Compliant,Advanced');
select tests.expect_eq('Part C uses the GP factor', public.gap_priority_score(1::smallint, 3::smallint, 'GP', 'C')::text, '9.0');
select tests.expect_eq('Mandatory uses the 1.5 factor', public.gap_priority_score(2::smallint, 3::smallint, 'M', 'A')::text, '9.0');
select tests.expect_eq('IMI equals Part A when only Part A is scored',
  (select maturity_index::text from public.v_cycle_results where cycle_id = '10000000-0000-0000-0000-000000000002' and grp = 'IMI'),
  (select maturity_index::text from public.v_cycle_results where cycle_id = '10000000-0000-0000-0000-000000000002' and grp = 'A'));

-- Closed cycles are read-only.
reset role; select set_config('request.jwt.claim.sub', '', false);
update public.assessment_cycles set status = 'final', version = version where id = '10000000-0000-0000-0000-000000000002';
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_error('final cycle cannot be edited',
  $$update public.responses set gap_remarks = 'late edit', version = version where cycle_id = '10000000-0000-0000-0000-000000000002' and indicator_id = 'A1.3'$$, '42501');

-- =============================================================== EOC =========
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_error('duty officer cannot change EOC level',
  $$select public.set_eoc_level('blue', 'Typhoon signal 1')$$, '42501');
select tests.expect_ok('duty officer writes the logbook',
  $$insert into public.logbook_entries (id, entry) values ('40000000-0000-0000-0000-000000000001', 'Radio net check complete')$$);
select tests.expect_error('logbook entries cannot be edited',
  $$update public.logbook_entries set entry = 'changed' where id = '40000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_error('logbook entries cannot be deleted',
  $$delete from public.logbook_entries where id = '40000000-0000-0000-0000-000000000001'$$, '42501');

select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC manager
select tests.expect_error('already at white', $$select public.set_eoc_level('white', 'No change')$$, '22023');
select tests.expect_error('a reason is required', $$select public.set_eoc_level('blue', '  ')$$, '23514');
select tests.expect_ok('raise to blue', $$select public.set_eoc_level('blue', 'PAGASA TCWS 1 over Leyte', 'tropical_cyclone')$$);
select tests.expect_ok('raise to red', $$select public.set_eoc_level('red', 'TCWS 3; flooding in riverine barangays', 'tropical_cyclone')$$);
select tests.expect_eq('status shows red', (select level::text from public.v_eoc_status), 'red');
select tests.expect_rows('exactly one open activation', $$select count(*) from public.eoc_activations where ended_at is null$$, 1);
select tests.expect_ok('stand down to white', $$select public.set_eoc_level('white', 'Hazard passed; response ended')$$);
select tests.expect_eq('status shows white', (select level::text from public.v_eoc_status), 'white');
select tests.expect_rows('level changes logged', $$select count(*) from public.logbook_entries where category = 'level_change'$$, 3);

select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
insert into public.resource_requests (id, requesting_party, item, quantity, priority)
values ('50000000-0000-0000-0000-000000000001', 'Barangay (riverine)', 'Rubber boat with crew', 1, 'life_safety');
select tests.expect_error('request cannot skip to delivered',
  $$update public.resource_requests set status = 'delivered', version = 1 where id = '50000000-0000-0000-0000-000000000001'$$, '22023');
select tests.expect_error('staff cannot approve',
  $$update public.resource_requests set status = 'approved', version = 1 where id = '50000000-0000-0000-0000-000000000001'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_ok('manager approves',
  $$update public.resource_requests set status = 'approved', version = 1 where id = '50000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('rejection needs a reason (after approval)',
  $$update public.resource_requests set status = 'rejected', version = 2 where id = '50000000-0000-0000-0000-000000000001'$$, '23514');

select tests.login('00000000-0000-0000-0000-000000000013');
insert into public.sitreps (id, period_start, period_end, situation, status)
values ('60000000-0000-0000-0000-000000000001', now() - interval '6 hours', now(), 'Fixture', 'submitted');
select tests.expect_eq('SitRep numbered on submission', (select seq::text from public.sitreps where id = '60000000-0000-0000-0000-000000000001'), '1');
select tests.expect_error('staff cannot approve a SitRep',
  $$update public.sitreps set status = 'approved', version = 1 where id = '60000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_error('negative counts refused',
  $$insert into public.sitreps (period_start, period_end, dead) values (now() - interval '1 hour', now(), -1)$$, '23514');

-- ================================================ Anticipatory action ========
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC manager
select tests.expect_error('declaration request needs a severe classification',
  $$insert into public.pdra_sessions (hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
    values ('tropical_cyclone','PAGASA SWB #1', now(), now() + interval '96 hours', 'moderate', 'request_declaration', 'x')$$, '23514');
select tests.expect_error('declaration request needs 3 days of lead time',
  $$insert into public.pdra_sessions (hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
    values ('flood','PAGASA GFA', now(), now() + interval '48 hours', 'severe', 'request_declaration', 'x')$$, '23514');
select tests.expect_ok('short-lead severe hazard goes to city early action',
  $$insert into public.pdra_sessions (hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision)
    values ('flash_flood','Rain gauge alert', now(), now() + interval '6 hours', 'severe', 'local_early_action')$$);
insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
values ('70000000-0000-0000-0000-000000000001','tropical_cyclone','PAGASA SWB #2', now(), now() + interval '100 hours', 'severe',
        'request_declaration', 'Severe winds and storm surge forecast for coastal and riverine barangays');
insert into public.declarations (id, pdra_id, hazard_code, expected_impact_at)
values ('80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','tropical_cyclone', now() + interval '100 hours');
select tests.expect_error('city cannot declare without RDRRMC recommendation',
  $$update public.declarations set status = 'declared', eo_number = 'EO 1', version = 1 where id = '80000000-0000-0000-0000-000000000001'$$, '22023');
select tests.expect_ok('request sent to RDRRMC',
  $$update public.declarations set status = 'requested', version = 1 where id = '80000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('RDRRMC reply due in 24 hours',
  (select extract(epoch from (rdrrmc_due_at - requested_at))::int::text from public.declarations where id = '80000000-0000-0000-0000-000000000001'), '86400');
select tests.expect_error('recommendation needs a reference',
  $$update public.declarations set status = 'recommended', version = 2 where id = '80000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_ok('RDRRMC recommends',
  $$update public.declarations set status = 'recommended', rdrrmc_reference = 'RDRRMC VIII Res. 2026-xx', version = 2 where id = '80000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('declaration needs the EO number',
  $$update public.declarations set status = 'declared', version = 3 where id = '80000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_ok('Mayor declares by EO',
  $$update public.declarations set status = 'declared', eo_number = 'EO No. 2026-001', version = 3 where id = '80000000-0000-0000-0000-000000000001'$$);
select tests.expect_rows('AA checklist loads general and cyclone items',
  $$select public.load_aa_checklist('80000000-0000-0000-0000-000000000001')$$,
  (select count(*) from public.aa_action_templates where hazard_code is null or hazard_code = 'tropical_cyclone'));
select tests.expect_rows('loading the checklist twice adds nothing',
  $$select public.load_aa_checklist('80000000-0000-0000-0000-000000000001')$$, 0);

select tests.expect_error('checklist wording cannot be rewritten',
  $$update public.aa_actions set title = 'Something else', version = version where declaration_id = '80000000-0000-0000-0000-000000000001' and title like 'Issue official notice%'$$, '42501');
select tests.expect_ok('checklist item can be closed',
  $$update public.aa_actions set status = 'done', version = version where declaration_id = '80000000-0000-0000-0000-000000000001' and title like 'Issue official notice%'$$);
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head records funds
select tests.expect_error('AA allocation above 10% of the 70% LDRRMF is refused',
  $$insert into public.aa_fund_years (fiscal_year, ldrrmf_total, aa_allocation) values (2026, 10000000, 700001)$$, '23514');
select tests.expect_ok('AA allocation at the cap',
  $$insert into public.aa_fund_years (fiscal_year, ldrrmf_total, aa_allocation) values (2026, 10000000, 700000)$$);
select tests.expect_ok('beyond-3-day disbursement within 30%',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'ldrrmf_aa', 210000, 'Relief prepositioning', now())$$);
select tests.expect_eq('tranche classified beyond threshold',
  (select tranche from public.aa_disbursements where purpose = 'Relief prepositioning'), 'beyond_threshold');
select tests.expect_error('beyond-3-day disbursements cannot pass 30%',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'ldrrmf_aa', 1, 'Extra', now())$$, '23514');
select tests.expect_ok('within-3-day disbursement up to 70%',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'ldrrmf_aa', 490000, 'Pre-emptive evacuation transport', now() + interval '50 hours')$$);
select tests.expect_ok('other sources are exempt from the graduation',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'donation', 5000000, 'Partner food packs', now())$$);
select tests.expect_error('intervention after impact is not anticipatory',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'donation', 1, 'Late', now() + interval '200 hours')$$, '23514');
select tests.expect_eq('fund status totals',
  (select beyond_used || '/' || beyond_limit || ' ' || within_used || '/' || within_limit from public.v_aa_fund_status where fiscal_year = 2026),
  '210000.00/210000.00 490000.00/490000.00');

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_error('lifting needs a ground',
  $$update public.declarations set status = 'lifted', version = 4 where id = '80000000-0000-0000-0000-000000000001'$$, '23514');
select tests.expect_ok('lift: impacts not met',
  $$update public.declarations set status = 'lifted', lifting_ground = 'impacts_not_met', lifting_basis = 'PDRA #3', lifting_reference = 'RDRRMC VIII Memo 2026-xx; EO No. 2026-002', version = 4 where id = '80000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('45-day report deadline set',
  (select (report_due_at - lifted_at)::text from public.declarations where id = '80000000-0000-0000-0000-000000000001'), '45 days');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head (may record funds)
select tests.expect_error('funds cannot be released after lifting',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-000000000001', 2026, 'donation', 1, 'After', now())$$, '22023');
select tests.expect_ok('report recorded after lifting',
  $$update public.declarations set report_submitted_at = now(), report_reference = 'CDRRMO-2026-AA-01', version = 5 where id = '80000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('a lifted declaration cannot be edited otherwise',
  $$update public.declarations set eo_number = 'changed', version = 6 where id = '80000000-0000-0000-0000-000000000001'$$, '42501');

-- RA 12287 and IRR alignment (1.13.0, migration 20261111002500).
select tests.expect_eq('lead-time rules are stated in days, as the law states them',
  (select string_agg(key || '=' || value::int, ',' order by key) from public.aa_rules where key like '%lead%'),
  'extended_declaration_lead_days=5,lead_threshold_days=3,min_declaration_lead_days=3');
select tests.expect_eq('impacts not met: the recommendation and lifting issuance are kept',
  (select lifting_reference from public.declarations where id = '80000000-0000-0000-0000-000000000001'), 'RDRRMC VIII Memo 2026-xx; EO No. 2026-002');
select tests.expect_error('impacts not met: lifting needs the RDRRMC recommendation and lifting issuance',
  $$update public.declarations set lifting_reference = null, version = version where id = '80000000-0000-0000-0000-000000000001'$$, '42501');

-- Drought (climatic, IRR Rule II Sec. 2(b)): adopted provincial declaration; no graduation; allocation still capped.
insert into public.declarations (id, hazard_code, expected_impact_at, origin) values
  ('80000000-0000-0000-0000-0000000000d1', 'drought', now() + interval '20 days', 'adopted_provincial');
select tests.expect_ok('adopt the provincial drought declaration (IRR Rule III Sec. 3)',
  $$update public.declarations set status = 'declared', version = 1 where id = '80000000-0000-0000-0000-0000000000d1'$$);
select tests.expect_ok('a larger 2026 LDRRMF raises the AA allocation (the earlier checks used all of it)',
  $$update public.aa_fund_years set ldrrmf_total = 20000000, aa_allocation = 1400000, version = version where fiscal_year = 2026$$);
select tests.expect_ok('drought: an LDRRMF disbursement 20 days out is not graduated (IRR Rule V Sec. 2)',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-0000000000d1', 2026, 'ldrrmf_aa', 1, 'Water rationing preparation', now())$$);
select tests.expect_eq('drought disbursements carry no tranche',
  (select coalesce(tranche, 'none') from public.aa_disbursements where purpose = 'Water rationing preparation'), 'none');
select tests.expect_error('drought: LDRRMF disbursements stay within the year''s allocation (IRR Rule V Sec. 1(b))',
  $$insert into public.aa_disbursements (declaration_id, fiscal_year, source, amount, purpose, intervention_at)
    values ('80000000-0000-0000-0000-0000000000d1', 2026, 'ldrrmf_aa',
            (select 1400001 - coalesce(sum(amount), 0) from public.aa_disbursements where fiscal_year = 2026 and source = 'ldrrmf_aa'),
            'Over the allocation', now())$$, '23514');

-- Automatic lifting on occurrence (RA 12287 Sec. 7; IRR Rule II Sec. 6(a)).
select tests.expect_error('automatic lifting needs the occurrence time',
  $$update public.declarations set status = 'lifted', lifting_ground = 'hazard_occurred', lifting_basis = 'SitRep 2', version = version
    where id = '80000000-0000-0000-0000-0000000000d1'$$, '23514');
select tests.expect_error('automatic lifting needs the evidence of occurrence',
  $$update public.declarations set status = 'lifted', lifting_ground = 'hazard_occurred', hazard_occurred_at = now(), version = version
    where id = '80000000-0000-0000-0000-0000000000d1'$$, '23514');
select tests.expect_error('the occurrence cannot precede the declaration',
  $$update public.declarations set status = 'lifted', lifting_ground = 'hazard_occurred', hazard_occurred_at = now() - interval '2 days',
       lifting_basis = 'PAGASA advisory', version = version where id = '80000000-0000-0000-0000-0000000000d1'$$, '23514');
select tests.expect_ok('the hazard occurred: the declaration is lifted at that time',
  $$update public.declarations set status = 'lifted', lifting_ground = 'hazard_occurred', hazard_occurred_at = now(),
       lifting_basis = 'PAGASA El Nino advisory; SitRep 2', version = version where id = '80000000-0000-0000-0000-0000000000d1'$$);
select tests.expect_eq('lifted at the occurrence time; the report is due 45 days from it',
  (select (lifted_at = hazard_occurred_at and report_due_at - lifted_at = interval '45 days')::text
     from public.declarations where id = '80000000-0000-0000-0000-0000000000d1'), 'true');
select tests.expect_ok('the occurrence time stays as recorded',
  $$update public.declarations set hazard_occurred_at = now() + interval '1 day', report_reference = 'CDRRMO-2026-AA-02', version = version
    where id = '80000000-0000-0000-0000-0000000000d1'$$);
select tests.expect_eq('the occurrence time did not move',
  (select (hazard_occurred_at = lifted_at)::text from public.declarations where id = '80000000-0000-0000-0000-0000000000d1'), 'true');

-- The three-day minimum is checked again at the Mayor's declaration (IRR Rule II Sec. 3).
insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
values ('70000000-0000-0000-0000-0000000000d2', 'tropical_cyclone', 'PAGASA TCB #1', now(), now() + interval '74 hours', 'severe',
        'request_declaration', 'Severe winds forecast for coastal barangays');
insert into public.declarations (id, pdra_id, hazard_code, expected_impact_at) values
  ('80000000-0000-0000-0000-0000000000d2', '70000000-0000-0000-0000-0000000000d2', 'tropical_cyclone', now() + interval '74 hours');
select tests.expect_ok('a request with just over three days left is accepted',
  $$update public.declarations set status = 'requested', version = 1 where id = '80000000-0000-0000-0000-0000000000d2'$$);
-- Simulate the RDRRMC taking 14 hours: move the clock by moving the expected impact (test only, triggers off).
reset role;
set session_replication_role = replica;
update public.declarations set status = 'recommended', rdrrmc_reference = 'RDRRMC VIII Memo 2026-yy', rdrrmc_responded_at = now(),
  expected_impact_at = now() + interval '60 hours' where id = '80000000-0000-0000-0000-0000000000d2';
set session_replication_role = origin;
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_error('the declaration cannot go below a lead time of three days',
  $$update public.declarations set status = 'declared', eo_number = 'EO No. 2026-009', version = version
    where id = '80000000-0000-0000-0000-0000000000d2'$$, '23514');


-- ================================================ Protocols ==================
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_error('viewer cannot start a protocol',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-WARNING-DISSEM'))$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_error('a draft protocol cannot run live',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-WARNING-DISSEM'), null, 'none', null, '90000000-0000-0000-0000-0000000000a0')$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head approves the template
select tests.expect_ok('CDRRMO Head approves the warning protocol',
  $$update public.protocol_templates set status = 'approved' where code = 'PR-WARNING-DISSEM'$$);
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_ok('duty officer starts warning protocol',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-WARNING-DISSEM'), null, 'none', null, '90000000-0000-0000-0000-000000000001')$$);
select tests.expect_ok('replaying the start is harmless',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-WARNING-DISSEM'), null, 'none', null, '90000000-0000-0000-0000-000000000001')$$);
select tests.expect_ok('a run can be recorded as a drill',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-EOC-ACTIVATE'), 'Drill: EOC activation', 'drill', null, '90000000-0000-0000-0000-0000000000d1')$$);
select tests.expect_rows('steps snapshotted once',
  $$select count(*) from public.protocol_run_steps where run_id = '90000000-0000-0000-0000-000000000001'$$,
  (select count(*) from public.protocol_steps s join public.protocol_templates t on t.id = s.template_id where t.code = 'PR-WARNING-DISSEM'));
select tests.expect_eq('step ids are UUIDv5(run, seq)',
  (select id::text from public.protocol_run_steps where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1),
  extensions.uuid_generate_v5('90000000-0000-0000-0000-000000000001', '1')::text);
select tests.expect_error('a step that needs a note cannot be closed without one',
  $$update public.protocol_run_steps set status = 'done', version = 1 where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1$$, '23514');
select tests.expect_error('skipping needs a reason',
  $$update public.protocol_run_steps set status = 'skipped', version = 1 where run_id = '90000000-0000-0000-0000-000000000001' and seq = 4$$, '23514');
select tests.expect_error('cannot complete with open steps',
  $$update public.protocol_runs set status = 'completed', version = 1 where id = '90000000-0000-0000-0000-000000000001'$$, '23514');
-- 1.9.0: every step has a form (ADR-016).
select tests.expect_eq('every step of the run carries a form',
  (select count(*) filter (where form_schema is null)::text from public.protocol_run_steps where run_id = '90000000-0000-0000-0000-000000000001'), '0');
select tests.expect_error('a step with a form cannot close until the form is complete',
  $$update public.protocol_run_steps set status = 'done', note = 'done', version = version where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1$$, '23514');
select tests.expect_error('a form cannot carry fields it does not define',
  $$update public.protocol_run_steps set form_data = tests.sample_form(form_schema) || '{"evacuee_name":"x"}', status = 'done', note = 'done', version = version
    where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1$$, '23514');
select tests.expect_error('a form value must have the right type',
  $$update public.protocol_run_steps set form_data = tests.sample_form(form_schema) || '{"issued_at": 5}', status = 'done', note = 'done', version = version
    where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1$$, '23514');
select tests.expect_error('the form snapshot is the server''s',
  $$update public.protocol_run_steps set form_schema = '{"fields":[{"key":"x","label":"X","type":"text"}]}', form_data = '{"x":"y"}', status = 'done', note = 'done', version = version
    where run_id = '90000000-0000-0000-0000-000000000001' and seq = 1$$, '23514');
select tests.expect_ok('complete every step',
  $$update public.protocol_run_steps set form_data = tests.sample_form(form_schema), status = 'done', note = 'done', version = version where run_id = '90000000-0000-0000-0000-000000000001'$$);
select tests.expect_ok('complete the run',
  $$update public.protocol_runs set status = 'completed', version = 1 where id = '90000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('step wording cannot be rewritten',
  $$update public.protocol_run_steps set instruction = 'Do nothing', version = version where run_id = '90000000-0000-0000-0000-000000000001' and seq = 2$$, '42501');
select tests.expect_error('a completed run is closed',
  $$update public.protocol_runs set title = 'renamed', version = 2 where id = '90000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_eq('steps stamped with who did them',
  (select count(distinct done_by)::text from public.protocol_run_steps where run_id = '90000000-0000-0000-0000-000000000001'), '1');

-- ================================================ MOO library ================
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
insert into public.moo_versions (id, document_id, label, body_md)
values ('a0000000-0000-0000-0000-000000000001', (select id from public.moo_documents where code = 'EOC Ch.2'), 'v0.2 draft', '# EOC Ch.2');
select tests.expect_error('author cannot approve',
  $$update public.moo_versions set status = 'approved', version = 1 where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_ok('author submits for review',
  $$update public.moo_versions set status = 'in_review', version = 1 where id = 'a0000000-0000-0000-0000-000000000001'$$);
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('Head approves',
  $$update public.moo_versions set status = 'approved', version = 2 where id = 'a0000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('approved version becomes current',
  (select current_version_id::text from public.moo_documents where code = 'EOC Ch.2'), 'a0000000-0000-0000-0000-000000000001');
select tests.expect_error('approved version is immutable',
  $$update public.moo_versions set body_md = 'edited', version = 3 where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501');
insert into public.moo_versions (id, document_id, label, body_md)
values ('a0000000-0000-0000-0000-000000000002', (select id from public.moo_documents where code = 'EOC Ch.2'), 'v0.2b returned draft', '# EOC Ch.2 returned');
select tests.expect_ok('Head returns a draft to the author',
  $$update public.moo_versions set status = 'rejected', version = 1 where id = 'a0000000-0000-0000-0000-000000000002'$$);
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('viewer reads approved text and drafts under review, not returned drafts (v1.6)',
  $$select count(*) from public.moo_versions where document_id = (select id from public.moo_documents where code = 'EOC Ch.2')$$, 2);

-- ================================================ Profiles ===================
select tests.login('00000000-0000-0000-0000-00000000000f');
select tests.expect_error('a user cannot move themselves to another office',
  $$update public.profiles set office_id = (select id from public.offices where code = 'CDRRMO'), version = version where id = auth.uid()$$, '42501');
select tests.expect_error('a user cannot grant themselves a role',
  $$insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')$$, '42501');

select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_ok('an admin deactivates a viewer',
  $$update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000010'$$);
select tests.login('00000000-0000-0000-0000-000000000010');
select tests.expect_rows('a deactivated user sees nothing', $$select count(*) from public.iat_indicators$$, 0);
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_ok('and can be reactivated',
  $$update public.profiles set is_active = true where id = '00000000-0000-0000-0000-000000000010'$$);

-- ================================================ Document Vault =============
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_ok('an assessor adds a document linked to indicators',
  $$insert into public.vault_documents (id, title, category, ref_key, indicator_ids) values
    ('70000000-0000-0000-0000-000000000001', 'LDRRMF Investment Plan 2026', 'plan', 'JMC 2013-1', array['A4.6','A3.5','A3.5'])$$);
select tests.expect_eq('links are de-duplicated and sorted',
  (select indicator_ids::text from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'), '{A3.5,A4.6}');
select tests.expect_eq('the uploader is the signed-in user',
  (select uploaded_by::text from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000b');
select tests.expect_error('an unknown indicator is refused',
  $$insert into public.vault_documents (title, category, indicator_ids) values ('Bad link', 'record', array['Z9.9'])$$, '23503');
update public.vault_documents set uploaded_by = '00000000-0000-0000-0000-000000000011', version = version where id = '70000000-0000-0000-0000-000000000001';
select tests.expect_eq('the uploader cannot be spoofed',
  (select uploaded_by::text from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000b');
select tests.expect_error('only https links are accepted',
  $$insert into public.vault_documents (title, category, url) values ('Insecure link', 'law', 'http://example.org/ra10121')$$, '23514');
select tests.expect_error('documents cannot be deleted',
  $$delete from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_ok('the uploader attaches the file into the document folder',
  $$insert into storage.objects (bucket_id, name, owner) values ('vault', '70000000-0000-0000-0000-000000000001/ldrrmfip-2026.pdf', auth.uid())$$);
select tests.expect_ok('the file path is recorded',
  $$update public.vault_documents set storage_path = '70000000-0000-0000-0000-000000000001/ldrrmfip-2026.pdf', version = version where id = '70000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('an attached file cannot be swapped',
  $$update public.vault_documents set storage_path = '70000000-0000-0000-0000-000000000001/other.pdf', version = version where id = '70000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_error('a file path outside the document folder is refused',
  $$insert into public.vault_documents (id, title, category, storage_path) values ('70000000-0000-0000-0000-000000000002', 'Misfiled', 'record', 'someone-else/file.pdf')$$, '23514');

select tests.login('00000000-0000-0000-0000-00000000000c');  -- validator (evaluator)
select tests.expect_rows('a validator reads the vault', $$select count(*) from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'$$, 1);
select tests.expect_rows('a validator cannot change someone else''s document',
  $$with u as (update public.vault_documents set title = 'Changed' where id = '70000000-0000-0000-0000-000000000001' returning 1) select count(*) from u$$, 0);
select tests.expect_error('nor upload into its folder',
  $$insert into storage.objects (bucket_id, name, owner) values ('vault', '70000000-0000-0000-0000-000000000001/x.pdf', auth.uid())$$, '42501');

select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the CDRRMO Head marks a document superseded',
  $$update public.vault_documents set status = 'superseded', version = version where id = '70000000-0000-0000-0000-000000000001'$$);

select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer (CDRRMO staff)
select tests.expect_rows('CDRRMO staff read the vault', $$select count(*) from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'$$, 1);
select tests.expect_rows('and its files', $$select count(*) from storage.objects where bucket_id = 'vault'$$, 1);

select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_rows('an admin reads the vault', $$select count(*) from public.vault_documents where id = '70000000-0000-0000-0000-000000000001'$$, 1);

select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('a viewer cannot see the vault', $$select count(*) from public.vault_documents$$, 0);
select tests.expect_rows('nor its files', $$select count(*) from storage.objects where bucket_id = 'vault'$$, 0);
select tests.expect_error('nor add to it', $$insert into public.vault_documents (title, category) values ('Viewer doc', 'other')$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
select tests.expect_rows('manual authors are not vault users', $$select count(*) from public.vault_documents$$, 0);
select tests.login('00000000-0000-0000-0000-00000000000f');  -- lead office focal
select tests.expect_rows('lead office focal persons are not vault users', $$select count(*) from public.vault_documents$$, 0);

-- ===================================================== v1.2 accounts ========
-- Open sign-up: a new account reads nothing until an administrator grants a role.
reset role; select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000020', 'new@test.local', '{"full_name":"Applicant"}', now()),
 ('00000000-0000-0000-0000-000000000021', 'unconfirmed@test.local', '{}', null);
select tests.login('00000000-0000-0000-0000-000000000020');
select tests.expect_eq('a new account is not an active user', app.is_active_user()::text, 'false');
select tests.expect_rows('it sees only its own profile', $$select count(*) from public.profiles$$, 1);
select tests.expect_rows('no assessment cycles', $$select count(*) from public.assessment_cycles$$, 0);
select tests.expect_rows('no responses', $$select count(*) from public.responses$$, 0);
select tests.expect_rows('no evidence', $$select count(*) from public.evidence$$, 0);
select tests.expect_rows('no logbook', $$select count(*) from public.logbook_entries$$, 0);
select tests.expect_rows('no SitReps', $$select count(*) from public.sitreps$$, 0);
select tests.expect_rows('no declarations', $$select count(*) from public.declarations$$, 0);
select tests.expect_rows('no AA funds', $$select count(*) from public.aa_fund_years$$, 0);
select tests.expect_rows('no manual documents', $$select count(*) from public.moo_documents$$, 0);
select tests.expect_rows('no evidence files', $$select count(*) from storage.objects$$, 0);
select tests.expect_eq('it can read its own account status', (public.my_account() ->> 'roles'), '[]');
select tests.expect_ok('it can fill in its name while pending',
  $$update public.profiles set full_name = 'Juan Dela Cruz', position = 'Engineer II', version = 1 where id = '00000000-0000-0000-0000-000000000020'$$);
select tests.expect_error('it cannot list accounts', $$select * from public.admin_list_accounts()$$, '42501');
select tests.expect_error('nor grant itself a role', $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000020', 'viewer')$$, '42501');

select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_eq('admin sees pending accounts first, with their email',
  ((select email from public.admin_list_accounts() limit 1) in ('new@test.local', 'unconfirmed@test.local'))::text, 'true');
select tests.expect_error('a role needs a confirmed email',
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000021', 'viewer')$$, '42501');
select tests.expect_ok('approving = granting a role',
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000020', 'viewer')$$);
select tests.expect_eq('the grant records who approved',
  (select granted_by::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000020'), '00000000-0000-0000-0000-00000000000a');
select tests.expect_error('an admin cannot remove their own admin role',
  $$delete from public.user_roles where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'admin'$$, '42501');
select tests.expect_error('nor deactivate themselves',
  $$update public.profiles set is_active = false, version = version where id = '00000000-0000-0000-0000-00000000000a'$$, '42501');

select tests.login('00000000-0000-0000-0000-000000000020');
select tests.expect_eq('after approval the account is active', app.is_active_user()::text, 'true');
select tests.expect_error('and its name is changed by an administrator',
  $$update public.profiles set full_name = 'CDRRMO Head', version = 2 where id = '00000000-0000-0000-0000-000000000020'$$, '42501');

-- Assessment cycles: finalising and deleting.
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
insert into public.assessment_cycles (id, name, cycle_year, created_by) values
  ('10000000-0000-0000-0000-000000000009', 'v1.2 checks', 2026, '00000000-0000-0000-0000-000000000011');
select tests.expect_eq('created_by is the signed-in user, not what the client sent',
  (select created_by::text from public.assessment_cycles where id = '10000000-0000-0000-0000-000000000009'), '00000000-0000-0000-0000-00000000000b');
select tests.expect_error('an assessor cannot finalise a cycle',
  $$update public.assessment_cycles set status = 'final', version = 1 where id = '10000000-0000-0000-0000-000000000009'$$, '42501');
select tests.expect_error('an assessor cannot reopen a final cycle',
  $$update public.assessment_cycles set status = 'draft', version = version where id = '10000000-0000-0000-0000-000000000002'$$, '42501');
select tests.expect_rows('nor delete one (admin only)',
  $$with d as (delete from public.assessment_cycles where id = '10000000-0000-0000-0000-000000000002' returning 1) select count(*) from d$$, 0);
insert into public.responses (id, cycle_id, indicator_id, validated_by, validated_at) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'A1.1', '00000000-0000-0000-0000-00000000000c', now());
select tests.expect_eq('a client cannot pre-fill validation stamps',
  (select coalesce(validated_by::text, 'null') from public.responses where id = '20000000-0000-0000-0000-000000000009'), 'null');
select tests.expect_error('a response cannot be moved to another cycle',
  $$update public.responses set cycle_id = '10000000-0000-0000-0000-000000000001', version = 1 where id = '20000000-0000-0000-0000-000000000009'$$, '42501');
insert into public.evidence (id, response_id, kind, strength, title) values
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'document', 'approved_in_use', 'EO 2026-01');
update public.responses set score = 3, status = 'provisional', version = 1 where id = '20000000-0000-0000-0000-000000000009';
select tests.login('00000000-0000-0000-0000-00000000000c');  -- validator
update public.responses set status = 'validated', version = 2 where id = '20000000-0000-0000-0000-000000000009';
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.expect_error('evidence behind a validated score is locked',
  $$update public.evidence set kind = 'photo', strength = 'partial', title = 'swapped', version = 1 where id = '30000000-0000-0000-0000-000000000009'$$, '42501');
select tests.expect_error('and cannot be added to',
  $$insert into public.evidence (response_id, kind, strength, title) values ('20000000-0000-0000-0000-000000000009', 'document', 'approved_in_use', 'extra')$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_error('even an admin cannot delete a cycle with validated scores',
  $$delete from public.assessment_cycles where id = '10000000-0000-0000-0000-000000000009'$$, '42501');

-- Manual text.
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
insert into public.moo_versions (id, document_id, label, body_md)
values ('a0000000-0000-0000-0000-000000000009', (select id from public.moo_documents where code = 'EOC Ch.2'), 'v0.3 draft', '# not approved');
select tests.expect_error('an author cannot make a draft the current text',
  $$update public.moo_documents set current_version_id = 'a0000000-0000-0000-0000-000000000009', version = version where code = 'EOC Ch.2'$$, '42501');
select tests.expect_rows('nor delete an approved version',
  $$with d as (delete from public.moo_versions where id = 'a0000000-0000-0000-0000-000000000001' returning 1) select count(*) from d$$, 0);
select tests.expect_rows('nor delete a document',
  $$with d as (delete from public.moo_documents where code = 'EOC Ch.2' returning 1) select count(*) from d$$, 0);

-- Resource requests and attribution.
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_error('a request cannot be created already approved',
  $$insert into public.resource_requests (requesting_party, item, quantity, status) values ('Brgy Cogon', 'Fuel', 2000, 'approved')$$, '42501');
insert into public.sitreps (id, period_start, period_end, situation, prepared_by, approved_by, approved_at)
values ('60000000-0000-0000-0000-000000000009', now() - interval '6 hours', now(), 'v1.2', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', now());
select tests.expect_eq('SitRep attribution is the server''s',
  (select prepared_by::text || '/' || coalesce(approved_by::text, 'null') from public.sitreps where id = '60000000-0000-0000-0000-000000000009'),
  '00000000-0000-0000-0000-00000000000e/null');

-- Declarations: PDRA, lead time, fixed facts, server clocks.
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
insert into public.declarations (id, hazard_code, expected_impact_at) values
  ('80000000-0000-0000-0000-000000000009', 'tropical_cyclone', now() + interval '71 hours');
select tests.expect_error('a City request needs a PDRA that decided to request a declaration',
  $$update public.declarations set status = 'requested', version = 1 where id = '80000000-0000-0000-0000-000000000009'$$, '23514');
insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, conducted_at, impact_class, decision, decision_basis)
values ('70000000-0000-0000-0000-000000000009', 'tropical_cyclone', 'PAGASA TCB #1', now() - interval '3 hours', now() + interval '71 hours',
        now() - interval '2 hours', 'severe', 'request_declaration', 'PDRA held with 73 h left; request sent with 71 h left');
update public.declarations set pdra_id = '70000000-0000-0000-0000-000000000009', version = 1 where id = '80000000-0000-0000-0000-000000000009';
select tests.expect_error('lead time is measured when the request is sent, on server time',
  $$update public.declarations set status = 'requested', version = 2 where id = '80000000-0000-0000-0000-000000000009'$$, '23514');
insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
values ('70000000-0000-0000-0000-00000000000a', 'tropical_cyclone', 'PAGASA TCB #2', now() - interval '1 hour', now() + interval '100 hours', 'severe', 'request_declaration', 'v1.2');
insert into public.declarations (id, pdra_id, hazard_code, expected_impact_at) values
  ('80000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-00000000000a', 'tropical_cyclone', now() + interval '100 hours');
update public.declarations set status = 'requested', requested_at = '2026-01-01', version = 1 where id = '80000000-0000-0000-0000-00000000000a';
select tests.expect_eq('a request time older than a day is replaced by the server time',
  (select (requested_at > now() - interval '1 minute')::text from public.declarations where id = '80000000-0000-0000-0000-00000000000a'), 'true');
select tests.expect_error('the expected impact is fixed once requested',
  $$update public.declarations set expected_impact_at = now() + interval '30 days', version = 2 where id = '80000000-0000-0000-0000-00000000000a'$$, '42501');
select tests.expect_ok('and recorded times do not move',
  $$update public.declarations set requested_at = now() - interval '2 hours', rdrrmc_due_at = now() + interval '9 days', version = 2 where id = '80000000-0000-0000-0000-00000000000a'$$);
select tests.expect_eq('the RDRRMC clock still runs from the original time',
  (select extract(epoch from (rdrrmc_due_at - requested_at))::int::text from public.declarations where id = '80000000-0000-0000-0000-00000000000a'), '86400');

-- AA funds.
select tests.expect_error('an allocation cannot drop below what was disbursed',
  $$update public.aa_fund_years set aa_allocation = 1000, version = version where fiscal_year = 2026$$, '23514');

-- 1.5.1: resource requests are fixed once decided (migration 20261031001100).
select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
insert into public.resource_requests (id, requesting_party, item, quantity, unit, priority, requested_at)
values ('50000000-0000-0000-0000-0000000000a1', 'Brgy Cogon', 'Rice', 10, 'sack', 'urgent', '2026-01-01');
select tests.expect_eq('a request time older than a day is replaced by the server time',
  (select (requested_at > now() - interval '1 minute')::text from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a1'), 'true');
select tests.expect_ok('the request can be corrected while it is still requested',
  $$update public.resource_requests set quantity = 12, version = 1 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC Manager
select tests.expect_ok('manager approves the corrected request',
  $$update public.resource_requests set status = 'approved', version = 2 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.login('00000000-0000-0000-0000-000000000013');
select tests.expect_error('staff cannot change the quantity of an approved request',
  $$update public.resource_requests set quantity = 5000, version = 3 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_error('nor the item (the generator case)',
  $$update public.resource_requests set item = 'Generator', quantity = 5000, unit = 'unit', version = 3 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_error('not even the EOC Manager can rewrite an approved request',
  $$update public.resource_requests set requesting_party = 'Another barangay', version = 3 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_error('nor its priority or needed-by time',
  $$update public.resource_requests set priority = 'life_safety', needed_by = now(), version = 3 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_eq('the approved request still reads as approved',
  (select item || ' ' || quantity::text || ' ' || status from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a1'), 'Rice 12 approved');
update public.resource_requests set approved_at = '2026-01-01', created_by = '00000000-0000-0000-0000-000000000011',
  requested_at = '2026-01-02', decision_note = 'From the City warehouse', version = 3 where id = '50000000-0000-0000-0000-0000000000a1';
select tests.expect_eq('the decision note stays open while the request is fulfilled',
  (select decision_note from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a1'), 'From the City warehouse');
select tests.expect_eq('but approval time, request time and creator do not move',
  (select ((approved_at > now() - interval '1 minute') and (requested_at > now() - interval '1 minute')
           and created_by = '00000000-0000-0000-0000-000000000013')::text from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a1'), 'true');
reset role;
insert into public.resources (id, name, category, unit, quantity)
values ('5f000000-0000-0000-0000-000000000001', 'City warehouse rice stock', 'relief', 'sack', 400);
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_ok('a resource can be assigned while approved',
  $$update public.resource_requests set resource_id = '5f000000-0000-0000-0000-000000000001', version = 4 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.expect_error('mobilising cannot carry a changed quantity',
  $$update public.resource_requests set status = 'mobilized', quantity = 500, version = 5 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_ok('mobilise',
  $$update public.resource_requests set status = 'mobilized', version = 5 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.expect_eq('mobilised time is stamped and the approval time kept',
  (select (mobilized_at is not null and approved_at < mobilized_at + interval '1 second')::text from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a1'), 'true');
select tests.expect_error('the assigned resource is fixed once mobilised',
  $$update public.resource_requests set resource_id = null, version = 6 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_ok('deliver',
  $$update public.resource_requests set status = 'delivered', version = 6 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.expect_error('the note is fixed once delivered',
  $$update public.resource_requests set decision_note = 'changed later', version = 7 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
select tests.expect_ok('demobilise',
  $$update public.resource_requests set status = 'demobilized', version = 7 where id = '50000000-0000-0000-0000-0000000000a1'$$);
select tests.expect_error('a demobilised request is closed',
  $$update public.resource_requests set decision_note = 'after the fact', version = 8 where id = '50000000-0000-0000-0000-0000000000a1'$$, '42501');
insert into public.resource_requests (id, requesting_party, item, quantity) values ('50000000-0000-0000-0000-0000000000a2', 'Brgy Valencia', 'Tents', 30);
select tests.expect_ok('reject with a reason',
  $$update public.resource_requests set status = 'rejected', decision_note = 'Covered by DSWD stockpile', version = 1 where id = '50000000-0000-0000-0000-0000000000a2'$$);
select tests.expect_error('a rejected request is closed',
  $$update public.resource_requests set quantity = 3, version = 2 where id = '50000000-0000-0000-0000-0000000000a2'$$, '42501');
select tests.expect_error('requests are never deleted',
  $$delete from public.resource_requests where id = '50000000-0000-0000-0000-0000000000a2'$$, '42501');
select tests.expect_eq('and the API role has no delete grant',
  has_table_privilege('authenticated', 'public.resource_requests', 'DELETE')::text, 'false');

-- ---------------------------------------------------- one manual (v1.6) ----
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('the viewer reads the five Parts', $$select count(*) from public.manual_parts$$, 5);
select tests.expect_rows('and the ten functional areas', $$select count(*) from public.manual_areas$$, 10);
select tests.expect_error('only an admin changes the manual structure',
  $$insert into public.manual_parts (no, title, sort) values (6, 'Extra', 6)$$, '42501');
select tests.expect_eq('the viewer can read draft chapters under review',
  ((select count(*) from public.moo_versions v join public.moo_documents d on d.id = v.document_id where d.code = 'Chapter 1' and v.status = 'draft') > 0)::text, 'true');
select tests.expect_rows('an old code resolves through aliases', $$select count(*) from public.moo_documents where 'EOC Ch.2' = any(aliases) and status <> 'superseded'$$, 1);
select tests.expect_rows('merged shells hold no indicator links',
  $$select count(*) from public.moo_document_indicators mdi join public.moo_documents d on d.id = mdi.document_id where d.status = 'superseded'$$, 0);
select tests.expect_rows('every indicator has a functional area', $$select count(*) from public.iat_indicators where functional_area is null$$, 0);
select tests.expect_rows('each area outline holds the gaps of its area',
  $$select count(*) from public.iat_indicators i where not exists (select 1 from public.moo_document_indicators mdi join public.moo_documents d on d.id = mdi.document_id
     where mdi.indicator_id = i.id and d.kind = 'area' and d.area_no = i.functional_area)$$, 0);
select tests.expect_rows('traceability leaves merged sections out',
  $$select count(*) from public.v_traceability t, jsonb_array_elements(t.documents) e where e->>'status' = 'superseded'$$, 0);
select tests.expect_rows('a viewer cannot rename a manual section',
  $$with u as (update public.moo_documents set title = 'x' where code = 'Area 4' returning 1) select count(*) from u$$, 0);


-- ================================================ 1.9.0 =====================
-- Vault access levels (ADR-015)
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_ok('an assessor adds a restricted paper for named roles',
  $$insert into public.vault_documents (id, title, category, access_class, allowed_roles) values
    ('70000000-0000-0000-0000-0000000000a1', 'Internal staff paper', 'report', 'restricted', array['assessor','cdrrmo_head']::public.app_role[])$$);
select tests.expect_error('a restricted document must name its roles',
  $$insert into public.vault_documents (title, category, access_class) values ('No roles', 'report', 'restricted')$$, '23514');
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer (uses the Vault, not in the list)
select tests.expect_rows('a restricted document is hidden from other roles',
  $$select count(*) from public.vault_documents where id = '70000000-0000-0000-0000-0000000000a1'$$, 0);
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_rows('the CDRRMO Head always sees restricted documents',
  $$select count(*) from public.vault_documents where id = '70000000-0000-0000-0000-0000000000a1'$$, 1);
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_error('only the Head changes who may open a document',
  $$update public.vault_documents set access_class = 'standard', allowed_roles = '{}' where id = '70000000-0000-0000-0000-0000000000a1'$$, '42501');

-- Connected apps (ADR-018)
select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_ok('an admin registers an app as a request',
  $$insert into public.connected_apps (id, client_id, name, purpose, redirect_uri, data_scope) values
    ('c0000000-0000-0000-0000-000000000001', 'client-dashboard-01', 'City dashboard', 'Show EOC level on the City dashboard',
     'https://dashboard.ormoc.gov.ph/callback', 'EOC level and SitRep totals')$$);
select tests.expect_error('an app cannot be registered already approved',
  $$insert into public.connected_apps (client_id, name, purpose, redirect_uri, data_scope, status) values
    ('client-other-0002', 'Other', 'Some purpose here', 'https://x.ph/cb', 'Everything', 'approved')$$, '42501');
reset role;
select set_config('request.jwt.claims', '{"client_id":"client-dashboard-01"}', false);
select tests.login('00000000-0000-0000-0000-000000000011');
select tests.expect_rows('an unapproved app reads nothing', $$select count(*) from public.iat_indicators$$, 0);
select tests.login('00000000-0000-0000-0000-000000000011');
reset role; select set_config('request.jwt.claims', '', false);
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the CDRRMO Head approves the app',
  $$update public.connected_apps set status = 'approved' where id = 'c0000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('review stamps are the server''s',
  (select (reviewed_by = '00000000-0000-0000-0000-000000000011' and review_due is not null)::text from public.connected_apps where id = 'c0000000-0000-0000-0000-000000000001'), 'true');
reset role;
select set_config('request.jwt.claims', '{"client_id":"client-dashboard-01"}', false);
select tests.login('00000000-0000-0000-0000-000000000011');
select tests.expect_eq('an approved app reads what the person''s role allows',
  ((select count(*) from public.iat_indicators) = 140)::text, 'true');
select tests.expect_error('and still cannot write',
  $$update public.connected_apps set purpose = 'changed by app' where id = 'c0000000-0000-0000-0000-000000000001'$$, '42501');
reset role; select set_config('request.jwt.claims', '', false);

-- Forms (ADR-016)
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
select tests.expect_error('a form needs valid fields',
  $$insert into public.form_templates (code, title, schema) values ('TEST-F01', 'Bad form', '{"fields":[{"key":"Bad Key","label":"X","type":"text"}]}')$$, '23514');
select tests.expect_ok('an author drafts a form',
  $$insert into public.form_templates (code, title, schema) values ('TEST-F02', 'Good form', '{"fields":[{"key":"count","label":"Count","type":"integer","required":true}]}')$$);
select tests.expect_error('an author cannot approve a form',
  $$update public.form_templates set status = 'approved' where code = 'TEST-F02'$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the Head approves it', $$update public.form_templates set status = 'approved' where code = 'TEST-F02'$$);
select tests.expect_error('an approved form''s fields are fixed',
  $$update public.form_templates set schema = '{"fields":[{"key":"n","label":"N","type":"text"}]}' where code = 'TEST-F02'$$, '42501');
select tests.expect_eq('form check: integer', coalesce(app.form_problems('{"fields":[{"key":"n","label":"N","type":"integer"}]}', '{"n":1.5}'), 'ok'), 'Check these entries: N');
select tests.expect_eq('form check: option', coalesce(app.form_problems('{"fields":[{"key":"s","label":"S","type":"select","options":["a","b"]}]}', '{"s":"c"}'), 'ok'), 'Check these entries: S');
select tests.expect_eq('form check: complete', coalesce(app.form_problems('{"fields":[{"key":"s","label":"S","type":"select","options":["a","b"],"required":true}]}', '{"s":"a"}'), 'ok'), 'ok');
select tests.expect_rows('every seeded step names a form', $$select count(*) from public.protocol_steps where form_code is null$$, 0);

-- EOC structure, designations and contingency-plan clustering (ADR-017)
select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
select tests.expect_ok('EOC staff propose a designation',
  $$insert into public.eoc_designations (id, position_id, rank, person_id) values
    ('d0000000-0000-0000-0000-000000000001', (select id from public.eoc_positions where code = 'EOC-MGR'), 1, '00000000-0000-0000-0000-00000000000d')$$);
select tests.expect_error('a designation cannot start approved',
  $$insert into public.eoc_designations (position_id, rank, person_id, status) values
    ((select id from public.eoc_positions where code = 'EOC-MGR'), 2, '00000000-0000-0000-0000-000000000013', 'approved')$$, '42501');
select tests.expect_error('only the Head approves a designation',
  $$update public.eoc_designations set status = 'approved' where id = 'd0000000-0000-0000-0000-000000000001'$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the Head approves it',
  $$update public.eoc_designations set status = 'approved' where id = 'd0000000-0000-0000-0000-000000000001'$$);
select tests.expect_error('an approved designation is fixed',
  $$update public.eoc_designations set person_id = '00000000-0000-0000-0000-000000000013' where id = 'd0000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_eq('depth view counts it', (select approved::text || '/' || two_deep::text from public.v_eoc_depth where code = 'EOC-MGR'), '1/false');

select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
select tests.expect_error('EOC staff cannot activate a plan',
  $$select public.activate_contingency_plan((select id from public.contingency_plans where code = 'CP-FLOOD-LUNOP'))$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC Manager
select public.set_eoc_level('white', 'reset for 1.9.0 tests') where exists (select 1 from public.eoc_activations where ended_at is null);
select tests.expect_error('a plan needs an open activation',
  $$select public.activate_contingency_plan((select id from public.contingency_plans where code = 'CP-FLOOD-LUNOP'))$$, '22023');
select public.set_eoc_level('blue', 'Typhoon forecast (1.9.0 test)', 'tropical_cyclone');
select tests.expect_ok('the EOC Manager activates the flood plan at Blue',
  $$select public.activate_contingency_plan((select id from public.contingency_plans where code = 'CP-FLOOD-LUNOP'))$$);
select tests.expect_eq('at Blue the Red-level clusters wait on standby',
  (select state from public.activation_clusters c join public.eoc_activations a on a.id = c.activation_id and a.ended_at is null
    where c.item_kind = 'cluster' and c.item_code = 'FNFI'), 'standby');
select public.set_eoc_level('red', 'Signal No. 2 (1.9.0 test)');
select tests.expect_eq('going to Red carries the plan and switches the clusters on',
  (select a.plan_id::text || ' ' || c.state from public.activation_clusters c join public.eoc_activations a on a.id = c.activation_id and a.ended_at is null
    where c.item_kind = 'cluster' and c.item_code = 'FNFI'),
  (select id::text || ' on' from public.contingency_plans where code = 'CP-FLOOD-LUNOP'));
select tests.expect_ok('a cluster is stood down',
  $$update public.activation_clusters set state = 'stood_down' where item_code = 'FNFI'
      and activation_id = (select id from public.eoc_activations where ended_at is null)$$);
select public.set_eoc_level('white', 'Stand down (1.9.0 test)');

-- Geo-COP (ADR-015)
select tests.expect_eq('the EOC point is seeded from the KML and awaits field validation',
  (select verification_status || ' ' || round(lat::numeric, 4) || ' ' || round(lng::numeric, 4) from public.geo_reference_points where code = 'EOC'),
  'pending_field_validation 11.0139 124.6043');
select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
select tests.expect_error('EOC staff cannot record a field verification',
  $$update public.geo_reference_points set verification_status = 'field_verified' where code = 'EOC'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC Manager
select tests.expect_ok('the EOC Manager records it',
  $$update public.geo_reference_points set verification_status = 'field_verified' where code = 'EOC'$$);
select tests.expect_error('a verified point is fixed',
  $$update public.geo_reference_points set lat = 11.02 where code = 'EOC'$$, '42501');
select tests.expect_ok('a layer is registered with its metadata',
  $$insert into public.geo_layers (code, title, layer_group, source, validation_status) values ('barangay-boundaries', 'Barangay boundaries', 'admin_boundaries', 'PSA / CPDO', 'preliminary')$$);
select tests.expect_error('only the Head marks a layer official',
  $$update public.geo_layers set validation_status = 'official' where code = 'barangay-boundaries'$$, '42501');

-- SOP registry (1.10.0, ADR-019)
reset role;
select tests.expect_eq('every protocol and workflow carries its SOP registry entry',
  (select count(*)::text from public.protocol_templates where sop_ref is not null and process_owner is not null and cardinality(indicator_ids) > 0),
  (select count(*)::text from public.protocol_templates));
select tests.expect_eq('the nine Chapter 3 workflows are loaded with their forms',
  (select count(distinct t.code)::text || ' ' || count(*) filter (where s.form_code like 'F3-%')::text
     from public.protocol_templates t join public.protocol_steps s on s.template_id = t.id where t.code like 'WF-SOP3-%'),
  '9 19');
select tests.expect_eq('kinds split incident protocols from management workflows',
  (select string_agg(kind || ':' || n, ' ' order by kind) from (select kind, count(*) n from public.protocol_templates group by kind) k),
  'protocol:21 workflow:33');
-- 1.18 (ADR-032): the financing chapter is Chapter 6 v1.1 (renumbered from Ch.5); SOP 6-12 joins SOPs 6-01..6-10.
select tests.expect_eq('Chapter 6 financing runs on ten templates (budget cycle, SOPs 6-03..6-10, 6-12) with their FIN forms',
  (select count(distinct t.code)::text || ' ' || count(*) filter (where s.form_code like 'FIN-%')::text
     from public.protocol_templates t join public.protocol_steps s on s.template_id = t.id
    where t.sop_ref like '%MOO Ch.6 v1.1%'),
  '10 16');
select tests.expect_eq('no SOP registry citation doubles the manual prefix',
  (select count(*)::text from public.protocol_templates where sop_ref like '%MOO MOO%'), '0');
select tests.expect_eq('the Introduction is front matter, not a numbered chapter',
  (select status || ' ' || coalesce(chapter_no::text, '-') from public.moo_documents where code = 'Introduction'), 'draft -');
select tests.expect_eq('Chapter 5 is a drafted chapter, not a superseded shell',
  (select status || ' ' || coalesce(chapter_no::text, '-') from public.moo_documents where code = 'Chapter 5'), 'draft 5');
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
select tests.expect_error('an unknown indicator is refused',
  $$update public.protocol_templates set indicator_ids = array['Z9.9'] where code = 'WF-SOP3-01'$$, '23503');
select tests.expect_ok('an author edits a draft workflow''s process owner',
  $$update public.protocol_templates set process_owner = 'CDRRMO Research and Planning' where code = 'WF-SOP3-01'$$);
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the Head approves it',
  $$update public.protocol_templates set status = 'approved' where code = 'WF-SOP3-01'$$);
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
select tests.expect_error('an approved workflow''s registry entry is fixed',
  $$update public.protocol_templates set policy_refs = array['RA 10121'] where code = 'WF-SOP3-01'$$, '42501');
select tests.expect_rows('indicator traceability lists the SOPs serving A5.1',
  $$select 1 from public.v_indicator_sops where indicator_id = 'A5.1'$$, 1);

-- DDRiVE base layer (1.12.1, ADR-024)
reset role;
select tests.expect_eq('the DDRiVE baseline covers all 85 barangays with 10-digit PSGCs',
  (select count(*)::text from public.ddrive_barangay_profiles where psgc ~ '^[0-9]{10}$'), '85');
select tests.expect_eq('a missing value is never zero: no barangay has a zero 2024 population',
  (select count(*)::text from public.ddrive_barangay_profiles where population_2024 = 0), '0');
select tests.expect_eq('the risk matrix has 25 bands',
  (select count(*)::text from public.ddrive_risk_matrix), '25');
select tests.expect_rows('the computed band matches the workbook for the top desk score',
  $$select 1 from public.v_ddrive_city_risk where hazard_event = 'Riverine & flash flood' and band = 'H7'$$, 1);
select tests.expect_rows('liquefaction desk score computes to M5 as published',
  $$select 1 from public.v_ddrive_city_risk where hazard_event = 'Liquefaction' and band = 'M5'$$, 1);
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('a viewer reads the DDRiVE profiles',
  $$select count(*) from public.ddrive_barangay_profiles$$, 85);
select tests.expect_error('a viewer cannot edit DDRiVE reference data',
  $$update public.ddrive_barangay_profiles set population_2024 = 0 where psgc = '0803738001'$$, '42501');
select tests.expect_rows('a viewer reads the computed DDRiVE city risk',
  $$select count(*) from public.v_ddrive_city_risk$$, 10);
select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_error('even an admin cannot edit DDRiVE reference data through the API',
  $$delete from public.ddrive_sources where source_id = 'S-31'$$, '42501');
-- 1.12.2: signed-out visitors read nothing (ADR-009), including through the view, and the view
-- applies the reader's RLS (security_invoker), like every other MODE view.
reset role;
select tests.expect_eq('a signed-out visitor holds no privilege on the DDRiVE view',
  (has_table_privilege('anon', 'public.v_ddrive_city_risk', 'SELECT'))::text, 'false');
select tests.expect_eq('a signed-out visitor holds no privilege on DDRiVE profiles',
  (has_table_privilege('anon', 'public.ddrive_barangay_profiles', 'SELECT'))::text, 'false');
select tests.expect_eq('the DDRiVE view runs with the reader''s rights',
  (coalesce((select reloptions from pg_class where oid = 'public.v_ddrive_city_risk'::regclass), '{}')
     @> array['security_invoker=true'])::text, 'true');

-- 1.14.0 (C11): signed-out visitors cannot call the platform's actions; signed-in users still can.
reset role;
select tests.expect_eq('a signed-out visitor cannot call ' || f, has_function_privilege('anon', p.oid, 'EXECUTE')::text, 'false')
  from (select distinct on (proname) proname as f, oid from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('set_eoc_level', 'activate_contingency_plan', 'start_protocol', 'load_aa_checklist',
                         'admin_list_accounts', 'connected_app_status', 'my_account', 'my_roles')) p;
select tests.expect_eq('a signed-in user can still call start_protocol',
  has_function_privilege('authenticated', (select oid from pg_proc where proname = 'start_protocol' and pronamespace = 'public'::regnamespace limit 1), 'EXECUTE')::text, 'true');

-- 1.15.0: validation workshop (Methodology v1.1 section 6). Assessor and validator are different people;
-- a validator's change of score needs a reason; the decision and the submitted score are kept.
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
insert into public.assessment_cycles (id, name, cycle_year) values ('11000000-0000-0000-0000-000000000001', 'Workshop checks', 2026);
insert into public.responses (id, cycle_id, indicator_id) values ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'A1.2'), ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'A1.3'), ('21000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'A1.4');
insert into public.evidence (response_id, kind, strength, title, doc_date) values ('21000000-0000-0000-0000-000000000001', 'document', 'approved_in_use', 'EO on CDRRMC composition', '2024-07-01');
insert into public.evidence (response_id, kind, strength, title, source) values ('21000000-0000-0000-0000-000000000002', 'fgd', 'verbal', 'FGD CDRRMO', 'CDRRMO'), ('21000000-0000-0000-0000-000000000003', 'fgd', 'verbal', 'FGD CDRRMO', 'CDRRMO');
select tests.expect_ok('assessor scores and submits A1.2', $$update public.responses set score = 3, status = 'provisional', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000001') where id = '21000000-0000-0000-0000-000000000001'$$);
select tests.expect_ok('assessor scores and submits A1.3', $$update public.responses set score = 2, status = 'provisional', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000002') where id = '21000000-0000-0000-0000-000000000002'$$);
select tests.expect_eq('the scorer is stamped by the server', (select scored_by::text from public.responses where id = '21000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000b');
select tests.expect_ok('a device cannot rewrite who scored', $$update public.responses set scored_by = '00000000-0000-0000-0000-00000000000c', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000001') where id = '21000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('scored_by unchanged', (select scored_by::text from public.responses where id = '21000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000b');

select tests.login('00000000-0000-0000-0000-00000000000c');  -- validator
select tests.expect_ok('validator confirms A1.2', $$update public.responses set status = 'validated', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000001') where id = '21000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('decision recorded as confirmed', (select validation_decision || ' ' || score_before_validation from public.responses where id = '21000000-0000-0000-0000-000000000001'), 'confirmed 3');
select tests.expect_error('revising a score at validation needs a reason',
  $$update public.responses set score = 1, status = 'validated', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000002') where id = '21000000-0000-0000-0000-000000000002'$$, '23514');
select tests.expect_ok('validator revises A1.3 with a reason',
  $$update public.responses set score = 1, status = 'validated', validation_note = 'FGD describes a draft only', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000002') where id = '21000000-0000-0000-0000-000000000002'$$);
select tests.expect_eq('decision recorded as revised from 2', (select validation_decision || ' ' || score_before_validation || ' ' || score from public.responses where id = '21000000-0000-0000-0000-000000000002'), 'revised 2 1');
select tests.expect_ok('validator scores A1.4 and submits it', $$update public.responses set score = 2, status = 'provisional', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000003') where id = '21000000-0000-0000-0000-000000000003'$$);
select tests.expect_error('a validator cannot validate a score they set',
  $$update public.responses set status = 'validated', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000003') where id = '21000000-0000-0000-0000-000000000003'$$, '42501');
select tests.expect_error('a validator cannot create a response already validated',
  $$insert into public.responses (cycle_id, indicator_id, score, status) values ('11000000-0000-0000-0000-000000000001', 'A1.5', 0, 'validated')$$, '42501');

select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('another person validates A1.4', $$update public.responses set status = 'validated', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000003') where id = '21000000-0000-0000-0000-000000000003'$$);
select tests.expect_ok('reopening a validated score', $$update public.responses set status = 'provisional', version = (select version from public.responses where id = '21000000-0000-0000-0000-000000000001') where id = '21000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('reopening clears the decision', coalesce((select validation_decision from public.responses where id = '21000000-0000-0000-0000-000000000001'), 'none'), 'none');
select tests.expect_eq('progress view counts validated and revised',
  (select validated || '/' || revised || '/' || submitted from public.v_validation_progress where cycle_id = '11000000-0000-0000-0000-000000000001' and domain = 'A1'), '2/1/1');
reset role;
select tests.expect_eq('a signed-out visitor cannot read validation progress', has_table_privilege('anon', 'public.v_validation_progress', 'SELECT')::text, 'false');

-- ECHO: evacuation-centre inventory, camp reports and feedback (1.16.0, ADR-030)
select tests.login('00000000-0000-0000-0000-000000000013');  -- EOC staff
select tests.expect_ok('EOC staff add a centre to the inventory',
  $$insert into public.evacuation_centers (id, code, name, kind, capacity_persons, covered_area_m2, lat, lng)
    values ('e1000000-0000-0000-0000-000000000001', 'EC-TEST-01', 'Test multipurpose hall', 'multipurpose', 400, 1400, 11.01, 124.61)$$);
select tests.expect_error('a new centre cannot start verified',
  $$insert into public.evacuation_centers (code, name, verification_status) values ('EC-TEST-02', 'Shortcut', 'field_verified')$$, '42501');
select tests.expect_error('a school must be marked as last resort',
  $$insert into public.evacuation_centers (code, name, kind, is_school) values ('EC-TEST-03', 'School', 'multipurpose', true)$$, '23514');
select tests.expect_error('RA 12076 items are yes, no or unknown',
  $$insert into public.evacuation_centers (code, name, ra12076) values ('EC-TEST-04', 'Bad item', '{"power":"certified"}')$$, '23514');
select tests.expect_error('staff cannot record a field verification',
  $$update public.evacuation_centers set verification_status = 'field_verified', version = 1 where id = 'e1000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_error('a centre cannot be deleted', $$delete from public.evacuation_centers where id = 'e1000000-0000-0000-0000-000000000001'$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC Manager
select tests.expect_ok('the EOC Manager records the field verification',
  $$update public.evacuation_centers set verification_status = 'field_verified', version = 1 where id = 'e1000000-0000-0000-0000-000000000001'$$);
select tests.expect_ok('changing a verified capacity is allowed',
  $$update public.evacuation_centers set capacity_persons = 450, version = 2 where id = 'e1000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('but sends the centre back for field validation',
  (select verification_status || ' ' || (verified_by is null)::text from public.evacuation_centers where id = 'e1000000-0000-0000-0000-000000000001'),
  'pending_field_validation true');
select tests.expect_ok('verified again', $$update public.evacuation_centers set verification_status = 'field_verified', version = 3 where id = 'e1000000-0000-0000-0000-000000000001'$$);
select tests.expect_ok('a training site is allowed for exercises',
  $$insert into public.evacuation_centers (id, code, name, verification_status) values ('e1000000-0000-0000-0000-000000000009', 'EC-TRAIN-A', 'Training Site A', 'training')$$);

select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_error('a duty officer cannot open a centre (authorised decision)',
  $$insert into public.camp_reports (centre_id, phase, authority_ref) values ('e1000000-0000-0000-0000-000000000001', 'opening', 'Memo 1')$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000d');  -- EOC Manager
select tests.expect_error('opening needs an authority reference',
  $$insert into public.camp_reports (centre_id, phase) values ('e1000000-0000-0000-0000-000000000001', 'opening')$$, '23514');
select tests.expect_ok('the EOC Manager records the opening with its authority',
  $$insert into public.camp_reports (centre_id, phase, authority_ref, persons, families) values ('e1000000-0000-0000-0000-000000000001', 'opening', 'Logbook: opening ordered by the Mayor 08:10', 0, 0)$$);
select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer
select tests.expect_ok('a duty officer files an aggregate snapshot',
  $$insert into public.camp_reports (id, centre_id, phase, families, persons, female, children, older, pwd, water_l_day, toilets_functional, services)
    values ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'open', 80, 320, 170, 110, 20, 6, 4000, 9, '{"cfs":"yes","wfs":"partial"}')$$);
select tests.expect_eq('the server stamps who reported',
  (select reported_by::text from public.camp_reports where id = 'e2000000-0000-0000-0000-000000000001'), '00000000-0000-0000-0000-00000000000e');
select tests.expect_error('an open centre needs a persons count',
  $$insert into public.camp_reports (centre_id, phase) values ('e1000000-0000-0000-0000-000000000001', 'open')$$, '23514');
select tests.expect_error('a group cannot exceed persons',
  $$insert into public.camp_reports (centre_id, phase, persons, children) values ('e1000000-0000-0000-0000-000000000001', 'open', 10, 11)$$, '23514');
select tests.expect_error('persons cannot be fewer than families',
  $$insert into public.camp_reports (centre_id, phase, persons, families) values ('e1000000-0000-0000-0000-000000000001', 'open', 10, 11)$$, '23514');
select tests.expect_error('service items are yes, partial or no',
  $$insert into public.camp_reports (centre_id, phase, persons, services) values ('e1000000-0000-0000-0000-000000000001', 'open', 10, '{"cfs":"maybe"}')$$, '23514');
select tests.expect_error('no camp reports for a training site',
  $$insert into public.camp_reports (centre_id, phase, persons) values ('e1000000-0000-0000-0000-000000000009', 'open', 10)$$, '23514');
select tests.expect_error('a camp report is never edited',
  $$update public.camp_reports set persons = 1 where id = 'e2000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_ok('feedback is logged as a non-identifying summary',
  $$insert into public.camp_feedback (id, centre_id, category, summary) values ('e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'wash', 'Women''s toilets have no lights at night')$$);
select tests.expect_error('its summary is kept as logged',
  $$update public.camp_feedback set summary = 'changed', version = 1 where id = 'e3000000-0000-0000-0000-000000000001'$$, '42501');
select tests.expect_ok('its status moves', $$update public.camp_feedback set status = 'closed', action_office = 'CGSO', version = 1 where id = 'e3000000-0000-0000-0000-000000000001'$$);
select tests.expect_eq('closing stamps the time', ((select closed_at from public.camp_feedback where id = 'e3000000-0000-0000-0000-000000000001') is not null)::text, 'true');
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('a viewer reads camp reports', $$select count(*) from public.camp_reports$$, 2);
select tests.expect_error('a viewer cannot file a camp report',
  $$insert into public.camp_reports (centre_id, phase, persons) values ('e1000000-0000-0000-0000-000000000001', 'open', 1)$$, '42501');
reset role;
select tests.expect_eq('a signed-out visitor cannot read camp reports', has_table_privilege('anon', 'public.camp_reports', 'SELECT')::text, 'false');

-- =============================================================== RACI board (1.19.0, ADR-033)
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('any active user reads the RACI matrices', $$select count(*) from public.raci_matrices$$, 21);
select tests.expect_rows('the chapter matrices are seeded (Annex 1-F + DOC + Chapters 1-10)', $$select count(*) from public.raci_activities$$, 228);
select tests.expect_ok('the board view reads for any active user', $$select count(*) from public.v_raci_board$$);
select tests.expect_error('a viewer cannot add an assignment',
  $$insert into public.raci_assignments (activity_id, actor, duty) values ((select id from public.raci_activities limit 1), 'EOC', 'I')$$, '42501');
select tests.expect_error('a viewer cannot change an assignment',
  $$update public.raci_assignments set actor = 'EOC', version = 1 where id = (select id from public.raci_assignments limit 1)$$, '42501');
select tests.expect_error('a viewer cannot remove an assignment',
  $$delete from public.raci_assignments where id = (select id from public.raci_assignments limit 1)$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000012');  -- author
select tests.expect_error('an author cannot adjust assignments either',
  $$insert into public.raci_assignments (activity_id, actor, duty) values ((select id from public.raci_activities limit 1), 'EOC', 'I')$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the CDRRMO Head adds an assignment',
  $$insert into public.raci_assignments (activity_id, actor, duty, qualifier) values ((select id from public.raci_activities where activity = 'Routine risk monitoring'), 'PAGASA', 'C', 'forecast advice')$$);
select tests.expect_ok('and changes it',
  $$update public.raci_assignments set qualifier = 'forecast and flood advice', version = 1
     where activity_id = (select id from public.raci_activities where activity = 'Routine risk monitoring') and actor = 'PAGASA'$$);
select tests.expect_error('the same actor cannot hold the same duty twice on one activity',
  $$insert into public.raci_assignments (activity_id, actor, duty) values ((select id from public.raci_activities where activity = 'Routine risk monitoring'), 'PAGASA', 'C')$$, '23505');
select tests.expect_error('the duty is one of R, A, C, I',
  $$insert into public.raci_assignments (activity_id, actor, duty) values ((select id from public.raci_activities where activity = 'Routine risk monitoring'), 'EOC', 'X')$$, '23514');
select tests.expect_ok('and removes it again',
  $$delete from public.raci_assignments where activity_id = (select id from public.raci_activities where activity = 'Routine risk monitoring') and actor = 'PAGASA'$$);
select tests.expect_eq('linked activities point at real templates',
  (select count(*)::text from public.raci_activities a where a.template_id is not null
     and not exists (select 1 from public.protocol_templates t where t.id = a.template_id)), '0');

-- ===================================================== EOC capability checklist (1.20.0, ADR-035)
reset role;
select tests.expect_eq('the checklist has 154 items, 6 assessed locally',
  (select count(*)::text || ' ' || count(*) filter (where assess_locally)::text from public.eoc_cap_items), '154 6');
select tests.expect_eq('every mapped indicator is a Part B indicator',
  (select count(*)::text from public.eoc_cap_items i, unnest(i.iat_indicators) x
    where not exists (select 1 from public.iat_indicators t where t.id = x and t.id like 'B%')), '0');
select tests.expect_eq('the baseline primary EOC is pre-filled from the IAT, not observed',
  (select count(*) filter (where provenance = 'prefilled_iat')::text || ' ' || count(*) filter (where provenance = 'observed')::text
     from public.eoc_cap_responses where cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3' and site = 'primary'), '154 0');
create temp table cap_ids as
  select (select r.id from public.eoc_cap_responses r join public.eoc_cap_items i on i.id = r.item_id
           where r.cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3' and i.section = 'Site Selection' and i.item_no = 2) as a,
         (select r.id from public.eoc_cap_responses r join public.eoc_cap_items i on i.id = r.item_id
           where r.cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3' and i.section = 'Site Selection' and i.item_no = 3) as b;
grant select on cap_ids to authenticated;
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('a viewer reads the checklist roll-up',
  $$select count(*) from public.v_eoc_cap_domains where cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3' and site = 'primary'$$, 8);
select tests.expect_error('a viewer cannot answer the checklist',
  $$update public.eoc_cap_responses set status = 'met', version = 1 where id = (select a from cap_ids)$$, '42501');
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_ok('an assessor confirms a pre-filled answer on site',
  $$update public.eoc_cap_responses set evidence_observed = 'OBS 14 Nov 2026: confirmed on site.', version = 1 where id = (select a from cap_ids)$$);
select tests.expect_eq('confirming makes the answer observed and records who assessed it',
  (select provenance || ' ' || (assessed_by = '00000000-0000-0000-0000-00000000000b')::text from public.eoc_cap_responses where id = (select a from cap_ids)),
  'observed true');
select tests.expect_error('an assessor cannot validate',
  $$update public.eoc_cap_responses set state = 'validated', version = 2 where id = (select a from cap_ids)$$, '42501');
select tests.expect_error('not applicable needs a reason',
  $$update public.eoc_cap_responses set status = 'not_applicable', gap_remarks = null, version = 2 where id = (select a from cap_ids)$$, '23514');
select tests.expect_error('answers are never deleted',
  $$delete from public.eoc_cap_responses where id = (select a from cap_ids)$$, '42501');
select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_error('a pre-filled answer cannot be validated before it is confirmed',
  $$update public.eoc_cap_responses set state = 'validated', version = 1 where id = (select b from cap_ids)$$, '23514');
select tests.expect_ok('the CDRRMO Head validates an observed answer',
  $$update public.eoc_cap_responses set state = 'validated', version = 2 where id = (select a from cap_ids)$$);
select tests.login('00000000-0000-0000-0000-00000000000b');  -- assessor
select tests.expect_error('a validated answer is fixed',
  $$update public.eoc_cap_responses set status = 'not_met', version = 3 where id = (select a from cap_ids)$$, '42501');
reset role;
-- The pre-fill seed refreshes only pre-filled drafts: the confirmed, validated answer keeps its text.
insert into public.eoc_cap_responses (cycle_id, item_id, site, status, provenance, evidence_observed)
select cycle_id, item_id, site, 'not_met', 'prefilled_iat', 'seed text' from public.eoc_cap_responses where id in ((select a from cap_ids), (select b from cap_ids))
on conflict (cycle_id, item_id, site) do update set status = excluded.status, evidence_observed = excluded.evidence_observed
  where eoc_cap_responses.provenance = 'prefilled_iat' and eoc_cap_responses.state = 'draft';
select tests.expect_eq('a re-run pre-fill leaves observed answers alone and refreshes pre-filled ones',
  (select string_agg(provenance || ':' || left(evidence_observed, 9), ' ' order by provenance) from public.eoc_cap_responses where id in ((select a from cap_ids), (select b from cap_ids))),
  'observed:OBS 14 No prefilled_iat:seed text');
select tests.expect_eq('the roll-up counts the observed answer under its domain',
  (select sum(observed)::text from public.v_eoc_cap_domains where cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3' and site = 'primary' and domain = 'B2'), '1');

reset role;
select tests.expect_eq('audit trail recorded', ((select count(*) from public.audit_log) > 50)::text, 'true');
\o
select format('%s checks passed', count(*)) as summary from tests.results where ok;
