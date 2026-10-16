-- =============================================================================
-- 0009 ACCOUNTS AND RECORD INTEGRITY (v1.2)
--
-- 1. Open self sign-up with administrator approval. Anyone may create an account;
--    it reads nothing until an administrator grants a role. "Active user" now means
--    an active profile WITH at least one role (previously: any active profile, which
--    every new sign-up was).
-- 2. Administrator account list with the verified email, so an approver never relies
--    on a self-typed name.
-- 3. Server-side stamps for who did what, and locks on finalised assessment cycles,
--    approved manual text, resource requests, declarations and AA funds.
-- Safe to run once on a 1.1 database (every statement replaces or adds).
-- =============================================================================
set client_min_messages = warning;

-- ------------------------------------------------------------ 1. approval ----
create or replace function app.is_active_user() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
      and exists (select 1 from public.user_roles ur where ur.user_id = p.id)
  )
$$;

-- Roles of an active user only; a deactivated account gets none (the client then
-- shows the "account not active" screen instead of screens it cannot use).
create or replace function public.my_roles() returns setof public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select ur.role from public.user_roles ur
  join public.profiles p on p.id = ur.user_id and p.is_active
  where ur.user_id = auth.uid()
$$;

-- A new account keeps the name and position typed at sign-up (shown to the approver
-- next to the verified email). It has no role, so it reads nothing.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, position)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          nullif(left(coalesce(new.raw_user_meta_data->>'position', ''), 120), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- Status of the signed-in account, readable while pending approval.
create or replace function public.my_account() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'position', p.position, 'is_active', p.is_active,
    'roles', coalesce((select jsonb_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = p.id), '[]'::jsonb))
  from public.profiles p where p.id = auth.uid()
$$;
grant execute on function public.my_account() to authenticated;
revoke execute on function public.my_account() from anon;

-- Accounts for the administrator's Users screen, with the email the person verified.
create or replace function public.admin_list_accounts()
returns table (id uuid, email text, email_confirmed_at timestamptz, created_at timestamptz, last_sign_in_at timestamptz,
               full_name text, "position" text, office_id uuid, is_active boolean, roles public.app_role[], version integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.has_role('admin') then
    raise exception 'Only an administrator can list accounts' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, u.email_confirmed_at, u.created_at, u.last_sign_in_at,
         p.full_name, p.position, p.office_id, p.is_active,
         coalesce(array(select ur.role from public.user_roles ur where ur.user_id = p.id order by ur.role), '{}'),
         p.version
  from public.profiles p join auth.users u on u.id = p.id
  order by (not exists (select 1 from public.user_roles ur where ur.user_id = p.id)) desc, u.created_at desc;
end $$;
grant execute on function public.admin_list_accounts() to authenticated;
revoke execute on function public.admin_list_accounts() from anon;

-- Role grants: only to a verified email; an administrator cannot lock themselves out.
create or replace function app.guard_user_roles() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_confirmed timestamptz;
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- SQL editor / migrations
  if tg_op = 'INSERT' then
    select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
    if v_confirmed is null then
      raise exception 'This person has not confirmed their email address yet. Approve the account after they confirm it.'
        using errcode = '42501';
    end if;
    new.granted_by := auth.uid();
    new.granted_at := now();
    return new;
  end if;
  if old.user_id = auth.uid() and old.role = 'admin' then
    raise exception 'You cannot remove your own administrator role. Ask another administrator.' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists guard_user_roles on public.user_roles;
create trigger guard_user_roles before insert or delete on public.user_roles
  for each row execute function app.guard_user_roles();

-- Self-edits: office and active flag are admin-only (as before). Name and position
-- may be filled in while the account waits for approval; after approval they are
-- changed by an administrator, so records keep a trustworthy name.
create or replace function app.guard_profile_self_edit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() = new.id and not app.has_role('admin') then
    if new.is_active is distinct from old.is_active or new.office_id is distinct from old.office_id then
      raise exception 'Only an administrator can change office or active status' using errcode = '42501';
    end if;
    if (new.full_name is distinct from old.full_name or new.position is distinct from old.position)
       and exists (select 1 from public.user_roles where user_id = new.id) then
      raise exception 'Ask an administrator to change your name or position.' using errcode = '42501';
    end if;
  end if;
  if auth.uid() = old.id and old.is_active and not new.is_active then
    raise exception 'You cannot deactivate your own account.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ------------------------------------------------- 2. who did what -----------
-- Attribution columns are set by the server from the signed-in user, never by the
-- client: on insert the column becomes auth.uid(); on update it keeps its value.
-- Runs first among the BEFORE triggers (name order).
create or replace function app.stamp_actor() returns trigger
language plpgsql as $$
declare c text;
begin
  if auth.uid() is null then return new; end if;
  foreach c in array tg_argv loop
    if tg_op = 'INSERT' then
      new := jsonb_populate_record(new, jsonb_build_object(c, auth.uid()));
    else
      new := jsonb_populate_record(new, jsonb_build_object(c, to_jsonb(old) -> c));
    end if;
  end loop;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('assessment_cycles', 'created_by'), ('responses', 'assessed_by'), ('evidence', 'captured_by'),
    ('incidents', 'created_by'), ('sitreps', 'prepared_by'), ('barangay_reports', 'reported_by'),
    ('resource_requests', 'created_by'), ('pdra_sessions', 'created_by'), ('declarations', 'created_by'),
    ('aa_disbursements', 'created_by')) t(tbl, col)
  loop
    execute format('drop trigger if exists aaa_stamp_actor on public.%I', r.tbl);
    execute format('create trigger aaa_stamp_actor before insert or update on public.%I for each row execute function app.stamp_actor(%L)', r.tbl, r.col);
  end loop;
end $$;

-- Approval and validation stamps exist only through the approval itself: a client
-- cannot pre-fill them. The workflow triggers (guard_sitrep, guard_response_workflow,
-- guard_moo_version) set them at the moment of approval.
create or replace function app.reset_approval_stamps() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'sitreps' then
    if tg_op = 'INSERT' then new.submitted_at := null; new.approved_by := null; new.approved_at := null;
    else new.submitted_at := old.submitted_at; new.approved_by := old.approved_by; new.approved_at := old.approved_at; end if;
  elsif tg_table_name = 'responses' then
    if tg_op = 'INSERT' then new.validated_by := null; new.validated_at := null;
    else new.validated_by := old.validated_by; new.validated_at := old.validated_at; end if;
  elsif tg_table_name = 'moo_versions' then
    if tg_op = 'INSERT' then new.approved_by := null; new.approved_at := null;
    else new.approved_by := old.approved_by; new.approved_at := old.approved_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists aab_reset_approval_stamps on public.sitreps;
create trigger aab_reset_approval_stamps before insert or update on public.sitreps for each row execute function app.reset_approval_stamps();
drop trigger if exists aab_reset_approval_stamps on public.responses;
create trigger aab_reset_approval_stamps before insert or update on public.responses for each row execute function app.reset_approval_stamps();
drop trigger if exists aab_reset_approval_stamps on public.moo_versions;
create trigger aab_reset_approval_stamps before insert or update on public.moo_versions for each row execute function app.reset_approval_stamps();

-- Protocol steps and AA actions: "done by" is whoever marked it, at the server's time.
create or replace function app.stamp_run_step() returns trigger
language plpgsql as $$
begin
  if new.status <> 'pending' and old.status = 'pending' then
    new.done_by := coalesce(auth.uid(), new.done_by); new.done_at := now();
  elsif new.status = 'pending' then
    new.done_by := null; new.done_at := null;
  else
    new.done_by := old.done_by; new.done_at := old.done_at;
  end if;
  return new;
end $$;

create or replace function app.stamp_aa_action() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_by := coalesce(auth.uid(), new.done_by); new.done_at := now();
  elsif new.status <> 'done' then
    new.done_by := null; new.done_at := null;
  else
    new.done_by := old.done_by; new.done_at := old.done_at;
  end if;
  return new;
end $$;

-- ------------------------------------------------ 3. assessment cycles -------
-- Finalising, archiving and reopening are the validator's or CDRRMO Head's call;
-- a final cycle only moves on to archived. Deleting a cycle is admin-only and never
-- for a final or archived cycle or one with validated scores.
create or replace function app.guard_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('final','archived') or exists (select 1 from public.responses where cycle_id = old.id and status = 'validated') then
      raise exception 'A % cycle or one with validated scores cannot be deleted. Archive it instead.', old.status using errcode = '42501';
    end if;
    return old;
  end if;
  if auth.uid() is null or app.has_role('admin') then return new; end if;
  if old.status in ('final','archived') then
    if not (old.status = 'final' and new.status = 'archived'
            and app.has_any_role(array['validator','cdrrmo_head']::public.app_role[])) then
      raise exception 'This assessment cycle is %. Open a new cycle to record changes.', old.status using errcode = '42501';
    end if;
  elsif new.status in ('final','archived') and not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only a validator or the CDRRMO Head can finalise an assessment cycle' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_cycle on public.assessment_cycles;
create trigger guard_cycle before update or delete on public.assessment_cycles
  for each row execute function app.guard_cycle();

drop policy if exists cycles_write on public.assessment_cycles;
drop policy if exists cycles_insert on public.assessment_cycles;
drop policy if exists cycles_update on public.assessment_cycles;
drop policy if exists cycles_delete on public.assessment_cycles;
create policy cycles_insert on public.assessment_cycles for insert to authenticated
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]));
create policy cycles_update on public.assessment_cycles for update to authenticated
  using (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]));
create policy cycles_delete on public.assessment_cycles for delete to authenticated using (app.has_role('admin'));

-- A response or action stays in the cycle and on the indicator it was created for.
create or replace function app.lock_cycle_keys() returns trigger
language plpgsql as $$
begin
  if new.cycle_id is distinct from old.cycle_id or new.indicator_id is distinct from old.indicator_id then
    raise exception 'A record cannot be moved to another cycle or indicator' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists lock_cycle_keys on public.responses;
create trigger lock_cycle_keys before update on public.responses for each row execute function app.lock_cycle_keys();
drop trigger if exists lock_cycle_keys on public.actions;
create trigger lock_cycle_keys before update on public.actions for each row execute function app.lock_cycle_keys();

-- Closed-cycle check looks at the cycle before and after the change.
create or replace function app.guard_closed_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cycles uuid[];
begin
  if tg_table_name = 'evidence' then
    select array_agg(r.cycle_id) into v_cycles from public.responses r
     where r.id in (new.response_id, old.response_id);
  else
    v_cycles := array_remove(array[new.cycle_id, old.cycle_id], null);
  end if;
  if exists (select 1 from public.assessment_cycles where id = any(v_cycles) and status in ('final','archived'))
     and not app.has_role('admin') then
    raise exception 'This assessment cycle is closed. Open a new cycle to record changes.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

-- Evidence behind a validated score is locked like the score itself.
create or replace function app.guard_validated_evidence() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.responses r where r.id in (new.response_id, old.response_id) and r.status = 'validated')
     and auth.uid() is not null and not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
    raise exception 'This score is validated. Ask a validator to reopen it before changing its evidence.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists guard_validated_evidence on public.evidence;
create trigger guard_validated_evidence before insert or update or delete on public.evidence
  for each row execute function app.guard_validated_evidence();

-- ------------------------------------------------ 4. manual text -------------
-- What a document shows as current text changes only through the CDRRMO Head's
-- approval of a version (promote_moo_version) or by the Head directly, and always to
-- an approved version of that document.
create or replace function app.guard_moo_document() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.current_version_id is distinct from old.current_version_id and new.current_version_id is not null
     and not exists (select 1 from public.moo_versions v where v.id = new.current_version_id
                     and v.document_id = new.id and v.status = 'approved') then
    raise exception 'A document can only show an approved version of itself' using errcode = '42501';
  end if;
  -- current_user is the API role for client calls, the function owner inside promote_moo_version.
  if current_user in ('authenticated','anon') and auth.uid() is not null
     and not app.has_any_role(array['cdrrmo_head']::public.app_role[]) then
    if new.current_version_id is distinct from old.current_version_id then
      raise exception 'Only the CDRRMO Head can change the approved text of a document' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and (new.status = 'approved' or old.status = 'approved') then
      raise exception 'Only the CDRRMO Head can approve a document' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_moo_document on public.moo_documents;
create trigger guard_moo_document before update on public.moo_documents
  for each row execute function app.guard_moo_document();

drop policy if exists moo_docs_write on public.moo_documents;
drop policy if exists moo_docs_insert on public.moo_documents;
drop policy if exists moo_docs_update on public.moo_documents;
drop policy if exists moo_docs_delete on public.moo_documents;
create policy moo_docs_insert on public.moo_documents for insert to authenticated
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy moo_docs_update on public.moo_documents for update to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy moo_docs_delete on public.moo_documents for delete to authenticated using (app.has_role('admin'));

drop policy if exists moo_versions_write on public.moo_versions;
drop policy if exists moo_versions_insert on public.moo_versions;
drop policy if exists moo_versions_update on public.moo_versions;
drop policy if exists moo_versions_delete on public.moo_versions;
create policy moo_versions_insert on public.moo_versions for insert to authenticated
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy moo_versions_update on public.moo_versions for update to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy moo_versions_delete on public.moo_versions for delete to authenticated
  using (app.has_role('admin') and status <> 'approved');

-- ------------------------------------------------ 5. resource requests -------
-- A request starts as "requested"; only the EOC Manager or CDRRMO Head may record one
-- that is already approved. Lifecycle times are the server's.
create or replace function app.guard_resource_request_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.approved_at := null; new.mobilized_at := null; new.delivered_at := null; new.demobilized_at := null;
  if new.status <> 'requested' then
    if auth.uid() is not null and not (new.status in ('approved','rejected')
        and app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[])) then
      raise exception 'A new request starts as requested. The EOC Manager approves it.' using errcode = '42501';
    end if;
    if new.status = 'approved' then new.approved_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_resource_request_insert on public.resource_requests;
create trigger guard_resource_request_insert before insert on public.resource_requests
  for each row execute function app.guard_resource_request_insert();

-- ------------------------------------------------ 6. declarations ------------
-- Legal clocks run on server time. A device time is accepted only for the last 24
-- hours (an entry made offline and sent later); otherwise the server's time is used.
-- Once a declaration leaves draft its hazard, origin, PDRA and expected impact are fixed.
create or replace function app.lock_declaration() returns trigger
language plpgsql as $$
declare c text; v jsonb := '{}'::jsonb; v_old jsonb; v_new jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    new.rdrrmc_due_at := null; new.report_due_at := null;
    foreach c in array array['requested_at','rdrrmc_responded_at','declared_at','lifted_at','report_submitted_at'] loop
      if v_new ->> c is not null and ((v_new ->> c)::timestamptz < now() - interval '24 hours' or (v_new ->> c)::timestamptz > now() + interval '5 minutes') then
        v := v || jsonb_build_object(c, now());
      end if;
    end loop;
    return jsonb_populate_record(new, v);
  end if;
  v_old := to_jsonb(old);
  if old.status <> 'draft' then
    if new.origin is distinct from old.origin or new.hazard_code is distinct from old.hazard_code
       or new.pdra_id is distinct from old.pdra_id or new.expected_impact_at is distinct from old.expected_impact_at then
      raise exception 'The hazard, origin, PDRA and expected impact of a declaration are fixed once it is requested or declared. Record a new declaration instead.'
        using errcode = '42501';
    end if;
  end if;
  v := jsonb_build_object('rdrrmc_due_at', v_old -> 'rdrrmc_due_at', 'report_due_at', v_old -> 'report_due_at');
  foreach c in array array['requested_at','rdrrmc_responded_at','declared_at','lifted_at','report_submitted_at'] loop
    if v_old ->> c is not null then
      v := v || jsonb_build_object(c, v_old -> c);                       -- a recorded time never changes
    elsif v_new ->> c is not null and ((v_new ->> c)::timestamptz < now() - interval '24 hours' or (v_new ->> c)::timestamptz > now() + interval '5 minutes') then
      v := v || jsonb_build_object(c, now());
    end if;
  end loop;
  return jsonb_populate_record(new, v);
end $$;
drop trigger if exists aac_lock_declaration on public.declarations;
create trigger aac_lock_declaration before insert or update on public.declarations
  for each row execute function app.lock_declaration();

-- A City request needs a PDRA that classified the impact as severe and decided to
-- request a declaration, and at least the minimum lead time left when it is sent
-- (RA 12287 Sec. 6), measured on server time.
create or replace function app.guard_declaration_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pdra public.pdra_sessions; v_lead numeric;
begin
  if new.status = 'requested' and (tg_op = 'INSERT' or old.status <> 'requested') then
    select * into v_pdra from public.pdra_sessions where id = new.pdra_id;
    if v_pdra.id is null or v_pdra.decision <> 'request_declaration' or v_pdra.impact_class <> 'severe' then
      raise exception 'A City request needs a PDRA that found severe impacts and decided to request a declaration' using errcode = '23514';
    end if;
    v_lead := extract(epoch from (new.expected_impact_at - now())) / 3600.0;
    if v_lead < public.aa_rule('min_declaration_lead_hours') then
      raise exception 'Only % hours of lead time remain; a declaration needs at least %. Use city early action under the LGU''s own authority.',
        floor(v_lead * 10) / 10, public.aa_rule('min_declaration_lead_hours') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_declaration_request on public.declarations;
create trigger guard_declaration_request before insert or update on public.declarations
  for each row execute function app.guard_declaration_request();

-- After lifting only the OCD report fields may be recorded; the deadline itself stays.
-- (lock_declaration already restores report_due_at; guard_declaration keeps its rules.)

-- ------------------------------------------------ 7. AA funds ----------------
-- An allocation cannot drop below what has already been disbursed from it.
create or replace function app.guard_aa_fund_year_used() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_beyond numeric; v_within numeric;
begin
  select coalesce(sum(amount) filter (where tranche = 'beyond_threshold'), 0),
         coalesce(sum(amount) filter (where tranche = 'within_threshold'), 0)
    into v_beyond, v_within
  from public.aa_disbursements where fiscal_year = new.fiscal_year and source = 'ldrrmf_aa';
  if round(new.aa_allocation * public.aa_rule('tranche_beyond_max'), 2) < v_beyond
     or round(new.aa_allocation * public.aa_rule('tranche_within_max'), 2) < v_within then
    raise exception 'The AA allocation cannot be lowered below what has been disbursed (₱% beyond and ₱% within the threshold).',
      to_char(v_beyond, 'FM999,999,999,990.00'), to_char(v_within, 'FM999,999,999,990.00') using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists guard_aa_fund_year_used on public.aa_fund_years;
create trigger guard_aa_fund_year_used before update on public.aa_fund_years
  for each row execute function app.guard_aa_fund_year_used();

-- Disbursements: fiscal year follows the intervention date (Asia/Manila); changes are
-- allowed only while the declaration is in force; tranche totals are checked under a
-- lock on the fund year so two devices cannot pass the limit together.
create or replace function app.prepare_aa_disbursement() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  new.fiscal_year := extract(year from new.intervention_at at time zone 'Asia/Manila')::smallint;
  if tg_op = 'UPDATE' then
    select status into v_status from public.declarations where id = new.declaration_id;
    if v_status is distinct from 'declared' then
      raise exception 'A disbursement can be corrected only while the declaration is in force. Record a reversal instead.' using errcode = '22023';
    end if;
    if new.declaration_id is distinct from old.declaration_id then
      raise exception 'A disbursement cannot move to another declaration' using errcode = '42501';
    end if;
  end if;
  perform 1 from public.aa_fund_years where fiscal_year = new.fiscal_year for update;
  return new;
end $$;
drop trigger if exists aad_prepare_aa_disbursement on public.aa_disbursements;
create trigger aad_prepare_aa_disbursement before insert or update on public.aa_disbursements
  for each row execute function app.prepare_aa_disbursement();
