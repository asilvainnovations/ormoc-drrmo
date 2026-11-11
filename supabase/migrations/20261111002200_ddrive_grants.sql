-- 1.12.2: DDRiVE grants and view security (production readiness audit, 11 Nov 2026).
--
-- 20261110002100_ddrive_base.sql relied on Supabase's default privileges, which give anon and
-- authenticated every privilege on a new public table. RLS kept the rows safe, but:
--   1. v_ddrive_city_risk was created without security_invoker, so on Postgres 15+ it ran as its
--      owner and skipped RLS: a signed-out visitor holding the default grant could read it
--      through the API. Every other view in MODE is security_invoker (ADR-004, ADR-009).
--   2. The tables are read-only reference data (src/lib/tables.ts: write 'none'), yet
--      authenticated kept INSERT, UPDATE, DELETE and TRUNCATE.
--   3. A database without those default privileges (plain Postgres, the test stub) granted
--      nothing, so active users could not read the layer at all (CI SQL suite, 10 Nov 2026).
--
-- After this migration: active users read (RLS: app.is_active_user()); nobody writes through
-- the API; signed-out visitors read nothing. Reference rows change only through seed part 26
-- (scripts/ddrive_seed.py), run in the SQL editor. Safe to run again.

alter view public.v_ddrive_city_risk set (security_invoker = true);

do $$
declare t text;
begin
  foreach t in array array['ddrive_barangay_profiles', 'ddrive_flood', 'ddrive_hazards',
                           'ddrive_exposure', 'ddrive_vulnerability', 'ddrive_priority',
                           'ddrive_city_scores', 'ddrive_risk_matrix', 'ddrive_sources'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.v_ddrive_city_risk from anon;
grant select on public.v_ddrive_city_risk to authenticated;
