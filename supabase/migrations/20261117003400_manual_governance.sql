-- 1.23.0 (17 Nov 2026), ADR-043 Slice 1: Manual Review and Validation Workspace.
-- Review Register, Outstanding Decisions, Workshop Sessions, Stakeholder matrix.
-- Source: Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx (12 Nov 2026).
-- Authority transitions (close, decide, reopen) are online-only (ADR-006).
-- Conversations on these parents are deferred; parent_kind extension is a later slice.
-- Safe to run again.

-- --------------------------------------------------------------------------- enums / controlled vocab (text + check for now)
-- Priority: critical_urgent | important | standard
-- Review status (governed): open | in_review | pending_evidence | pending_decision | closed | deferred
-- Decision status: for_decision | in_progress | decided | deferred | withdrawn
-- Workshop status: planned | in_progress | completed | cancelled
-- Authority status: confirmed | to_be_confirmed
-- Disposition (closure): accepted | revised | rejected | deferred | superseded

-- --------------------------------------------------------------------------- stakeholders (reference matrix)
create table if not exists public.manual_governance_stakeholders (
  id                uuid primary key default gen_random_uuid(),
  source_key        text not null unique,
  institution       text not null check (length(trim(institution)) between 1 and 200),
  role_in_validation text,
  responsibility    text,
  relevant_chapters text,
  criticality       text not null default 'standard'
                      check (criticality in ('critical_urgent','important','standard')),
  designation_status text,
  source_workbook   text,
  source_sheet      text,
  import_batch_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1
);
comment on table public.manual_governance_stakeholders is
  'ADR-043: stakeholder / cluster matrix from the Validation Tracker. Proposed assignments, not confirmed designations.';
select app.track('public.manual_governance_stakeholders');

create index if not exists mgs_institution_idx on public.manual_governance_stakeholders (institution);

-- --------------------------------------------------------------------------- review items
create table if not exists public.manual_review_items (
  id                  uuid primary key default gen_random_uuid(),
  source_tracker_id   text not null unique,          -- VR-001 …
  title               text not null check (length(trim(title)) between 1 and 500),
  description         text,
  chapter_ref         text,
  section_ref         text,
  source_register     text,
  source_used         text,
  required_action     text,
  priority            text not null default 'standard'
                        check (priority in ('critical_urgent','important','standard')),
  priority_raw        text,                          -- original tracker display
  review_status       text not null default 'open'
                        check (review_status in (
                          'open','in_review','pending_evidence','pending_decision','closed','deferred')),
  validation_status   text not null default 'not_started'
                        check (validation_status in (
                          'not_started','in_progress','validated','rejected')),
  lead_office         text,
  lead_position       text,
  workshop_slot       text,
  closure_test        text,
  disposition         text
                        check (disposition is null or disposition in (
                          'accepted','revised','rejected','deferred','superseded')),
  closed_at           timestamptz,
  closed_by           uuid references public.profiles(id),
  notes               text,
  -- provenance
  source_workbook     text,
  source_sheet        text,
  source_row          integer,
  import_batch_id     text,
  status_raw          text,                          -- original tracker status string
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1
);
comment on table public.manual_review_items is
  'ADR-043 Review Register. Source IDs VR-xxx are stable. Closure requires disposition + closure_test.';
select app.track('public.manual_review_items');

create index if not exists mri_status_idx on public.manual_review_items (review_status);
create index if not exists mri_priority_idx on public.manual_review_items (priority);
create index if not exists mri_chapter_idx on public.manual_review_items (chapter_ref);

-- --------------------------------------------------------------------------- outstanding decisions
create table if not exists public.outstanding_decisions (
  id                         uuid primary key default gen_random_uuid(),
  source_decision_id         text not null unique,   -- OD-01 …
  question                   text not null check (length(trim(question)) between 1 and 2000),
  domain                     text,
  priority                   text not null default 'standard'
                               check (priority in ('critical_urgent','important','standard')),
  priority_raw               text,
  accountable_owner_office   text not null,
  accountable_owner_position text,
  decision_authority_office  text,
  decision_authority_position text,
  authority_status           text not null default 'to_be_confirmed'
                               check (authority_status in ('confirmed','to_be_confirmed')),
  supporting_validators      text,
  manual_coverage            text,
  evidence_required          text,
  decision_status            text not null default 'for_decision'
                               check (decision_status in (
                                 'for_decision','in_progress','decided','deferred','withdrawn')),
  target_date                date,
  target_workshop            text,
  decision_reference         text,
  decision_date              date,
  disposition                text
                               check (disposition is null or disposition in (
                                 'accepted','revised','rejected','deferred','superseded')),
  decided_by                 uuid references public.profiles(id),
  -- provenance
  source_workbook            text,
  source_sheet               text,
  source_row                 integer,
  import_batch_id            text,
  status_raw                 text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  version                    integer not null default 1
);
comment on table public.outstanding_decisions is
  'ADR-043 Outstanding Decisions. Exactly one accountable owner office; decision authority is distinct.';
select app.track('public.outstanding_decisions');

create index if not exists od_status_idx on public.outstanding_decisions (decision_status);
create index if not exists od_priority_idx on public.outstanding_decisions (priority);

-- --------------------------------------------------------------------------- workshop sessions
create table if not exists public.workshop_sessions (
  id                  uuid primary key default gen_random_uuid(),
  source_session_key  text not null unique,          -- WS-01 …
  session_number      smallint not null check (session_number between 1 and 99),
  title               text not null check (length(trim(title)) between 1 and 300),
  purpose             text,
  manual_coverage     text,
  key_questions       text,
  expected_output     text,
  lead_office         text,
  scheduled_date      date,
  scheduled_date_raw  text,
  status              text not null default 'planned'
                        check (status in ('planned','in_progress','completed','cancelled')),
  outcome_summary     text,
  -- provenance
  source_workbook     text,
  source_sheet        text,
  import_batch_id     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1
);
comment on table public.workshop_sessions is
  'ADR-043 Validation Workshop agenda sessions. Deterministic WS-nn keys from session order.';
select app.track('public.workshop_sessions');

create unique index if not exists ws_session_number_uidx on public.workshop_sessions (session_number);

-- --------------------------------------------------------------------------- link tables
create table if not exists public.workshop_session_review_items (
  session_id    uuid not null references public.workshop_sessions(id) on delete cascade,
  review_item_id uuid not null references public.manual_review_items(id) on delete cascade,
  primary key (session_id, review_item_id)
);
comment on table public.workshop_session_review_items is
  'Many-to-many: workshop session ↔ review item.';

create table if not exists public.workshop_session_decisions (
  session_id   uuid not null references public.workshop_sessions(id) on delete cascade,
  decision_id  uuid not null references public.outstanding_decisions(id) on delete cascade,
  primary key (session_id, decision_id)
);
comment on table public.workshop_session_decisions is
  'Many-to-many: workshop session ↔ outstanding decision.';

-- --------------------------------------------------------------------------- import batch log
create table if not exists public.manual_governance_import_batches (
  id              uuid primary key default gen_random_uuid(),
  source_workbook text not null,
  source_date     text,
  imported_at     timestamptz not null default now(),
  imported_by     uuid references public.profiles(id),
  reviews_inserted integer not null default 0,
  reviews_unchanged integer not null default 0,
  decisions_inserted integer not null default 0,
  decisions_unchanged integer not null default 0,
  sessions_inserted integer not null default 0,
  sessions_unchanged integer not null default 0,
  stakeholders_inserted integer not null default 0,
  stakeholders_unchanged integer not null default 0,
  notes           text
);
comment on table public.manual_governance_import_batches is
  'ADR-043: idempotent import reconciliation report. One row per import run.';

-- --------------------------------------------------------------------------- RLS
alter table public.manual_governance_stakeholders enable row level security;
alter table public.manual_review_items enable row level security;
alter table public.outstanding_decisions enable row level security;
alter table public.workshop_sessions enable row level security;
alter table public.workshop_session_review_items enable row level security;
alter table public.workshop_session_decisions enable row level security;
alter table public.manual_governance_import_batches enable row level security;

-- Stakeholders: any active user reads; admin / cdrrmo_head maintain
drop policy if exists mgs_select on public.manual_governance_stakeholders;
drop policy if exists mgs_write on public.manual_governance_stakeholders;
create policy mgs_select on public.manual_governance_stakeholders
  for select to authenticated using (app.is_active_user());
create policy mgs_write on public.manual_governance_stakeholders
  for all to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));

-- Review items: active users read; assessor+ can draft-update non-closed; close is guarded
drop policy if exists mri_select on public.manual_review_items;
drop policy if exists mri_insert on public.manual_review_items;
drop policy if exists mri_update on public.manual_review_items;
drop policy if exists mri_delete on public.manual_review_items;
create policy mri_select on public.manual_review_items
  for select to authenticated using (app.is_active_user());
create policy mri_insert on public.manual_review_items
  for insert to authenticated
  with check (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]));
create policy mri_update on public.manual_review_items
  for update to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]));
create policy mri_delete on public.manual_review_items
  for delete to authenticated using (false);

-- Decisions: same pattern
drop policy if exists od_select on public.outstanding_decisions;
drop policy if exists od_insert on public.outstanding_decisions;
drop policy if exists od_update on public.outstanding_decisions;
drop policy if exists od_delete on public.outstanding_decisions;
create policy od_select on public.outstanding_decisions
  for select to authenticated using (app.is_active_user());
create policy od_insert on public.outstanding_decisions
  for insert to authenticated
  with check (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]));
create policy od_update on public.outstanding_decisions
  for update to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head','assessor','validator','author']::public.app_role[]));
create policy od_delete on public.outstanding_decisions
  for delete to authenticated using (false);

-- Workshop sessions
drop policy if exists ws_select on public.workshop_sessions;
drop policy if exists ws_write on public.workshop_sessions;
create policy ws_select on public.workshop_sessions
  for select to authenticated using (app.is_active_user());
create policy ws_write on public.workshop_sessions
  for all to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]));

-- Link tables: read for active; write with parent write rights
drop policy if exists wsri_select on public.workshop_session_review_items;
drop policy if exists wsri_write on public.workshop_session_review_items;
create policy wsri_select on public.workshop_session_review_items
  for select to authenticated using (app.is_active_user());
create policy wsri_write on public.workshop_session_review_items
  for all to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]));

drop policy if exists wsd_select on public.workshop_session_decisions;
drop policy if exists wsd_write on public.workshop_session_decisions;
create policy wsd_select on public.workshop_session_decisions
  for select to authenticated using (app.is_active_user());
create policy wsd_write on public.workshop_session_decisions
  for all to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head','eoc_manager']::public.app_role[]));

-- Import batches: admin / head only
drop policy if exists mgib_select on public.manual_governance_import_batches;
drop policy if exists mgib_insert on public.manual_governance_import_batches;
create policy mgib_select on public.manual_governance_import_batches
  for select to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));
create policy mgib_insert on public.manual_governance_import_batches
  for insert to authenticated
  with check (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));

grant select, insert, update on public.manual_review_items to authenticated;
grant select, insert, update on public.outstanding_decisions to authenticated;
grant select, insert, update on public.workshop_sessions to authenticated;
grant select, insert, update, delete on public.workshop_session_review_items to authenticated;
grant select, insert, update, delete on public.workshop_session_decisions to authenticated;
grant select, insert, update, delete on public.manual_governance_stakeholders to authenticated;
grant select, insert on public.manual_governance_import_batches to authenticated;
revoke delete on public.manual_review_items from authenticated;
revoke delete on public.outstanding_decisions from authenticated;
revoke delete on public.workshop_sessions from authenticated;
revoke update, delete on public.manual_governance_import_batches from authenticated;

-- --------------------------------------------------------------------------- guards
create or replace function app.guard_manual_review_item() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Review items are not deleted. Close or defer them with a disposition.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.closed_at := null;
    new.closed_by := null;
    if new.review_status = 'closed' then
      raise exception 'A new review item cannot be created already closed.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  -- source identity never changes
  if new.source_tracker_id is distinct from old.source_tracker_id then
    raise exception 'The source tracker ID cannot be changed.' using errcode = '42501';
  end if;

  -- closing: requires disposition and closure_test; Head or validator; server stamps
  if new.review_status = 'closed' and old.review_status is distinct from 'closed' then
    if not app.has_any_role(array['admin','cdrrmo_head','validator']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head, a validator or an administrator can close a review item.'
        using errcode = '42501';
    end if;
    if new.disposition is null then
      raise exception 'Closing a review item requires a disposition (accepted, revised, rejected, deferred or superseded).'
        using errcode = '42501';
    end if;
    if nullif(trim(coalesce(new.closure_test, '')), '') is null then
      raise exception 'Closing a review item requires a recorded closure test or evidence reference.'
        using errcode = '42501';
    end if;
    new.closed_by := auth.uid();
    new.closed_at := now();
  end if;

  -- reopening a closed item is Head / admin only
  if old.review_status = 'closed' and new.review_status is distinct from 'closed' then
    if not app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or an administrator can reopen a closed review item.'
        using errcode = '42501';
    end if;
    new.closed_at := null;
    new.closed_by := null;
    new.disposition := null;
  end if;

  -- non-authority fields on a closed item stay locked except notes by Head
  if old.review_status = 'closed' and new.review_status = 'closed' then
    if new.title is distinct from old.title
       or new.priority is distinct from old.priority
       or new.lead_office is distinct from old.lead_office
       or new.closure_test is distinct from old.closure_test
       or new.disposition is distinct from old.disposition then
      if not app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]) then
        raise exception 'This review item is closed. Only the CDRRMO Head or an administrator may change locked fields.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists guard_manual_review_item on public.manual_review_items;
create trigger guard_manual_review_item
  before insert or update or delete on public.manual_review_items
  for each row execute function app.guard_manual_review_item();

drop trigger if exists touch_manual_review_items on public.manual_review_items;
create trigger touch_manual_review_items
  before update on public.manual_review_items
  for each row execute function app.touch_row();

create or replace function app.guard_outstanding_decision() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Outstanding decisions are not deleted. Mark them decided, deferred or withdrawn.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.decided_by := null;
    if new.decision_status = 'decided' then
      raise exception 'A new decision cannot be created already decided.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source_decision_id is distinct from old.source_decision_id then
    raise exception 'The source decision ID cannot be changed.' using errcode = '42501';
  end if;

  -- recording a decision: Head or admin; requires disposition and reference
  if new.decision_status = 'decided' and old.decision_status is distinct from 'decided' then
    if not app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or an administrator can record a formal decision.'
        using errcode = '42501';
    end if;
    if new.disposition is null then
      raise exception 'Recording a decision requires a disposition.' using errcode = '42501';
    end if;
    if nullif(trim(coalesce(new.decision_reference, '')), '') is null then
      raise exception 'Recording a decision requires a decision reference (EO, resolution, memo or minute).'
        using errcode = '42501';
    end if;
    new.decided_by := auth.uid();
    if new.decision_date is null then
      new.decision_date := (now() at time zone 'Asia/Manila')::date;
    end if;
  end if;

  if old.decision_status = 'decided' and new.decision_status is distinct from 'decided' then
    if not app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or an administrator can reopen a decided item.'
        using errcode = '42501';
    end if;
    new.decided_by := null;
    new.decision_date := null;
    new.disposition := null;
    new.decision_reference := null;
  end if;

  return new;
end $$;

drop trigger if exists guard_outstanding_decision on public.outstanding_decisions;
create trigger guard_outstanding_decision
  before insert or update or delete on public.outstanding_decisions
  for each row execute function app.guard_outstanding_decision();

drop trigger if exists touch_outstanding_decisions on public.outstanding_decisions;
create trigger touch_outstanding_decisions
  before update on public.outstanding_decisions
  for each row execute function app.touch_row();

drop trigger if exists touch_workshop_sessions on public.workshop_sessions;
create trigger touch_workshop_sessions
  before update on public.workshop_sessions
  for each row execute function app.touch_row();

drop trigger if exists touch_manual_governance_stakeholders on public.manual_governance_stakeholders;
create trigger touch_manual_governance_stakeholders
  before update on public.manual_governance_stakeholders
  for each row execute function app.touch_row();
