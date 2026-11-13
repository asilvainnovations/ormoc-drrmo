-- =============================================================================
-- 1.20.0 (14 Nov 2026) - EOC capability self-assessment, mapped to IAT Part B (ADR-035).
--
-- The OCD/NDRRMC TWG "EOC Capability Assessment Checklist" (December 2017, adapted from FEMA) is the
-- facility-and-readiness complement to IAT Part B: B2.1, B2.2 and B2.4 tell the assessor to "record results
-- on the ... sheet of the EOC Capability Assessment Checklist". This migration stores the checklist and its
-- answers for the primary and the alternate EOC, per assessment cycle:
--   eoc_cap_items      the 154 checklist items (reference data), each with the IAT Part B indicators it maps to
--   eoc_cap_responses  one answer per (cycle, item, site): status, evidence observed, gap, action, Vault link
--
-- Provenance. The first answers were pre-filled from the IAT v1-7 scores (lowest mapped score: 3 Met,
-- 2 Partially met, 1 Largely unmet, 0 Not met) with the IAT text copied in. Those are a crosswalk, not an
-- observation: they are stored as provenance 'prefilled_iat'. Any edit or confirmation by a person makes the
-- answer 'observed', and only an observed answer can be validated (by the CDRRMO Head, online; ADR-006).
-- The roll-up view counts observed and pre-filled answers separately, so a pre-fill never reads as evidence.
--
-- The checklist itself says its components "are not requirements or guidelines, but rather a tool": nothing
-- here changes an IAT score. Supports MR-05 (EOC), MR-12 (evidence), MR-14 (traceability); IAT B1-B7.
-- Safe to run again.
-- =============================================================================

create table if not exists public.eoc_cap_items (
  id              uuid primary key,
  section_group   text not null check (length(section_group) <= 200),
  section         text not null check (length(section) <= 120),
  item_no         integer not null check (item_no > 0),
  item            text not null check (length(btrim(item)) between 3 and 1000),
  iat_indicators  text[] not null default '{}',
  assess_locally  boolean not null default false,
  sort            integer not null,
  source_ref      text not null default 'OCD/NDRRMC TWG EOC Capability Assessment Checklist (Dec 2017)',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  unique (section, item_no)
);
comment on table public.eoc_cap_items is 'EOC Capability Assessment Checklist items (OCD/NDRRMC TWG, Dec 2017) with the IAT Part B indicators each maps to (ADR-035).';
comment on column public.eoc_cap_items.assess_locally is 'No IAT Part B counterpart (e.g. CBRNE or blast protection, helicopter landing zone): assessed on its own merits.';
select app.track('public.eoc_cap_items');

create table if not exists public.eoc_cap_responses (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references public.assessment_cycles(id),
  item_id             uuid not null references public.eoc_cap_items(id),
  site                text not null check (site in ('primary', 'alternate')),
  status              text not null default 'not_assessed'
                      check (status in ('not_assessed', 'met', 'partially_met', 'largely_unmet', 'not_met', 'not_applicable')),
  provenance          text not null default 'observed' check (provenance in ('prefilled_iat', 'observed')),
  evidence_observed   text check (evidence_observed is null or length(evidence_observed) <= 6000),
  gap_remarks         text check (gap_remarks is null or length(gap_remarks) <= 6000),
  recommended_action  text check (recommended_action is null or length(recommended_action) <= 6000),
  vault_document_id   uuid references public.vault_documents(id),
  state               text not null default 'draft' check (state in ('draft', 'validated')),
  assessed_by         uuid references public.profiles(id),
  assessed_at         timestamptz,
  validated_by        uuid references public.profiles(id),
  validated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (cycle_id, item_id, site),
  check (status <> 'not_applicable' or length(btrim(coalesce(gap_remarks, ''))) > 0)
);
create index if not exists eoc_cap_responses_cycle_idx on public.eoc_cap_responses (cycle_id, site);
comment on column public.eoc_cap_responses.provenance is 'prefilled_iat: copied from the IAT v1-7 crosswalk, not observed. observed: set or confirmed by a person.';
comment on column public.eoc_cap_responses.gap_remarks is 'Required when the item is marked not applicable (the reason). Positions and offices only, never personal names.';
select app.track('public.eoc_cap_responses');

-- Guard: plain-English refusals (errcode 42501 / 23514). Seeds and the SQL editor run as the table owner and
-- pass, as in app.guard_protocol_template; the pre-fill is loaded that way.
create or replace function app.guard_eoc_cap_response() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_cycle text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  select status into v_cycle from public.assessment_cycles where id = new.cycle_id;
  if v_cycle in ('final', 'archived') then
    raise exception 'This assessment cycle is %. Open a new cycle to record changes.', v_cycle using errcode = '42501';
  end if;
  if not app.has_any_role(array['assessor', 'validator', 'cdrrmo_head', 'admin']::public.app_role[]) then
    raise exception 'Only the assessment team records the EOC capability checklist.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.state := 'draft';
    new.provenance := 'observed';
    new.assessed_by := auth.uid(); new.assessed_at := now();
    new.validated_by := null; new.validated_at := null;
    return new;
  end if;

  if new.state is distinct from old.state then
    if not app.has_role('cdrrmo_head') then
      raise exception 'Only the CDRRMO Head validates or reopens a checklist answer.' using errcode = '42501';
    end if;
    if new.state = 'validated' then
      if old.provenance <> 'observed' then
        raise exception 'This answer is pre-filled from the IAT. Confirm it on site before validating it.' using errcode = '23514';
      end if;
      if new.status = 'not_assessed' then
        raise exception 'Record a status before validating.' using errcode = '23514';
      end if;
      new.validated_by := auth.uid(); new.validated_at := now();
    else
      new.validated_by := null; new.validated_at := null;
    end if;
    -- A state change carries no other edit, so who assessed what stays clear.
    new.status := old.status; new.evidence_observed := old.evidence_observed; new.gap_remarks := old.gap_remarks;
    new.recommended_action := old.recommended_action; new.vault_document_id := old.vault_document_id;
    new.provenance := old.provenance; new.assessed_by := old.assessed_by; new.assessed_at := old.assessed_at;
    return new;
  end if;

  if old.state = 'validated' then
    raise exception 'This answer is validated. Ask the CDRRMO Head to reopen it.' using errcode = '42501';
  end if;
  -- Any edit or confirmation by a person turns a pre-filled answer into an observed one.
  new.provenance := 'observed';
  new.assessed_by := auth.uid(); new.assessed_at := now();
  new.validated_by := null; new.validated_at := null;
  new.cycle_id := old.cycle_id; new.item_id := old.item_id; new.site := old.site;
  return new;
end $$;

drop trigger if exists guard_eoc_cap_response on public.eoc_cap_responses;
create trigger guard_eoc_cap_response before insert or update on public.eoc_cap_responses
  for each row execute function app.guard_eoc_cap_response();

-- Reads: any active user (reference and assessment data, like the IAT). Writes: the guard decides; RLS keeps the
-- role line as a second check. No deletes: an answer is corrected, never removed.
alter table public.eoc_cap_items enable row level security;
drop policy if exists eoc_cap_items_read on public.eoc_cap_items;
create policy eoc_cap_items_read on public.eoc_cap_items for select to authenticated using (app.is_active_user());
grant select on public.eoc_cap_items to authenticated;
revoke insert, update, delete, truncate on public.eoc_cap_items from anon, authenticated;

alter table public.eoc_cap_responses enable row level security;
drop policy if exists eoc_cap_responses_read on public.eoc_cap_responses;
drop policy if exists eoc_cap_responses_insert on public.eoc_cap_responses;
drop policy if exists eoc_cap_responses_update on public.eoc_cap_responses;
create policy eoc_cap_responses_read on public.eoc_cap_responses for select to authenticated using (app.is_active_user());
create policy eoc_cap_responses_insert on public.eoc_cap_responses for insert to authenticated
  with check (app.has_any_role(array['assessor', 'validator', 'cdrrmo_head', 'admin']::public.app_role[]));
create policy eoc_cap_responses_update on public.eoc_cap_responses for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['assessor', 'validator', 'cdrrmo_head', 'admin']::public.app_role[]));
grant select, insert, update on public.eoc_cap_responses to authenticated;
revoke delete, truncate on public.eoc_cap_responses from anon, authenticated;

-- Roll-up to the IAT Part B domains (B1-B7). An item mapped to indicators in two domains counts in each;
-- items with no IAT counterpart roll up under 'local'. A missing answer counts as not assessed.
drop view if exists public.v_eoc_cap_domains;
create view public.v_eoc_cap_domains with (security_invoker = true) as
with item_domains as (
  select i.id as item_id, d.domain
    from public.eoc_cap_items i
    cross join lateral (
      select distinct split_part(x, '.', 1) as domain from unnest(i.iat_indicators) x
      union all select 'local' where cardinality(i.iat_indicators) = 0
    ) d
), grid as (
  select c.id as cycle_id, s.site, idm.item_id, idm.domain
    from public.assessment_cycles c
    cross join (values ('primary'), ('alternate')) s(site)
    cross join item_domains idm
)
select g.cycle_id, g.site, g.domain,
       count(*)                                                                   as items,
       count(*) filter (where r.status = 'met')                                   as met,
       count(*) filter (where r.status = 'partially_met')                         as partially_met,
       count(*) filter (where r.status = 'largely_unmet')                         as largely_unmet,
       count(*) filter (where r.status = 'not_met')                               as not_met,
       count(*) filter (where r.status = 'not_applicable')                        as not_applicable,
       count(*) filter (where r.status is null or r.status = 'not_assessed')      as not_assessed,
       count(*) filter (where r.provenance = 'observed' and r.status <> 'not_assessed') as observed,
       count(*) filter (where r.provenance = 'prefilled_iat' and r.status <> 'not_assessed') as prefilled,
       count(*) filter (where r.state = 'validated')                              as validated
  from grid g
  left join public.eoc_cap_responses r
    on r.cycle_id = g.cycle_id and r.item_id = g.item_id and r.site = g.site
 group by g.cycle_id, g.site, g.domain;
grant select on public.v_eoc_cap_domains to authenticated;
