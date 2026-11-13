-- Which migrations this database has (audit 31 Oct 2026, #20).
--
-- Migrations are run by hand in the SQL editor, so Supabase keeps no record of them. This
-- query looks for one object that each migration creates. Run it in the SQL editor of any
-- project (production, training) before an update, and keep the result with the update
-- record. Add a line here with every new migration.
--
-- Read-only. Safe to run at any time. The Supabase SQL editor shows only the last result, so the
-- migration list comes last (1.13.0); the grants check runs first.
-- Grants that must hold on a real Supabase project (ADR-013). Every row should say "ok".
select t.tbl,
       case when has_table_privilege('authenticated', t.tbl, 'DELETE') then 'DELETE STILL GRANTED' else 'ok' end as delete_check,
       case when has_table_privilege('authenticated', t.tbl, 'TRUNCATE') then 'TRUNCATE STILL GRANTED' else 'ok' end as truncate_check
from unnest(array['public.declarations', 'public.aa_disbursements', 'public.pdra_sessions', 'public.aa_fund_years',
                  'public.logbook_entries', 'public.sitreps', 'public.vault_documents', 'public.audit_log',
                  'public.connected_apps', 'public.form_templates', 'public.eoc_designations', 'public.activation_clusters',
                  'public.geo_reference_points', 'public.geo_layers', 'public.eoc_assessment_items']) as t(tbl);

select m.migration, case when m.present then 'applied' else 'MISSING' end as status
from (values
  ('20261015000100_core',                     to_regclass('public.profiles') is not null),
  ('20261015000200_iat',                      to_regclass('public.responses') is not null),
  ('20261015000300_moo_protocols',            to_regclass('public.protocol_templates') is not null),
  ('20261015000400_eoc',                      to_regclass('public.sitreps') is not null),
  ('20261015000500_anticipatory_action',      to_regclass('public.declarations') is not null),
  ('20261015000600_storage',                  exists (select 1 from storage.buckets where id = 'evidence')),
  ('20261015000700_record_integrity',         to_regprocedure('app.lock_run_step_snapshot()') is not null),
  ('20261016000800_document_vault',           to_regclass('public.vault_documents') is not null),
  ('20261016000900_accounts_and_integrity',   to_regprocedure('public.admin_list_accounts()') is not null),
  ('20261031001000_oauth_clients_read_only',  to_regprocedure('app.block_oauth_client_writes()') is not null),
  ('20261031001100_resource_request_lock',    to_regprocedure('app.lock_resource_request()') is not null),
  ('20261102001200_single_manual',            to_regclass('public.manual_parts') is not null),
  ('20261105001300_barangay_report_counts',   exists (select 1 from pg_constraint where conname = 'barangay_reports_evacuating_counts')),
  ('20261105001400_record_integrity_2',       exists (select 1 from information_schema.columns
                                                      where table_schema = 'public' and table_name = 'protocol_runs' and column_name = 'template_status')),
  ('20261105001500_client_errors',            to_regclass('public.client_errors') is not null),
  ('20261106001600_vault_access_and_connected_apps', to_regclass('public.connected_apps') is not null),
  ('20261106001700_step_forms',               to_regclass('public.form_templates') is not null),
  ('20261106001800_eoc_structure_and_clusters', to_regclass('public.eoc_designations') is not null),
  ('20261106001900_geo_cop',                  to_regclass('public.geo_layers') is not null),
  ('20261108002000_sop_registry',             to_regclass('public.v_indicator_sops') is not null),
  ('20261110002100_ddrive_base',              to_regclass('public.v_ddrive_city_risk') is not null),
  ('20261111002200_ddrive_grants',            coalesce((select reloptions from pg_class
                                                        where oid = to_regclass('public.v_ddrive_city_risk')), '{}')
                                              @> array['security_invoker=true']),
  ('20261111002300_band_unrounded',           coalesce(pg_get_viewdef(to_regclass('public.v_cycle_results')), '')
                                              not like '%maturity_band(round(%'),
  ('20261111002400_evidence_check',           exists (select 1 from information_schema.columns
                                                      where table_schema = 'public' and table_name = 'responses' and column_name = 'evidence_check')),
  ('20261111002500_ra12287_alignment',        exists (select 1 from information_schema.columns
                                                      where table_schema = 'public' and table_name = 'declarations' and column_name = 'hazard_occurred_at')),
  ('20261112002600_revoke_anon_execute',      not has_function_privilege('anon',
                                                      (select oid from pg_proc where proname = 'set_eoc_level' and pronamespace = 'public'::regnamespace limit 1), 'EXECUTE')),
  ('20261112002700_validation_workshop',      exists (select 1 from information_schema.columns
                                                      where table_schema = 'public' and table_name = 'responses' and column_name = 'validation_decision')),
  ('20261112002800_echo_camp_management',     exists (select 1 from information_schema.tables
                                                      where table_schema = 'public' and table_name = 'camp_reports')),
  -- 1.19.0: checks the guard, not just the tables, so a database that ran the pre-review copy shows false.
  ('20261113002900_raci_board',               exists (select 1 from pg_proc
                                                      where proname = 'guard_raci' and pronamespace = 'app'::regnamespace)),
  -- 1.20.0: checks the guard, not just the tables.
  -- checks a column added in review, so a database that ran the pre-review copy shows false until it is re-run
  ('20261114003000_eoc_assessment',           exists (select 1 from information_schema.columns
                                                      where table_schema = 'public' and table_name = 'eoc_assessment_responses' and column_name = 'provenance'))
) as m(migration, present)
order by m.migration;
