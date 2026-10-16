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
  $$update public.declarations set status = 'lifted', lifting_ground = 'impacts_not_met', lifting_basis = 'PDRA #3', version = 4 where id = '80000000-0000-0000-0000-000000000001'$$);
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

-- ================================================ Protocols ==================
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_error('viewer cannot start a protocol',
  $$select public.start_protocol((select id from public.protocol_templates where code = 'PR-WARNING-DISSEM'))$$, '42501');
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
select tests.expect_ok('complete every step',
  $$update public.protocol_run_steps set status = 'done', note = 'done', version = version where run_id = '90000000-0000-0000-0000-000000000001'$$);
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
select tests.login('00000000-0000-0000-0000-000000000010');  -- viewer
select tests.expect_rows('viewer sees approved text only',
  $$select count(*) from public.moo_versions where document_id = (select id from public.moo_documents where code = 'EOC Ch.2')$$, 1);

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
select tests.expect_rows('a validator reads the vault', $$select count(*) from public.vault_documents$$, 1);
select tests.expect_rows('a validator cannot change someone else''s document',
  $$with u as (update public.vault_documents set title = 'Changed' where id = '70000000-0000-0000-0000-000000000001' returning 1) select count(*) from u$$, 0);
select tests.expect_error('nor upload into its folder',
  $$insert into storage.objects (bucket_id, name, owner) values ('vault', '70000000-0000-0000-0000-000000000001/x.pdf', auth.uid())$$, '42501');

select tests.login('00000000-0000-0000-0000-000000000011');  -- CDRRMO Head
select tests.expect_ok('the CDRRMO Head marks a document superseded',
  $$update public.vault_documents set status = 'superseded', version = version where id = '70000000-0000-0000-0000-000000000001'$$);

select tests.login('00000000-0000-0000-0000-00000000000e');  -- duty officer (CDRRMO staff)
select tests.expect_rows('CDRRMO staff read the vault', $$select count(*) from public.vault_documents$$, 1);
select tests.expect_rows('and its files', $$select count(*) from storage.objects where bucket_id = 'vault'$$, 1);

select tests.login('00000000-0000-0000-0000-00000000000a');  -- admin
select tests.expect_rows('an admin reads the vault', $$select count(*) from public.vault_documents$$, 1);

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
  ('80000000-0000-0000-0000-000000000009', 'tropical_cyclone', now() + interval '6 hours');
select tests.expect_error('a City request needs a PDRA that decided to request a declaration',
  $$update public.declarations set status = 'requested', version = 1 where id = '80000000-0000-0000-0000-000000000009'$$, '23514');
insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, conducted_at, impact_class, decision, decision_basis)
values ('70000000-0000-0000-0000-000000000009', 'tropical_cyclone', 'PAGASA TCB #1', now() - interval '5 days', now() + interval '6 hours',
        now() - interval '4 days', 'severe', 'request_declaration', 'backdated PDRA');
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

reset role;
select tests.expect_eq('audit trail recorded', ((select count(*) from public.audit_log) > 50)::text, 'true');
\o
select format('%s checks passed', count(*)) as summary from tests.results where ok;
