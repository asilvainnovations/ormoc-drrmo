-- 1.34.0 (28 Nov 2026): Behaviour = Motivation + Ability + Prompt (B = MAP, Manual Introduction Table I.4) for validation.
--
-- MODE should help the right office take the right institutional action at the right time, and be judged by whether
-- those actions happen with evidence and proper authority, not by logins. This migration gives each validation task
-- what a useful prompt needs (who, why, what, how, when, expected response, what next) and lets the office that must act
-- answer in MODE:
-- 1. Offices the Validation Tracker names as leads but MODE lacked (City Legal Office, HRMO, City ICT Office, City Data
--    Protection Officer, Sangguniang Panlungsod, City Treasury, City Secretary, DILG VIII). Without them a task cannot
--    reach the office that must act.
-- 2. Routing: app.office_codes_in(text) reads the tracker's lead and owner wording into office codes; review items,
--    decisions and stakeholders keep them in *_office_codes, maintained by trigger.
-- 3. Ability: the Validation Task Locator fields on each review item (exact section, SOP or workflow, table or form,
--    printed pages, the task, supporting offices, evidence expected, closure criterion). Loaded by operational file 11.
-- 4. Behaviour records: the lead's recommendation and the evidence reference, with who and when (server-stamped),
--    through record_review_response() and record_decision_response(). The lead office's focal person, or CDRRMO
--    coordinators on its behalf, may record them; online only. A due date per item (set by the CDRRMO when it assigns
--    the workshop day); decision due dates from the tracker's target workshop.
-- 4b. The CDRRMO coordination loop: assign_validation_tasks() sets the due date and records who assigned it and when (the
--    prompt); the lead office acknowledges (acknowledge_validation_task); a CDRRMO validator other than the person who
--    recommended verifies the evidence (verify_review_evidence). Escalation is computed from these stamps in
--    src/domain/bmap.ts; nothing is sent by e-mail or SMS.
-- 5. Closure follows the tracker's closure criterion: the lead's recommendation, an evidence reference, the editor's
--    disposition, and the competent authority's decision where one is required. Deferred and superseded items close
--    with a disposition and a reason only.
-- Safe to run again.

-- --------------------------------------------------------------------------- 0. let updates save
-- ADR-043 added touch_<table> triggers on top of the touch_row trigger app.track() already creates, so every update to
-- these four tables raised a version conflict: no recommendation, status or closure could be saved. Keep one.
drop trigger if exists touch_manual_review_items on public.manual_review_items;
drop trigger if exists touch_outstanding_decisions on public.outstanding_decisions;
drop trigger if exists touch_manual_governance_stakeholders on public.manual_governance_stakeholders;
drop trigger if exists touch_workshop_sessions on public.workshop_sessions;

-- --------------------------------------------------------------------------- 1. offices
insert into public.offices (id, code, name, kind)
select v.id::uuid, v.code, v.name, v.kind
  from (values ('e4fef0e2-3c07-5e94-8028-300de575055d', 'CLO', 'City Legal Office', 'city_office'),
               ('5ba6e757-0008-50ec-8f5a-9d220d1f282f', 'HRMO', 'Human Resource Management Office', 'city_office'),
               ('7b8b4c72-1b36-50b0-8872-8d65ac2f95f3', 'ICT', 'City ICT Office', 'city_office'),
               ('b7a73a70-2705-58c9-8924-edbe97e57313', 'DPO', 'City Data Protection Officer', 'city_office'),
               ('fe809604-d92e-50a8-ada5-f0ee4e1c61dd', 'SP', 'Sangguniang Panlungsod and SP Secretariat', 'city_office'),
               ('fb14d75b-e38d-5f58-82e5-89d71bc59868', 'TREAS', 'City Treasury Office', 'city_office'),
               ('9366280b-302c-58e6-8b72-dfd6091bf609', 'SEC', 'Office of the City Secretary', 'city_office'),
               ('94fd8974-e4d2-5549-a1b6-e9b343be3317', 'DILG-VIII', 'DILG Region VIII and the City LGOO', 'national_agency'))
       as v(id, code, name, kind)
 where not exists (select 1 from public.offices o where o.code = v.code);

-- --------------------------------------------------------------------------- 2. routing by office
-- The tracker writes leads as free text ("City Budget Office / BAC Secretariat", "OCD VIII; DBM"). This reads the codes
-- out of it. src/domain/bmap.ts (OFFICE_PATTERNS) mirrors it; a test holds the two lists together.
create or replace function app.office_codes_in(p text) returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(array_agg(code order by code), '{}') from (
    select distinct code from (values
      ('CDRRMO', '(cdrrmo|cdrrmc|disaster risk reduction and management office|assessment team|custodian)'),
      ('CLO', '(city legal|\mclo\M)'),
      ('CMO', '(mayor)'),
      ('SP', '(sangguniang panlungsod|\msp\M|sp secretariat)'),
      ('CBO', '(budget office|city budget|\mbudget\M)'),
      ('BAC', '(\mbac\M|bids and awards)'),
      ('CACCO', '(accounting|accountant)'),
      ('TREAS', '(treasur)'),
      ('HRMO', '(\mhrmo\M|human resource)'),
      ('ICT', '(\mict\M)'),
      ('DPO', '(\mdpo\M|data protection)'),
      ('CSWDO', '(cswdo|social welfare)'),
      ('CPDO', '(cpdo|planning and development office)'),
      ('CHO', '(\mcho\M|city health)'),
      ('CEO', '(city engineer|building official)'),
      ('GSO', '(\mgso\M|general services)'),
      ('CAO', '(city agriculture)'),
      ('CVO', '(veterinar)'),
      ('CENRO', '(\mcenro\M|environment and natural resources office)'),
      ('PNP', '(\mpnp\M|police)'),
      ('BFP', '(\mbfp\M|fire protection)'),
      ('DEPED-SDO', '(deped|schools division)'),
      ('OCD-VIII', '(\mocd\M|office of civil defense|rdrrmc)'),
      ('DILG-VIII', '(dilg|lgoo)'),
      ('SEC', '(city secretary)'),
      ('PIO', '(public information)'),
      ('UTILITIES', '(leyeco|ngcp|telecom|water district)'),
      ('HOSPITALS', '(hospital)')
    ) as m(code, re)
    where p ~* m.re
  ) x;
$$;

alter table public.manual_review_items add column if not exists lead_office_codes text[] not null default '{}';
alter table public.outstanding_decisions add column if not exists owner_office_codes text[] not null default '{}';
alter table public.outstanding_decisions add column if not exists supporting_office_codes text[] not null default '{}';
alter table public.manual_governance_stakeholders add column if not exists office_codes text[] not null default '{}';

create or replace function app.route_review_item() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.lead_office_codes := app.office_codes_in(coalesce(new.lead_office, '')); return new; end $$;
drop trigger if exists route_review_item on public.manual_review_items;
create trigger route_review_item before insert or update of lead_office on public.manual_review_items
  for each row execute function app.route_review_item();

-- "1 Dec 2026", "3–4 Dec 2026" → the first day; anything else → null.
create or replace function app.workshop_day(p text) returns date
language sql immutable set search_path = public, pg_temp as $$
  select case when p ~ '\d{1,2}.*[A-Z][a-z]{2} \d{4}'
    then to_date(substring(p from '(\d{1,2})') || ' ' || substring(p from '([A-Z][a-z]{2} \d{4})'), 'DD Mon YYYY') end;
$$;

create or replace function app.route_decision() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.owner_office_codes := app.office_codes_in(coalesce(new.accountable_owner_office, ''));
  new.supporting_office_codes := app.office_codes_in(coalesce(new.supporting_validators, ''));
  if new.target_date is null then new.target_date := app.workshop_day(new.target_workshop); end if;
  return new;
end $$;
drop trigger if exists route_decision on public.outstanding_decisions;
create trigger route_decision before insert or update of accountable_owner_office, supporting_validators, target_workshop on public.outstanding_decisions
  for each row execute function app.route_decision();

create or replace function app.route_stakeholder() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.office_codes := app.office_codes_in(coalesce(new.institution, '')); return new; end $$;
drop trigger if exists route_stakeholder on public.manual_governance_stakeholders;
create trigger route_stakeholder before insert or update of institution on public.manual_governance_stakeholders
  for each row execute function app.route_stakeholder();

-- The current user's office code (profiles.office_id → offices.code), or null.
create or replace function app.my_office_code() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select o.code from public.profiles p join public.offices o on o.id = p.office_id where p.id = auth.uid();
$$;
grant execute on function app.my_office_code() to authenticated;

-- --------------------------------------------------------------------------- 3 and 4. ability and behaviour records
alter table public.manual_review_items
  add column if not exists chapter_version text,
  add column if not exists issue_type text,
  add column if not exists sop_ref text,
  add column if not exists artefact_ref text,
  add column if not exists printed_pages text,
  add column if not exists task text,
  add column if not exists supporting_offices text,
  add column if not exists evidence_expected text,
  add column if not exists closure_criterion text,
  add column if not exists needs_authority boolean not null default false,
  add column if not exists due_date date,
  add column if not exists recommendation text check (recommendation is null or length(recommendation) <= 2000),
  add column if not exists recommended_at timestamptz,
  add column if not exists recommended_by uuid references public.profiles(id),
  add column if not exists evidence_ref text check (evidence_ref is null or length(evidence_ref) <= 500),
  add column if not exists evidence_vault_id uuid references public.vault_documents(id),
  add column if not exists authority_ref text check (authority_ref is null or length(authority_ref) <= 300),
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references public.profiles(id),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.profiles(id),
  add column if not exists evidence_verified_at timestamptz,
  add column if not exists evidence_verified_by uuid references public.profiles(id),
  add column if not exists evidence_note text check (evidence_note is null or length(evidence_note) <= 1000);

alter table public.outstanding_decisions
  add column if not exists owner_response text check (owner_response is null or length(owner_response) <= 2000),
  add column if not exists owner_response_at timestamptz,
  add column if not exists owner_response_by uuid references public.profiles(id),
  add column if not exists evidence_ref text check (evidence_ref is null or length(evidence_ref) <= 500),
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references public.profiles(id),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.profiles(id);

-- Decision due dates from the tracker's target workshop.
update public.outstanding_decisions set target_date = app.workshop_day(target_workshop) where target_date is null;

-- Backfill routing on rows already loaded.
update public.manual_review_items set lead_office_codes = app.office_codes_in(coalesce(lead_office, ''));
update public.outstanding_decisions set owner_office_codes = app.office_codes_in(accountable_owner_office),
       supporting_office_codes = app.office_codes_in(coalesce(supporting_validators, ''));
update public.manual_governance_stakeholders set office_codes = app.office_codes_in(institution);

-- May this user answer for the office that leads? The lead office's own staff, or CDRRMO coordinators on its behalf.
create or replace function app.can_answer_for(p_codes text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_active_user() and (
    app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[])
    or (app.my_office_code() is not null and app.my_office_code() = any (p_codes)));
$$;
grant execute on function app.can_answer_for(text[]) to authenticated;

create or replace function public.record_review_response(p_item uuid, p_recommendation text, p_evidence_ref text default null,
  p_evidence_vault_id uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.manual_review_items; v_rec text := nullif(trim(coalesce(p_recommendation, '')), '');
        v_ev text := nullif(trim(coalesce(p_evidence_ref, '')), '');
begin
  select * into v from public.manual_review_items where id = p_item for update;
  if v.id is null then raise exception 'Review item not found.' using errcode = 'P0002'; end if;
  if not app.can_answer_for(v.lead_office_codes) then
    raise exception 'Only the lead office (%) or the CDRRMO can record the response to %.', coalesce(v.lead_office, 'not set'), v.source_tracker_id
      using errcode = '42501';
  end if;
  if v.review_status in ('closed', 'deferred') then
    raise exception '% is %; it takes no new response.', v.source_tracker_id, v.review_status using errcode = '42501';
  end if;
  if v_rec is null and v_ev is null and p_evidence_vault_id is null then
    raise exception 'Give a recommendation, an evidence reference, or both.' using errcode = '22023';
  end if;
  if v_rec is not null and length(v_rec) > 2000 then raise exception 'Keep the recommendation to 2,000 characters.' using errcode = '22023'; end if;
  update public.manual_review_items set
    recommendation = coalesce(v_rec, recommendation),
    recommended_at = case when v_rec is not null then now() else recommended_at end,
    recommended_by = case when v_rec is not null then auth.uid() else recommended_by end,
    evidence_ref = coalesce(v_ev, evidence_ref),
    evidence_vault_id = coalesce(p_evidence_vault_id, evidence_vault_id),
    evidence_verified_at = case when v_ev is not null or p_evidence_vault_id is not null then null else evidence_verified_at end,
    evidence_verified_by = case when v_ev is not null or p_evidence_vault_id is not null then null else evidence_verified_by end,
    acknowledged_at = coalesce(acknowledged_at, now()),
    acknowledged_by = coalesce(acknowledged_by, auth.uid()),
    review_status = case
      when coalesce(v_rec, recommendation) is not null and coalesce(v_ev, evidence_ref, p_evidence_vault_id::text, evidence_vault_id::text) is not null
        then (case when needs_authority and authority_ref is null then 'pending_decision' else 'in_review' end)
      when coalesce(v_rec, recommendation) is not null then 'pending_evidence'
      else review_status end,
    validation_status = case when validation_status = 'not_started' then 'in_progress' else validation_status end
  where id = p_item;
end $$;
revoke all on function public.record_review_response(uuid, text, text, uuid) from public, anon;
grant execute on function public.record_review_response(uuid, text, text, uuid) to authenticated;

create or replace function public.record_decision_response(p_decision uuid, p_response text, p_evidence_ref text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.outstanding_decisions; v_r text := nullif(trim(coalesce(p_response, '')), '');
begin
  select * into v from public.outstanding_decisions where id = p_decision for update;
  if v.id is null then raise exception 'Decision not found.' using errcode = 'P0002'; end if;
  if not app.can_answer_for(v.owner_office_codes) then
    raise exception 'Only the decision owner (%) or the CDRRMO can record the response to %.', v.accountable_owner_office, v.source_decision_id
      using errcode = '42501';
  end if;
  if v.decision_status in ('decided', 'withdrawn') then
    raise exception '% is %; it takes no new response.', v.source_decision_id, v.decision_status using errcode = '42501';
  end if;
  if v_r is null then raise exception 'Write the response or recommendation.' using errcode = '22023'; end if;
  update public.outstanding_decisions set owner_response = left(v_r, 2000), owner_response_at = now(), owner_response_by = auth.uid(),
         evidence_ref = coalesce(nullif(trim(coalesce(p_evidence_ref, '')), ''), evidence_ref),
         decision_status = case when decision_status = 'for_decision' then 'in_progress' else decision_status end,
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid())
   where id = p_decision;
end $$;
revoke all on function public.record_decision_response(uuid, text, text) from public, anon;
grant execute on function public.record_decision_response(uuid, text, text) to authenticated;

-- CDRRMO: assign (or re-assign) validation tasks with a response date. This is the prompt: it names the date and who
-- issued it. Review items and decisions; ids that are closed, decided or withdrawn are skipped.
create or replace function public.assign_validation_tasks(p_items uuid[], p_decisions uuid[], p_due date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; k integer;
begin
  if not (app.is_active_user() and app.has_any_role(array['admin','cdrrmo_head','assessor','validator']::public.app_role[])) then
    raise exception 'Only the CDRRMO Head, an assessor, a validator or an administrator assigns validation tasks.' using errcode = '42501';
  end if;
  if p_due is null then raise exception 'Give the response date.' using errcode = '22023'; end if;
  if p_due < (now() at time zone 'Asia/Manila')::date then
    raise exception 'The response date is already past.' using errcode = '22023';
  end if;
  update public.manual_review_items set due_date = p_due, assigned_at = now(), assigned_by = auth.uid(),
         acknowledged_at = null, acknowledged_by = null
   where id = any (coalesce(p_items, '{}')) and review_status not in ('closed', 'deferred');
  get diagnostics k = row_count; n := n + k;
  update public.outstanding_decisions set target_date = p_due, assigned_at = now(), assigned_by = auth.uid(),
         acknowledged_at = null, acknowledged_by = null
   where id = any (coalesce(p_decisions, '{}')) and decision_status not in ('decided', 'withdrawn');
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.assign_validation_tasks(uuid[], uuid[], date) from public, anon;
grant execute on function public.assign_validation_tasks(uuid[], uuid[], date) to authenticated;

-- Lead office: acknowledge the task ("we have it; we will answer by the date"). p_kind 'item' or 'decision'.
create or replace function public.acknowledge_validation_task(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_codes text[]; v_label text;
begin
  if p_kind = 'item' then
    select lead_office_codes, source_tracker_id into v_codes, v_label from public.manual_review_items where id = p_id;
  elsif p_kind = 'decision' then
    select owner_office_codes, source_decision_id into v_codes, v_label from public.outstanding_decisions where id = p_id;
  else raise exception 'Kind must be item or decision.' using errcode = '22023'; end if;
  if v_label is null then raise exception 'Task not found.' using errcode = 'P0002'; end if;
  if not app.can_answer_for(v_codes) then
    raise exception 'Only the office that leads % (or the CDRRMO for it) can acknowledge it.', v_label using errcode = '42501';
  end if;
  if p_kind = 'item' then
    update public.manual_review_items set acknowledged_at = now(), acknowledged_by = auth.uid() where id = p_id and acknowledged_at is null;
  else
    update public.outstanding_decisions set acknowledged_at = now(), acknowledged_by = auth.uid() where id = p_id and acknowledged_at is null;
  end if;
end $$;
revoke all on function public.acknowledge_validation_task(text, uuid) from public, anon;
grant execute on function public.acknowledge_validation_task(text, uuid) to authenticated;

-- CDRRMO validator: check the evidence against "evidence expected". The person who recommended cannot verify their own
-- evidence (four-eyes). Not accepted → the item returns to waiting on evidence with the reason.
create or replace function public.verify_review_evidence(p_item uuid, p_accepted boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.manual_review_items; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not (app.is_active_user() and app.has_any_role(array['admin','cdrrmo_head','validator']::public.app_role[])) then
    raise exception 'Only a validator, the CDRRMO Head or an administrator verifies evidence.' using errcode = '42501';
  end if;
  select * into v from public.manual_review_items where id = p_item for update;
  if v.id is null then raise exception 'Review item not found.' using errcode = 'P0002'; end if;
  if v.evidence_ref is null and v.evidence_vault_id is null then
    raise exception '% has no evidence reference to verify yet.', v.source_tracker_id using errcode = '22023';
  end if;
  if v.recommended_by = auth.uid() then
    raise exception 'You recorded the recommendation on %; another validator verifies the evidence.', v.source_tracker_id using errcode = '42501';
  end if;
  if not p_accepted and v_note is null then
    raise exception 'Say what is missing so the lead office can supply it.' using errcode = '22023';
  end if;
  update public.manual_review_items set
    evidence_verified_at = case when p_accepted then now() end,
    evidence_verified_by = case when p_accepted then auth.uid() end,
    evidence_note = left(v_note, 1000),
    review_status = case when p_accepted then review_status else 'pending_evidence' end
   where id = p_item;
end $$;
revoke all on function public.verify_review_evidence(uuid, boolean, text) from public, anon;
grant execute on function public.verify_review_evidence(uuid, boolean, text) to authenticated;

-- Behaviour fields are written only by the functions above (or the seed): a plain update cannot forge who recommended.
create or replace function app.guard_review_behaviour() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.recommendation is distinct from old.recommendation or new.recommended_by is distinct from old.recommended_by
     or new.recommended_at is distinct from old.recommended_at or new.evidence_ref is distinct from old.evidence_ref
     or new.evidence_vault_id is distinct from old.evidence_vault_id
     or new.assigned_at is distinct from old.assigned_at or new.assigned_by is distinct from old.assigned_by
     or new.acknowledged_at is distinct from old.acknowledged_at or new.acknowledged_by is distinct from old.acknowledged_by
     or new.evidence_verified_at is distinct from old.evidence_verified_at or new.evidence_verified_by is distinct from old.evidence_verified_by
     or new.evidence_note is distinct from old.evidence_note or new.due_date is distinct from old.due_date then
    raise exception 'Assignments, responses and evidence checks are recorded through their own actions (they note who and when).' using errcode = '42501';
  end if;
  if new.lead_office_codes is distinct from old.lead_office_codes and new.lead_office is not distinct from old.lead_office then
    new.lead_office_codes := old.lead_office_codes;
  end if;
  -- 5. closure criterion
  if new.review_status = 'closed' and old.review_status is distinct from 'closed'
     and coalesce(new.disposition, '') not in ('deferred', 'superseded') then
    if new.recommendation is null then
      raise exception 'Close % only after the lead validator''s recommendation is recorded.', new.source_tracker_id using errcode = '42501';
    end if;
    if new.evidence_ref is null and new.evidence_vault_id is null then
      raise exception 'Close % only with an evidence reference (a document, a Vault entry or signed minutes).', new.source_tracker_id using errcode = '42501';
    end if;
    if new.evidence_verified_at is null then
      raise exception 'Close % only after a validator has verified the evidence.', new.source_tracker_id using errcode = '42501';
    end if;
    if new.needs_authority and nullif(trim(coalesce(new.authority_ref, '')), '') is null then
      raise exception '% needs the competent authority''s decision: record its reference before closing.', new.source_tracker_id using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_review_behaviour on public.manual_review_items;
create trigger guard_review_behaviour before update on public.manual_review_items
  for each row execute function app.guard_review_behaviour();

create or replace function app.guard_decision_behaviour() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.owner_response is distinct from old.owner_response or new.owner_response_by is distinct from old.owner_response_by
     or new.owner_response_at is distinct from old.owner_response_at
     or new.assigned_at is distinct from old.assigned_at or new.assigned_by is distinct from old.assigned_by
     or new.acknowledged_at is distinct from old.acknowledged_at or new.acknowledged_by is distinct from old.acknowledged_by then
    raise exception 'Assignments and the owner''s response are recorded through their own actions (they note who and when).' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_decision_behaviour on public.outstanding_decisions;
create trigger guard_decision_behaviour before update on public.outstanding_decisions
  for each row execute function app.guard_decision_behaviour();
