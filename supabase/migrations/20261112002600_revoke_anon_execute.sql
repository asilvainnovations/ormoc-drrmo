-- 1.14.0 (12 Nov 2026), security check C11: signed-out visitors cannot call the platform's actions.
--
-- Postgres lets everyone (PUBLIC) execute a new function. Each function below already refuses a caller without
-- the right role, so nothing was open; this is defence in depth: the database now refuses a signed-out caller
-- before the function runs. Signed-in users keep EXECUTE (each function still checks their role).
-- Left public on purpose: aa_rule (published RA 12287 parameters, read by guards), the pure scoring helpers
-- (evidence_cap, gap_priority_score, priority_band, maturity_band), aa_days_text and pdra_lead_hours.
-- Safe to run again.

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('set_eoc_level', 'activate_contingency_plan', 'start_protocol', 'load_aa_checklist',
                         'admin_list_accounts', 'connected_app_status', 'my_account', 'my_roles')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;
