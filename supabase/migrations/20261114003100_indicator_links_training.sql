-- =============================================================================
-- 1.21.0 (14 Nov 2026) - Indicator → MODE links, workshop flags and training runs (ADR-036, ADR-037).
--
-- The assessor's review of the EOC module against IAT v1-7 Part B_EOC (14 Nov 2026, for the
-- 1-4 December validation workshop) found that only 21 of 43 B indicators link to a protocol or
-- workflow, and that Tool results (ICS Tool, ECHO simulator) stay in the browser (ADR-011) so they
-- cannot serve as evidence. This migration adds three small records:
--   iat_indicator_links  the versioned map "Where this is done in MODE": indicator (B1.1..B7.6)
--                        to a screen, Tool, protocol or workflow. Navigation and evidence only —
--                        a link never changes a score, a threshold or an approval.
--   iat_workshop_flags   the workbook's own flags to settle at the workshop (e.g. B2.6/B3.1
--                        "CHECK — score 3 vs evidence"; B1.2/B2.1-B2.4 "score 3 holds only if the
--                        named documents are filed in the Vault"). Content only; no score logic.
--   training_runs        a server-side record of a Tool run (ICS exercise, ECHO simulator, PSCP,
--                        GK), so a run can be filed as evidence for B7.2-B7.4 and B2.7. Positions
--                        and counts ONLY in counts (RA 10173) — never personal names.
--
-- Rules: reads are reference data for every active user. The links map and the flags are maintained
-- by the administrator; saving a training run and filing it as evidence are authority actions
-- (ADR-006) for the assessor, validator, CDRRMO Head or admin — enforced here by
-- app.guard_training_run, never only in the UI. A filed run is corrected, never removed.
-- Scores stay with assessors and validators: filing adds an evidence record (kind 'test'); the
-- evidence cap and the score rules do not move.
--
-- Supports MR-14 (traceability). Indicators B7.2, B7.3, B7.4, B2.7, B7.6.
-- Safe to run again.
-- =============================================================================

create table if not exists public.iat_indicator_links (
  id           uuid primary key default gen_random_uuid(),
  indicator_id text not null references public.iat_indicators(id),
  target_kind  text not null check (target_kind in ('screen','tool','protocol','workflow')),
  target       text not null check (length(trim(target)) between 2 and 200),
  label        text not null check (length(trim(label)) between 3 and 200),
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  unique (indicator_id, target_kind, target)
);
comment on table public.iat_indicator_links is 'Where an IAT indicator is done in MODE (ADR-036): screen/tool targets are routes, protocol/workflow targets are protocol_templates codes. Navigation and evidence only — a link never changes a score.';
comment on column public.iat_indicator_links.target is 'Route for screen/tool (e.g. /eoc/roster, /tools/ics); protocol_templates.code for protocol/workflow (e.g. PR-ICS-INTERFACE).';
select app.track('public.iat_indicator_links');

alter table public.iat_indicator_links enable row level security;
drop policy if exists iat_indicator_links_read on public.iat_indicator_links;
drop policy if exists iat_indicator_links_insert on public.iat_indicator_links;
drop policy if exists iat_indicator_links_update on public.iat_indicator_links;
drop policy if exists iat_indicator_links_delete on public.iat_indicator_links;
create policy iat_indicator_links_read on public.iat_indicator_links for select to authenticated using (app.is_active_user());
create policy iat_indicator_links_insert on public.iat_indicator_links for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy iat_indicator_links_update on public.iat_indicator_links for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy iat_indicator_links_delete on public.iat_indicator_links for delete to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
grant select on public.iat_indicator_links to authenticated;
grant insert, update, delete on public.iat_indicator_links to authenticated;

create table if not exists public.iat_workshop_flags (
  indicator_id text primary key references public.iat_indicators(id),
  flag         text not null check (length(trim(flag)) between 3 and 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1
);
comment on table public.iat_workshop_flags is 'The workbook flags to settle at the validation workshop (ADR-036), shown on the Assess indicator and on the EOC capability board items that map to the indicator. Content only; no score logic.';
select app.track('public.iat_workshop_flags');

alter table public.iat_workshop_flags enable row level security;
drop policy if exists iat_workshop_flags_read on public.iat_workshop_flags;
drop policy if exists iat_workshop_flags_insert on public.iat_workshop_flags;
drop policy if exists iat_workshop_flags_update on public.iat_workshop_flags;
drop policy if exists iat_workshop_flags_delete on public.iat_workshop_flags;
create policy iat_workshop_flags_read on public.iat_workshop_flags for select to authenticated using (app.is_active_user());
create policy iat_workshop_flags_insert on public.iat_workshop_flags for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy iat_workshop_flags_update on public.iat_workshop_flags for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy iat_workshop_flags_delete on public.iat_workshop_flags for delete to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
grant select on public.iat_workshop_flags to authenticated;
grant insert, update, delete on public.iat_workshop_flags to authenticated;

create table if not exists public.training_runs (
  id                 uuid primary key default gen_random_uuid(),
  tool               text not null check (tool in ('ics_tool','echo_simulator','pscp','gk')),
  title              text not null check (length(trim(title)) between 3 and 200),
  run_at             timestamptz not null,
  summary            text,
  counts             jsonb not null default '{}' check (jsonb_typeof(counts) = 'object'),
  filed_evidence     boolean not null default false,
  filed_to_indicator text references public.iat_indicators(id),
  filed_by           uuid references public.profiles(id),
  filed_at           timestamptz,
  created_by         uuid default auth.uid() references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  version            integer not null default 1,
  check (filed_evidence = (filed_to_indicator is not null))
);
comment on table public.training_runs is 'Server-side record of a readiness-Tool run (ADR-037): scenario, outcome and counts so the run can be filed as IAT evidence. Positions and counts ONLY (RA 10173) — never personal names.';
comment on column public.training_runs.counts is 'Aggregate counts and positions only (e.g. {"role":"ic","correct":9,"total":12}). Never personal names (RA 10173).';
create index if not exists training_runs_tool_idx on public.training_runs (tool, run_at);
select app.track('public.training_runs');

alter table public.training_runs enable row level security;
drop policy if exists training_runs_read on public.training_runs;
drop policy if exists training_runs_insert on public.training_runs;
drop policy if exists training_runs_update on public.training_runs;
drop policy if exists training_runs_delete on public.training_runs;
create policy training_runs_read on public.training_runs for select to authenticated using (app.is_active_user());
create policy training_runs_insert on public.training_runs for insert to authenticated
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head','admin']::public.app_role[]));
create policy training_runs_update on public.training_runs for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head','admin']::public.app_role[]));
create policy training_runs_delete on public.training_runs for delete to authenticated using (app.is_active_user());
grant select on public.training_runs to authenticated;
grant insert, update, delete on public.training_runs to authenticated;

create or replace function app.guard_training_run() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_file constant public.app_role[] := array['assessor','validator','cdrrmo_head','admin']::public.app_role[];
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A training record is corrected, never removed.' using errcode = '42501';
  end if;
  if not app.has_any_role(v_file) then
    raise exception 'Only the assessment team saves a training record or files it as evidence.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    -- Filing stamps itself; it never reopens.
    if new.filed_evidence and not old.filed_evidence then
      new.filed_by := auth.uid();
      new.filed_at := now();
    elsif old.filed_evidence and (not new.filed_evidence or new.filed_to_indicator is distinct from old.filed_to_indicator) then
      raise exception 'A filed training record keeps its filing. File a new run to correct it.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' and new.filed_evidence then
    new.filed_by := auth.uid();
    new.filed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists guard_training_run on public.training_runs;
create trigger guard_training_run before insert or update or delete on public.training_runs
  for each row execute function app.guard_training_run();

-- A filed run links back to the evidence record it produced (navigation only).
alter table public.evidence add column if not exists training_run_id uuid references public.training_runs(id);
comment on column public.evidence.training_run_id is 'The Tool run this evidence was filed from (ADR-037). Navigation only; the evidence cap rules are unchanged.';
create index if not exists evidence_training_run_idx on public.evidence (training_run_id) where training_run_id is not null;
