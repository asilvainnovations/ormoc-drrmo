-- =============================================================================
-- 1.20.0 (14 Nov 2026) - EOC Capability Assessment board (ADR-035).
--
-- The EOC Capability Assessment Checklist (OCD/NDRRMC TWG, December 2017, adapted from FEMA)
-- is 154 items in 15 sections, from hazard and vulnerability assessment to training and
-- exercises. Each item applies to the primary and/or the alternate EOC and is mapped to the
-- indicators of the IAT v1-7 B_EOC sheet, so the checklist answer derives from evidence the
-- City already scores: the weakest (lowest) mapped indicator score sets the item status
-- (3 or 4 = Met, 2 = Partially met, 1 = Largely unmet, 0 = Not met; an item with no mapped
-- indicator carries "No direct IAT indicator"). This migration stores that checklist:
--   eoc_assessment_items      the 154 checklist items (reference, read-only to clients)
--   eoc_assessment_runs       one assessment run per assessment round; draft until the
--                             CDRRMO Head validates it, then locked for the record
--   eoc_assessment_responses  one row per (run, item): status, evidence observed, gap,
--                             recommended action and links to the SOP/protocol/workflow/form
--                             records that close the gap
--
-- Rules: reads are reference data and stay offline (ADR-003). Recording or editing a response
-- belongs to the assessment team (assessor, validator, EOC Manager, EOC staff, CDRRMO Head,
-- admin); validating a run is an authority action (ADR-006) for the CDRRMO Head or admin only,
-- enforced here by app.guard_eoc_assessment, and a validated run and its responses are locked
-- (approved records are immutable). Responses are corrected, never removed. The module never
-- re-scores risk: DDRiVE stays the risk-intelligence source and the board links out to it.
--
-- Review fixes (14 Nov 2026, before first release):
--   * provenance: the seeded answers are a crosswalk from the IAT scores, not an observation, and are
--     stored as 'prefilled_iat'. Any edit or confirmation by a person makes an answer 'observed'.
--   * per-answer validation: only the CDRRMO Head (or admin) validates an answer, online, and only an
--     observed one; a validated answer is fixed until reopened. A run can be validated only when none of
--     its answers is still pre-filled, so a single click never turns the IAT crosswalk into findings.
--   * site: each answer is for the primary or the alternate EOC (unique per run, item and site).
--   * statuses: not_assessed and not_applicable added (not applicable needs a reason in Gap / remarks);
--     no_direct_indicator stays for pre-filled items with no IAT counterpart.
--
-- Supports MR-14 (traceability). Indicators B2.1, B2.7, B4.1, B6.3, B7.1.
-- Safe to run again, including on a database that ran the pre-review copy of this migration.
-- =============================================================================

-- The derivation rule, kept in SQL so the seed, the database tests and the TypeScript mirror
-- (src/domain/eoc_assessment.ts, ADR-005) all agree: the weakest mapped indicator score sets
-- the status; NA (null) scores are ignored; no mapped score means no direct indicator.
create or replace function app.eoc_assessment_status(scores integer[]) returns text
language plpgsql immutable as $$
declare v_min integer;
begin
  select min(s) into v_min from unnest(scores) as s where s is not null;
  if v_min is null then return 'no_direct_indicator'; end if;
  return case
    when v_min >= 3 then 'met'
    when v_min = 2 then 'partially_met'
    when v_min = 1 then 'largely_unmet'
    else 'not_met'
  end;
end $$;

-- IAT links are B_EOC indicator ids (B1.1 ... B7.x).
create or replace function app.valid_iat_links(links text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(l ~ '^B[1-7]\.[0-9]+$'), true) from unnest(links) as l
$$;

create table if not exists public.eoc_assessment_items (
  id                uuid primary key default gen_random_uuid(),
  section           text not null check (length(trim(section)) between 3 and 200),
  section_sort      integer not null,
  item_no           integer not null check (item_no >= 1),
  item_text         text not null check (length(trim(item_text)) between 3 and 1000),
  applies_primary   boolean not null default true,
  applies_alternate boolean not null default false,
  iat_links         text[] not null default '{}' check (app.valid_iat_links(iat_links)),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1,
  unique (section, item_no)
);
comment on table public.eoc_assessment_items is 'The 154 items of the EOC Capability Assessment Checklist (OCD/NDRRMC TWG Dec 2017, FEMA-derived), 15 sections (ADR-035).';
comment on column public.eoc_assessment_items.applies_alternate is 'The item was assessed for the alternate EOC. All seeded rows are false: no alternate EOC is designated yet (IAT B2.7), so the workbook marks the alternate "Not assessed".';
comment on column public.eoc_assessment_items.iat_links is 'IAT v1-7 B_EOC indicator ids this item maps to, e.g. {B2.1,B2.2}. Empty means no direct IAT indicator.';
create index if not exists eoc_assessment_items_sort_idx on public.eoc_assessment_items (section_sort, item_no);
select app.track('public.eoc_assessment_items');

create table if not exists public.eoc_assessment_runs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) between 3 and 200),
  status        text not null default 'draft' check (status in ('draft','validated')),
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  validated_by  uuid references public.profiles(id),
  validated_at  timestamptz,
  version       integer not null default 1,
  check (status = 'draft' or (validated_by is not null and validated_at is not null))
);
comment on table public.eoc_assessment_runs is 'One EOC capability assessment run per round (e.g. the IAT v1-7 baseline). The CDRRMO Head validates a run; a validated run is locked (ADR-035). Seeds never validate.';
select app.track('public.eoc_assessment_runs');

create table if not exists public.eoc_assessment_responses (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.eoc_assessment_runs(id) on delete cascade,
  item_id             uuid not null references public.eoc_assessment_items(id),
  site                text not null default 'primary',
  status              text not null,
  provenance          text not null default 'observed',
  state               text not null default 'draft',
  evidence            text,
  gap                 text,
  recommended_action  text,
  tool_links          jsonb not null default '[]' check (jsonb_typeof(tool_links) = 'array'),
  updated_by          uuid default auth.uid() references public.profiles(id),
  validated_by        uuid references public.profiles(id),
  validated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1
);
-- Columns and constraints added in review; written as alters so a database that ran the pre-review copy
-- (which had no site, provenance or per-answer validation) upgrades in place.
alter table public.eoc_assessment_responses add column if not exists site text not null default 'primary';
alter table public.eoc_assessment_responses add column if not exists provenance text not null default 'observed';
alter table public.eoc_assessment_responses add column if not exists state text not null default 'draft';
alter table public.eoc_assessment_responses add column if not exists validated_by uuid references public.profiles(id);
alter table public.eoc_assessment_responses add column if not exists validated_at timestamptz;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_run_id_item_id_key;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_status_check;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_site_check;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_provenance_check;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_state_check;
alter table public.eoc_assessment_responses drop constraint if exists eoc_assessment_responses_na_reason_check;
alter table public.eoc_assessment_responses add constraint eoc_assessment_responses_status_check
  check (status in ('met','partially_met','largely_unmet','not_met','not_applicable','not_assessed','no_direct_indicator'));
alter table public.eoc_assessment_responses add constraint eoc_assessment_responses_site_check check (site in ('primary','alternate'));
alter table public.eoc_assessment_responses add constraint eoc_assessment_responses_provenance_check check (provenance in ('prefilled_iat','observed'));
alter table public.eoc_assessment_responses add constraint eoc_assessment_responses_state_check
  check (state in ('draft','validated') and (state = 'draft' or (validated_by is not null and validated_at is not null)));
alter table public.eoc_assessment_responses add constraint eoc_assessment_responses_na_reason_check
  check (status <> 'not_applicable' or length(btrim(coalesce(gap, ''))) > 0);
create unique index if not exists eoc_assessment_responses_run_item_site_key on public.eoc_assessment_responses (run_id, item_id, site);
-- A database that ran the pre-review copy holds the seeded baseline answers as if observed: they are the IAT
-- crosswalk, never edited since (version 1, no editor), so label them pre-filled. Edited answers stay observed.
update public.eoc_assessment_responses set provenance = 'prefilled_iat'
 where version = 1 and updated_by is null and provenance <> 'prefilled_iat'
   and run_id = 'ecbd6f03-43b8-5b88-a400-52c17755d9dd'::uuid;
comment on column public.eoc_assessment_responses.site is 'primary or alternate EOC. All seeded answers are for the primary EOC (no alternate is designated yet, IAT B2.7).';
comment on column public.eoc_assessment_responses.provenance is 'prefilled_iat: copied from the IAT v1-7 crosswalk (weakest mapped score), not observed. observed: set or confirmed by a person (server-set).';
comment on column public.eoc_assessment_responses.state is 'draft, or validated by the CDRRMO Head (only an observed answer can be validated).';
comment on table public.eoc_assessment_responses is 'One answer per (run, checklist item, site): status, evidence observed, gap, recommended action and tool links. Seeded answers are pre-filled from the IAT crosswalk (provenance prefilled_iat) until confirmed on site (ADR-035).';
comment on column public.eoc_assessment_responses.status is 'Pre-filled: from the weakest mapped IAT indicator score (app.eoc_assessment_status). Observed: the assessment team''s finding on site. not_applicable needs a reason in gap.';
comment on column public.eoc_assessment_responses.tool_links is 'Array of {code,title} pointing at the SOP, Protocol, Workflow or Form records that close the gap (controlled vocabulary). Display links, not foreign keys, like the RACI template links.';
create index if not exists eoc_assessment_responses_run_idx on public.eoc_assessment_responses (run_id);
create index if not exists eoc_assessment_responses_item_idx on public.eoc_assessment_responses (item_id);
select app.track('public.eoc_assessment_responses');

-- Reads: any active user. Writes: the assessment team; validating a run is the CDRRMO Head or
-- admin only, and a validated run is locked. Refusals come from the guard in plain words
-- (errcode 42501) so a refused change is never a silent zero-row success (as in app.guard_raci).
-- Seeds and the SQL editor run as the table owner and pass the guard.
alter table public.eoc_assessment_items enable row level security;
drop policy if exists eoc_assessment_items_read on public.eoc_assessment_items;
create policy eoc_assessment_items_read on public.eoc_assessment_items for select to authenticated using (app.is_active_user());
grant select on public.eoc_assessment_items to authenticated;

alter table public.eoc_assessment_runs enable row level security;
drop policy if exists eoc_assessment_runs_read on public.eoc_assessment_runs;
drop policy if exists eoc_assessment_runs_insert on public.eoc_assessment_runs;
drop policy if exists eoc_assessment_runs_update on public.eoc_assessment_runs;
drop policy if exists eoc_assessment_runs_delete on public.eoc_assessment_runs;
create policy eoc_assessment_runs_read on public.eoc_assessment_runs for select to authenticated using (app.is_active_user());
create policy eoc_assessment_runs_insert on public.eoc_assessment_runs for insert to authenticated
  with check (app.has_any_role(array['assessor','validator','eoc_manager','eoc_staff','cdrrmo_head','admin']::public.app_role[]));
create policy eoc_assessment_runs_update on public.eoc_assessment_runs for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['assessor','validator','eoc_manager','eoc_staff','cdrrmo_head','admin']::public.app_role[]));
create policy eoc_assessment_runs_delete on public.eoc_assessment_runs for delete to authenticated using (app.is_active_user());
grant select on public.eoc_assessment_runs to authenticated;
grant insert, update, delete on public.eoc_assessment_runs to authenticated;

alter table public.eoc_assessment_responses enable row level security;
drop policy if exists eoc_assessment_responses_read on public.eoc_assessment_responses;
drop policy if exists eoc_assessment_responses_insert on public.eoc_assessment_responses;
drop policy if exists eoc_assessment_responses_update on public.eoc_assessment_responses;
drop policy if exists eoc_assessment_responses_delete on public.eoc_assessment_responses;
create policy eoc_assessment_responses_read on public.eoc_assessment_responses for select to authenticated using (app.is_active_user());
create policy eoc_assessment_responses_insert on public.eoc_assessment_responses for insert to authenticated
  with check (app.has_any_role(array['assessor','validator','eoc_manager','eoc_staff','cdrrmo_head','admin']::public.app_role[]));
create policy eoc_assessment_responses_update on public.eoc_assessment_responses for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['assessor','validator','eoc_manager','eoc_staff','cdrrmo_head','admin']::public.app_role[]));
create policy eoc_assessment_responses_delete on public.eoc_assessment_responses for delete to authenticated using (app.is_active_user());
grant select on public.eoc_assessment_responses to authenticated;
grant insert, update, delete on public.eoc_assessment_responses to authenticated;

create or replace function app.guard_eoc_assessment() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_write constant public.app_role[] := array['assessor','validator','eoc_manager','eoc_staff','cdrrmo_head','admin']::public.app_role[];
  v_head  constant public.app_role[] := array['cdrrmo_head','admin']::public.app_role[];
  v_prefilled integer;
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name = 'eoc_assessment_runs' then
    if tg_op = 'INSERT' then
      if new.status = 'validated' then
        raise exception 'A capability run starts as a draft; validate it from the board.' using errcode = '23514';
      end if;
      return new;
    elsif tg_op = 'DELETE' then
      if old.status = 'validated' then
        raise exception 'A validated capability run is part of the record and is never removed.' using errcode = '42501';
      end if;
      if not app.has_any_role(v_head) then
        raise exception 'Only the CDRRMO Head removes a draft capability run.' using errcode = '42501';
      end if;
      return old;
    else
      if old.status = 'validated' then
        raise exception 'A validated capability run is locked. Open a new run for the next assessment.' using errcode = '42501';
      end if;
      if new.status = 'validated' and old.status = 'draft' then
        if not app.has_any_role(v_head) then
          raise exception 'Only the CDRRMO Head validates an EOC capability run.' using errcode = '42501';
        end if;
        select count(*) into v_prefilled from public.eoc_assessment_responses p where p.run_id = new.id and p.provenance = 'prefilled_iat';
        if v_prefilled > 0 then
          raise exception '% answers in this run are still pre-filled from the IAT. Confirm them on site before validating the run.', v_prefilled
            using errcode = '23514';
        end if;
        new.validated_by := auth.uid();
        new.validated_at := now();
      elsif new.status is distinct from old.status then
        raise exception 'A capability run moves only from draft to validated.' using errcode = '23514';
      elsif not app.has_any_role(v_write) then
        raise exception 'Only the assessment team changes a capability run.' using errcode = '42501';
      end if;
      return new;
    end if;
  else  -- eoc_assessment_responses
    if tg_op = 'DELETE' then
      raise exception 'A checklist response is corrected, never removed.' using errcode = '42501';
    end if;
    if not app.has_any_role(v_write) then
      raise exception 'Only the assessment team records checklist responses.' using errcode = '42501';
    end if;
    if (select r.status from public.eoc_assessment_runs r where r.id = new.run_id) = 'validated' then
      raise exception 'This run is validated and locked. Open a new run to reassess.' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.provenance := 'observed'; new.state := 'draft'; new.validated_by := null; new.validated_at := null;
      new.updated_by := auth.uid();
    elsif new.state is distinct from old.state then
      -- Validating or reopening one answer: the CDRRMO Head (or admin) only, and it carries no other edit.
      if not app.has_any_role(v_head) then
        raise exception 'Only the CDRRMO Head validates or reopens a checklist answer.' using errcode = '42501';
      end if;
      if new.state = 'validated' then
        if old.provenance <> 'observed' then
          raise exception 'This answer is pre-filled from the IAT. Confirm it on site before validating it.' using errcode = '23514';
        end if;
        new.validated_by := auth.uid(); new.validated_at := now();
      else
        new.validated_by := null; new.validated_at := null;
      end if;
      new.status := old.status; new.evidence := old.evidence; new.gap := old.gap; new.recommended_action := old.recommended_action;
      new.tool_links := old.tool_links; new.provenance := old.provenance; new.updated_by := old.updated_by;
      new.run_id := old.run_id; new.item_id := old.item_id; new.site := old.site;
      return new;
    elsif old.state = 'validated' then
      raise exception 'This answer is validated. Ask the CDRRMO Head to reopen it.' using errcode = '42501';
    else
      -- Any edit or confirmation by a person makes the answer observed.
      new.provenance := 'observed'; new.updated_by := auth.uid();
      new.validated_by := null; new.validated_at := null;
      new.run_id := old.run_id; new.item_id := old.item_id; new.site := old.site;
    end if;
    if new.status = 'no_direct_indicator' then
      raise exception 'Choose a status for this item (Met to Not met, Not applicable or Not assessed).' using errcode = '23514';
    end if;
    return new;
  end if;
end $$;

drop trigger if exists guard_eoc_assessment on public.eoc_assessment_runs;
create trigger guard_eoc_assessment before insert or update or delete on public.eoc_assessment_runs
  for each row execute function app.guard_eoc_assessment();
drop trigger if exists guard_eoc_assessment on public.eoc_assessment_responses;
create trigger guard_eoc_assessment before insert or update or delete on public.eoc_assessment_responses
  for each row execute function app.guard_eoc_assessment();

-- Board view: one denormalized row set for the capability board (every item of every run,
-- response fields where the run has answered the item).
drop view if exists public.v_eoc_assessment_board;
create view public.v_eoc_assessment_board with (security_invoker = true) as
select r.id as run_id, r.title as run_title, r.status as run_status, r.created_at as run_created_at,
       r.validated_by, r.validated_at, s.site,
       i.id as item_id, i.section, i.section_sort, i.item_no, i.item_text,
       i.applies_primary, i.applies_alternate, i.iat_links,
       p.id as response_id, coalesce(p.status, 'not_assessed') as status, p.provenance, p.state,
       p.evidence, p.gap, p.recommended_action, p.tool_links,
       p.updated_by, p.updated_at, p.validated_by as response_validated_by, p.validated_at as response_validated_at,
       p.version as response_version
  from public.eoc_assessment_runs r
  cross join (values ('primary'), ('alternate')) s(site)
  cross join public.eoc_assessment_items i
  left join public.eoc_assessment_responses p on p.run_id = r.id and p.item_id = i.id and p.site = s.site
 order by r.created_at, s.site desc, i.section_sort, i.item_no;
grant select on public.v_eoc_assessment_board to authenticated;
