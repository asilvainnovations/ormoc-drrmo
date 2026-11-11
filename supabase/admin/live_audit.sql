-- Read-only production readiness check of a live MODE database (audit 11 Nov 2026).
--
-- Run it in the Supabase SQL editor of the project (production or training), or with
-- scripts/live_audit.sh over the session pooler. Run supabase/migrations/migration_status.sql
-- first: it lists which migrations are applied. Keep both results with the audit record.
--
-- This file reads only. It returns counts and settings, never names, emails or record text
-- (RA 10173). Each section says what a healthy result looks like.

-- 1. Reference data. Expected:
--    140 | 18 | 935 | 71 | 28 | 197 | 29 | 10 | 140 | 50    (parts 1-25, 1.11.0)
select 'reference data' as check_name,
       (select count(*) from public.iat_indicators)         as indicators,
       (select count(*) from public.master_requirements)    as requirements,
       (select count(*) from public.indicator_requirements) as indicator_links,
       (select count(*) from public.framework_crosswalk)    as crosswalk,
       (select count(*) from public.protocol_templates)     as protocols,
       (select count(*) from public.protocol_steps)         as protocol_steps,
       (select count(*) from public.aa_action_templates)    as aa_actions,
       (select count(*) from public.manual_areas)           as manual_areas,
       (select count(*) from public.iat_indicators where functional_area is not null) as indicators_with_area,
       (select count(*) from public.form_templates)         as forms;

-- 2. DDRiVE base layer (part 26, 1.12.1). Expected: 85 | 85 | 85 | 85 | 85 | 85 | 10 | 25 | 31.
--    If the migration is missing this section fails with "relation does not exist": run the
--    rest of the file from section 3.
select 'ddrive' as check_name,
       (select count(*) from public.ddrive_barangay_profiles) as profiles,
       (select count(*) from public.ddrive_flood)             as flood,
       (select count(*) from public.ddrive_hazards)           as hazards,
       (select count(*) from public.ddrive_exposure)          as exposure,
       (select count(*) from public.ddrive_vulnerability)     as vulnerability,
       (select count(*) from public.ddrive_priority)          as priority,
       (select count(*) from public.ddrive_city_scores)       as city_scores,
       (select count(*) from public.ddrive_risk_matrix)       as matrix,
       (select count(*) from public.ddrive_sources)           as sources;

-- 3. Tables in public without Row Level Security. Expected: no rows.
select 'rls off' as check_name, c.relname as table_name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
order by 2;

-- 4. Tables with RLS on but no policy (nobody can read them). Expected: no rows, or only
--    tables that are meant to be reached through RPCs alone.
select 'rls on, no policy' as check_name, c.relname as table_name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
order by 2;

-- 5. Policies open to anon or public (signed-out visitors). Expected: no rows.
select 'policy for anon/public' as check_name, c.relname as table_name, p.polname as policy
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (p.polroles = '{0}'::oid[] or 'anon'::regrole::oid = any (p.polroles))
order by 2, 3;

-- 6. Legal and financial records that still allow DELETE or TRUNCATE (ADR-013).
--    Expected: every row "ok".
select 'no delete on legal records' as check_name, t.tbl,
       case when has_table_privilege('authenticated', t.tbl, 'DELETE') then 'DELETE STILL GRANTED' else 'ok' end as delete_check,
       case when has_table_privilege('authenticated', t.tbl, 'TRUNCATE') then 'TRUNCATE STILL GRANTED' else 'ok' end as truncate_check
from unnest(array['public.declarations', 'public.aa_disbursements', 'public.pdra_sessions', 'public.aa_fund_years',
                  'public.logbook_entries', 'public.sitreps', 'public.vault_documents', 'public.audit_log',
                  'public.resource_requests']) as t(tbl)
where to_regclass(t.tbl) is not null;

-- 7. SECURITY DEFINER functions in app or public without a fixed search_path.
--    Expected: no rows.
select 'definer without search_path' as check_name, n.nspname || '.' || p.proname as function_name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app', 'public') and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
order by 2;

-- 8. Storage buckets. Expected: evidence, vault and geo private; basemap as ADR-015 decides.
select 'storage bucket' as check_name, id as bucket, public as is_public, file_size_limit
from storage.buckets order by id;

-- 9. Accounts and roles (counts only). Expected: at least one cdrrmo_head and one admin;
--    admin held by as few accounts as possible; developer access within its end date.
select 'accounts' as check_name,
       (select count(*) from public.profiles) as accounts,
       (select count(distinct user_id) from public.user_roles) as accounts_with_a_role,
       (select count(*) from public.profiles p
         where not exists (select 1 from public.user_roles r where r.user_id = p.id)) as awaiting_approval;
select 'role holders' as check_name, role::text as role, count(*) as holders
from public.user_roles group by role order by role;

-- 10. IAT baseline as the platform computes it, per cycle. Compare with the workbook
--     Dashboard and record which figure is the controlled one (audit 11 Nov 2026: the
--     evidence gate holds 15 items, so expect an IMI near 1.98, not the workbook's 2.13).
select 'iat results' as check_name, c.name as cycle, c.status, r.grp, r.scored,
       r.maturity_index, r.maturity_band, r.mandatory_compliance, r.high_gaps
from public.v_cycle_results r join public.assessment_cycles c on c.id = r.cycle_id
order by c.cycle_year, c.name, r.grp;

-- 11. Crash reports in the last 7 days (Settings -> Error reports). Expected: low and falling.
select 'client errors, 7 days' as check_name, app_version, count(*) as reports
from public.client_errors where received_at > now() - interval '7 days'
group by app_version order by app_version;

-- 12. Database and extensions, for the ICT asset register.
select 'postgres' as check_name, current_setting('server_version') as version,
       (select string_agg(extname || ' ' || extversion, ', ' order by extname) from pg_extension) as extensions;
