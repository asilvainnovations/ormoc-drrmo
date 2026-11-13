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
-- Supports MR-14 (traceability). Indicators B2.1, B2.7, B4.1, B6.3, B7.1.
-- Safe to run again.
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
  status              text not null check (status in ('met','partially_met','largely_unmet','not_met','no_direct_indicator')),
  evidence            text,
  gap                 text,
  recommended_action  text,
  tool_links          jsonb not null default '[]' check (jsonb_typeof(tool_links) = 'array'),
  updated_by          uuid default auth.uid() references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (run_id, item_id)
);
comment on table public.eoc_assessment_responses is 'One answer per (run, checklist item): status from the weakest mapped IAT score, evidence observed, gap and recommended action kept verbatim from the workbook (ADR-035).';
comment on column public.eoc_assessment_responses.status is 'met / partially_met / largely_unmet / not_met from the weakest mapped IAT indicator score (app.eoc_assessment_status); no_direct_indicator when the item maps to no B_EOC indicator.';
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
    if tg_op = 'UPDATE' then
      new.updated_by := auth.uid();
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
       r.validated_by, r.validated_at,
       i.id as item_id, i.section, i.section_sort, i.item_no, i.item_text,
       i.applies_primary, i.applies_alternate, i.iat_links,
       p.id as response_id, p.status, p.evidence, p.gap, p.recommended_action, p.tool_links,
       p.updated_by, p.updated_at, p.version as response_version
  from public.eoc_assessment_runs r
  cross join public.eoc_assessment_items i
  left join public.eoc_assessment_responses p on p.run_id = r.id and p.item_id = i.id
 order by r.created_at, i.section_sort, i.item_no;
grant select on public.v_eoc_assessment_board to authenticated;
