-- =============================================================================
-- 1.7.0: Record integrity, part 2 (audit 31 Oct 2026, findings 4, 5 and 6).
--
-- 4. Protocols and the IRR checklist
--    * Only the CDRRMO Head approves, retires or reopens a protocol (mirrors
--      app.guard_moo_document). An approved protocol's text and steps are fixed; to revise
--      it the Head sets it back to draft, the author edits, the Head approves again.
--    * Steps can be added, changed or removed only while their protocol is a draft.
--    * start_protocol(): a draft protocol runs as a drill for anyone who runs protocols.
--      A live run of a draft needs the EOC Manager or the CDRRMO Head (so an emergency
--      before the December validation is not blocked). Every run records whether its
--      protocol was approved or a draft when it started (protocol_runs.template_status).
--    * The AA checklist templates come from IRR Rule IV. Only the CDRRMO Head changes them,
--      and they are deactivated (is_active = false), never deleted.
-- 5. The PDRA behind a declaration request
--    * Once a declaration that cites a PDRA has left draft, the PDRA is fixed. A changed
--      forecast is a new PDRA.
--    * conducted_at (which sets the lead time tested against the 72 h rule) is accepted
--      from a device only within the last 24 hours and up to 5 minutes ahead, as for
--      declarations; otherwise the server's time is used. It never changes after insert.
-- 4a. Library documents (found while fixing 4)
--    * app.guard_moo_document was SECURITY DEFINER, so its test "current_user is an API
--      role" never held and its role checks never ran: an author could mark a document
--      approved or point it back to an older approved version. It now runs as the caller
--      (SECURITY INVOKER). Inside promote_moo_version, which runs as the owner, the Head's
--      approval still promotes the version. The two new protocol guards work the same way.
-- 6. Deletes
--    * A Supabase project grants ALL on public tables to anon and authenticated by default.
--      The FOR ALL policies on PDRAs, declarations, AA funds, disbursements, the AA
--      checklist and protocol templates therefore allowed deletes. They are replaced with
--      one policy per command, and DELETE is revoked on every legal, financial and
--      operational record. TRUNCATE (which RLS does not cover) is revoked on every table.
--    * The logbook and barangay reports are insert-only: UPDATE is revoked too, so an edit
--      is refused rather than silently matching no rows.
--
-- After running this on the live project, check the grants:
--   \dp public.declarations      -- authenticated: no "d" (delete) and no "D" (truncate)
--
-- Supports MR-05 (anticipatory action), MR-06 (protocols), MR-15 (records and audit).
-- Safe to run again.
-- =============================================================================

-- ---------------------------------------------------------------- 4a. Library documents
-- current_user must be the caller for the role check to run (see the header).
alter function app.guard_moo_document() security invoker;

-- ---------------------------------------------------------------- 4. protocols
alter table public.protocol_runs add column if not exists template_status text
  check (template_status in ('draft', 'approved'));
comment on column public.protocol_runs.template_status is 'Status of the protocol when this run started (draft protocols run as drills or by the EOC Manager / CDRRMO Head).';

create or replace function app.guard_protocol_template() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  -- Seeds and the SQL editor run as the table owner; API calls run as anon/authenticated.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not app.has_role('cdrrmo_head') then
      raise exception 'A new protocol starts as a draft. Only the CDRRMO Head approves it.' using errcode = '42501';
    end if;
    new.template_rev := 1;
    return new;
  end if;
  new.template_rev := old.template_rev;        -- moved only by the step trigger
  if new.status is distinct from old.status and not app.has_role('cdrrmo_head') then
    raise exception 'Only the CDRRMO Head can approve, retire or reopen a protocol.' using errcode = '42501';
  end if;
  if old.status <> 'draft' and new.status = old.status
     and row(new.code, new.title, new.purpose, new.trigger_text, new.document_id, new.owner_role, new.category)
         is distinct from row(old.code, old.title, old.purpose, old.trigger_text, old.document_id, old.owner_role, old.category) then
    raise exception 'This protocol is %. Its text is fixed; the CDRRMO Head sets it back to draft to revise it.', old.status
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_protocol_template on public.protocol_templates;
create trigger guard_protocol_template before insert or update on public.protocol_templates
  for each row execute function app.guard_protocol_template();

create or replace function app.guard_protocol_step() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_status text;
begin
  if current_user not in ('authenticated', 'anon') then return coalesce(new, old); end if;
  select status into v_status from public.protocol_templates where id = coalesce(new.template_id, old.template_id);
  if v_status is distinct from 'draft' then
    raise exception 'Steps change only while the protocol is a draft. The CDRRMO Head sets it back to draft to revise it.'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.template_id is distinct from old.template_id then
    raise exception 'A step cannot move to another protocol' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists guard_protocol_step on public.protocol_steps;
create trigger guard_protocol_step before insert or update or delete on public.protocol_steps
  for each row execute function app.guard_protocol_step();

-- Same signature as before, so the grant and offline replays are unchanged.
create or replace function public.start_protocol(p_template uuid, p_title text default null,
  p_context_type text default 'none', p_context_id uuid default null, p_run_id uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t public.protocol_templates; v_now timestamptz := now();
begin
  if not app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Your role cannot start protocols' using errcode = '42501';
  end if;
  if exists (select 1 from public.protocol_runs where id = p_run_id) then
    return p_run_id;  -- idempotent: a replayed offline request is a no-op
  end if;
  select * into v_t from public.protocol_templates where id = p_template;
  if v_t.id is null then raise exception 'Protocol not found' using errcode = 'P0002'; end if;
  if v_t.status = 'retired' then raise exception 'This protocol is retired' using errcode = '22023'; end if;
  if v_t.status = 'draft' and coalesce(p_context_type, 'none') <> 'drill'
     and not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'This protocol is still a draft. Run it as a drill, or ask the EOC Manager or CDRRMO Head to start it.'
      using errcode = '42501';
  end if;
  insert into public.protocol_runs (id, template_id, template_rev, template_status, title, context_type, context_id, started_at)
  values (p_run_id, v_t.id, v_t.template_rev, v_t.status, coalesce(p_title, v_t.title), p_context_type, p_context_id, v_now);
  -- Step ids are UUIDv5(namespace = run id, name = seq) so an offline client can
  -- compute the same ids before the run reaches the server.
  insert into public.protocol_run_steps (id, run_id, step_id, seq, instruction, is_critical, requires_note, due_at)
  select extensions.uuid_generate_v5(p_run_id, s.seq::text), p_run_id, s.id, s.seq, s.instruction, s.is_critical, s.requires_note,
         case when s.due_offset_minutes is not null then v_now + make_interval(mins => s.due_offset_minutes) end
  from public.protocol_steps s where s.template_id = v_t.id order by s.seq;
  return p_run_id;
end $$;

-- The run's protocol, revision and status are the server's.
create or replace function app.lock_protocol_run_keys() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.template_id := old.template_id; new.template_rev := old.template_rev; new.template_status := old.template_status;
  new.started_by := old.started_by; new.started_at := old.started_at;
  return new;
end $$;
drop trigger if exists aaa_lock_protocol_run_keys on public.protocol_runs;
create trigger aaa_lock_protocol_run_keys before update on public.protocol_runs
  for each row execute function app.lock_protocol_run_keys();

drop policy if exists ptpl_write  on public.protocol_templates;
drop policy if exists ptpl_insert on public.protocol_templates;
drop policy if exists ptpl_update on public.protocol_templates;
create policy ptpl_insert on public.protocol_templates for insert to authenticated
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy ptpl_update on public.protocol_templates for update to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

drop policy if exists psteps_write  on public.protocol_steps;
drop policy if exists psteps_insert on public.protocol_steps;
drop policy if exists psteps_update on public.protocol_steps;
drop policy if exists psteps_delete on public.protocol_steps;
create policy psteps_insert on public.protocol_steps for insert to authenticated
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy psteps_update on public.protocol_steps for update to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
-- A draft protocol's steps can be removed (the guard refuses once it is approved).
create policy psteps_delete on public.protocol_steps for delete to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

-- AA checklist templates (IRR Rule IV): the CDRRMO Head only; deactivate, never delete.
drop policy if exists aa_tpl_write  on public.aa_action_templates;
drop policy if exists aa_tpl_insert on public.aa_action_templates;
drop policy if exists aa_tpl_update on public.aa_action_templates;
create policy aa_tpl_insert on public.aa_action_templates for insert to authenticated
  with check (app.has_role('cdrrmo_head'));
create policy aa_tpl_update on public.aa_action_templates for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));

-- ---------------------------------------------------------------- 5. PDRA
create or replace function app.stamp_pdra() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.conducted_at is null or new.conducted_at < now() - interval '24 hours' or new.conducted_at > now() + interval '5 minutes' then
      new.conducted_at := now();
    end if;
    return new;
  end if;
  new.conducted_at := old.conducted_at;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if exists (select 1 from public.declarations d where d.pdra_id = old.id and d.status <> 'draft')
     and (to_jsonb(new) - array['updated_at', 'version']) is distinct from (to_jsonb(old) - array['updated_at', 'version']) then
    raise exception 'This PDRA supports a declaration request and is fixed. Record a new PDRA for a changed forecast.'
      using errcode = '42501';
  end if;
  return new;
end $$;
-- "aaa_" so it runs before guard_pdra_decision, which reads conducted_at.
drop trigger if exists aaa_stamp_pdra on public.pdra_sessions;
create trigger aaa_stamp_pdra before insert or update on public.pdra_sessions
  for each row execute function app.stamp_pdra();

-- ---------------------------------------------------------------- 6. policies
drop policy if exists pdra_write  on public.pdra_sessions;
drop policy if exists pdra_insert on public.pdra_sessions;
drop policy if exists pdra_update on public.pdra_sessions;
create policy pdra_insert on public.pdra_sessions for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));
create policy pdra_update on public.pdra_sessions for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));

drop policy if exists decl_write  on public.declarations;
drop policy if exists decl_insert on public.declarations;
drop policy if exists decl_update on public.declarations;
create policy decl_insert on public.declarations for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy decl_update on public.declarations for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));

drop policy if exists fund_write  on public.aa_fund_years;
drop policy if exists fund_insert on public.aa_fund_years;
drop policy if exists fund_update on public.aa_fund_years;
create policy fund_insert on public.aa_fund_years for insert to authenticated with check (app.has_role('cdrrmo_head'));
create policy fund_update on public.aa_fund_years for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));

drop policy if exists disb_write  on public.aa_disbursements;
drop policy if exists disb_insert on public.aa_disbursements;
drop policy if exists disb_update on public.aa_disbursements;
create policy disb_insert on public.aa_disbursements for insert to authenticated with check (app.has_role('cdrrmo_head'));
create policy disb_update on public.aa_disbursements for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));

-- ---------------------------------------------------------------- 6. grants
-- Records that are corrected or superseded, never deleted.
revoke delete on
  public.pdra_sessions, public.declarations, public.aa_actions, public.aa_fund_years, public.aa_disbursements,
  public.aa_rules, public.aa_action_templates,
  public.protocol_templates, public.protocol_runs, public.protocol_run_steps,
  public.eoc_activations, public.sitreps, public.resource_requests, public.incidents,
  public.logbook_entries, public.barangay_reports,
  public.vault_documents, public.audit_log
from anon, authenticated;

-- Append-only: corrections are new rows.
revoke update on public.logbook_entries, public.barangay_reports, public.audit_log from anon, authenticated;

-- TRUNCATE bypasses row-level security. No API role needs it on any table.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke truncate on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
