-- =============================================================================
-- 0002 INSTITUTIONAL ASSESSMENT TOOL (IAT v1.1)
-- Reference catalogue (140 indicators, 22 domains, 18 master requirements),
-- assessment cycles, evidence-gated scoring, action plan and result views.
-- Rules implemented here are the single source of truth (ADR-004):
--   evidence cap · gap priority · compliance status · maturity index · bands.
-- =============================================================================

-- ---------------------------------------------------------------- reference --
create table public.iat_parts (
  code     text primary key check (code in ('A','B','C')),
  name     text not null,
  in_imi   boolean not null,            -- Part C is reported separately (Interface Index)
  sort     smallint not null
);

create table public.iat_domains (
  code              text primary key,    -- A1 … C5
  part              text not null references public.iat_parts(code),
  name              text not null,
  scope             text,
  functional_area   text,
  platform_module   text,
  sort              smallint not null
);

create table public.iat_indicators (
  id                    text primary key,                 -- e.g. A1.8
  domain                text not null references public.iat_domains(code),
  statement             text not null,
  reference             text not null,
  type                  text not null check (type in ('M','GP')),
  weight                smallint not null check (weight between 1 and 3),
  means_of_verification text,
  methods               text,
  moo_chapter           text,
  lead_office           text,                              -- Part C only (as written in the IAT)
  tags                  text[] not null default '{}',      -- 'RA 12287', 'UNDRR Scorecard', 'Interface'
  version_status        text not null default 'Unchanged',
  sort                  smallint not null,
  is_active             boolean not null default true
);
create index iat_indicators_domain_idx on public.iat_indicators(domain, sort);

create table public.master_requirements (
  id                 text primary key,  -- MR-01 … MR-18
  title              text not null,
  statement          text not null,
  source_basis       text,
  iat_coverage       text,
  evidence           text,
  sa_output          text,
  moo_output         text,
  platform_req       text,
  data_entities      text,
  escalation_rule    text,
  priority           text check (priority in ('Critical','High','Medium','Low')),
  sort               smallint not null
);

create table public.indicator_requirements (
  indicator_id  text not null references public.iat_indicators(id) on delete cascade,
  mr_id         text not null references public.master_requirements(id) on delete cascade,
  primary key (indicator_id, mr_id)
);

-- Which office(s) answer for a Part C indicator.
create table public.indicator_lead_offices (
  indicator_id  text not null references public.iat_indicators(id) on delete cascade,
  office_id     uuid not null references public.offices(id) on delete cascade,
  primary key (indicator_id, office_id)
);

create table public.framework_crosswalk (
  id          bigint generated always as identity primary key,
  framework   text not null check (framework in ('UNDRR DRSC','RA 12287 IRR')),
  ref         text not null,
  subject     text not null,
  treatment   text not null,
  indicators  text,
  note        text,
  sort        smallint not null
);

-- ---------------------------------------------------------------- rules -----
create type public.evidence_strength as enum (
  'verbal',            -- interview / FGD account only
  'partial',           -- draft/partial document or partial practice observed
  'approved_in_use',   -- approved document AND proof of use
  'tested_improved'    -- level 3 + test/exercise/AAR showing improvement
);

-- Highest score a piece of evidence can support (IAT §5.2 evidence rule).
create or replace function public.evidence_cap(s public.evidence_strength) returns smallint
language sql immutable as $$
  select case s
    when 'verbal' then 2           -- interviews/FGDs alone cannot raise a score above 2
    when 'partial' then 2
    when 'approved_in_use' then 3
    when 'tested_improved' then 4
    else 0 end::smallint
$$;

create or replace function public.gap_priority_score(score smallint, weight smallint, type text, part text)
returns numeric language sql immutable as $$
  select case when score is null then null
    else (4 - score) * weight * case when type = 'M' and part <> 'C' then 1.5 else 1.0 end end
$$;

create or replace function public.priority_band(gps numeric) returns text
language sql immutable as $$
  select case when gps is null then null when gps >= 9 then 'High' when gps >= 4 then 'Medium' else 'Low' end
$$;

create or replace function public.maturity_band(idx numeric) returns text
language sql immutable as $$
  select case when idx is null then null
    when idx < 0.5 then 'Absent' when idx < 1.5 then 'Initial' when idx < 2.5 then 'Developing'
    when idx < 3.5 then 'Compliant' else 'Advanced' end
$$;

-- ---------------------------------------------------------------- cycles ----
create table public.assessment_cycles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  cycle_year    smallint not null,
  iat_version   text not null default '1.1',
  status        text not null default 'draft'
                check (status in ('draft','fieldwork','validation','final','archived')),
  period_from   date,
  period_to     date,
  validated_on  date,
  notes         text,
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);

create table public.responses (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references public.assessment_cycles(id) on delete cascade,
  indicator_id        text not null references public.iat_indicators(id),
  score               smallint check (score between 0 and 4),
  is_na               boolean not null default false,
  na_justification    text,
  gap_remarks         text,
  recommended_action  text,
  status              text not null default 'draft' check (status in ('draft','provisional','validated')),
  assessed_by         uuid default auth.uid() references public.profiles(id),
  validated_by        uuid references public.profiles(id),
  validated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (cycle_id, indicator_id),
  check (not (is_na and score is not null)),
  check (not is_na or coalesce(length(trim(na_justification)), 0) > 0)
);
create index responses_cycle_idx on public.responses(cycle_id);

create table public.evidence (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.responses(id) on delete cascade,
  kind          text not null check (kind in ('document','observation','interview','fgd','test','photo')),
  strength      public.evidence_strength not null,
  title         text not null,
  doc_date      date,
  source        text,                 -- office / position, never an informant's name
  storage_path  text,                 -- private bucket 'evidence'
  note          text,
  captured_by   uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  -- interviews and FGDs are verbal evidence by definition
  check (kind not in ('interview','fgd') or strength = 'verbal')
);
create index evidence_response_idx on public.evidence(response_id);

create table public.response_history (
  id            bigint generated always as identity primary key,
  response_id   uuid not null references public.responses(id) on delete cascade,
  at            timestamptz not null default now(),
  actor         uuid default auth.uid(),
  score         smallint,
  is_na         boolean,
  status        text,
  reason        text
);

create table public.actions (
  id                     uuid primary key default gen_random_uuid(),
  cycle_id               uuid not null references public.assessment_cycles(id) on delete cascade,
  indicator_id           text not null references public.iat_indicators(id),
  action                 text not null,
  responsible_office_id  uuid references public.offices(id),
  responsible_person     text,
  target_date            date,
  budget_source          text,
  status                 text not null default 'not_started'
                         check (status in ('not_started','ongoing','done','dropped')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  version                integer not null default 1
);
create index actions_cycle_idx on public.actions(cycle_id, indicator_id);

select app.track('public.assessment_cycles');
select app.track('public.responses');
select app.track('public.evidence');
select app.track('public.actions');

-- ------------------------------------------------- integrity triggers -------
-- 1. Evidence gate: a score can never exceed what its strongest evidence supports.
create or replace function app.enforce_evidence_gate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cap smallint;
begin
  if new.score is null or new.score = 0 then return new; end if;
  select coalesce(max(public.evidence_cap(e.strength)), 0) into v_cap
  from public.evidence e where e.response_id = new.id;
  if new.score > v_cap then
    raise exception 'Score % is above what the evidence supports (maximum %).', new.score, v_cap
      using errcode = '23514',
            hint = case when v_cap < 3 then 'A score of 3 needs an approved document and proof of use. Interviews alone cap the score at 2.'
                        else 'A score of 4 needs a test, exercise or after-action review showing improvement.' end;
  end if;
  return new;
end $$;
create trigger enforce_evidence_gate before insert or update of score on public.responses
  for each row execute function app.enforce_evidence_gate();

-- Removing or weakening evidence must not leave an over-scored response behind.
create or replace function app.recheck_after_evidence_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_resp public.responses; v_cap smallint;
begin
  select * into v_resp from public.responses where id = coalesce(old.response_id, new.response_id);
  if v_resp.score is null or v_resp.score = 0 then return null; end if;
  select coalesce(max(public.evidence_cap(e.strength)), 0) into v_cap
  from public.evidence e where e.response_id = v_resp.id;
  if v_resp.score > v_cap then
    raise exception 'This change would leave indicator % scored % with evidence supporting only %. Lower the score first.',
      v_resp.indicator_id, v_resp.score, v_cap using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger recheck_after_evidence_change after update or delete on public.evidence
  deferrable initially deferred for each row execute function app.recheck_after_evidence_change();

-- 2. Workflow: only validators validate; validated scores are locked to validators.
create or replace function app.guard_response_workflow() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_part text;
begin
  if new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated') then
    if not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only a validator can validate a score' using errcode = '42501';
    end if;
    if new.score is null and not new.is_na then
      raise exception 'Score the indicator or mark it not applicable before validating' using errcode = '23514';
    end if;
    new.validated_by := auth.uid();
    new.validated_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status = 'validated'
     and not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
    raise exception 'This score is validated. Ask a validator to reopen it.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'validated' and new.status <> 'validated' then
    new.validated_by := null; new.validated_at := null;
  end if;
  return new;
end $$;
create trigger guard_response_workflow before insert or update on public.responses
  for each row execute function app.guard_response_workflow();

-- 3. History of every score/status change (trend and accountability).
create or replace function app.log_response_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.score is distinct from old.score or new.is_na is distinct from old.is_na
     or new.status is distinct from old.status then
    insert into public.response_history (response_id, score, is_na, status)
    values (new.id, new.score, new.is_na, new.status);
  end if;
  return null;
end $$;
create trigger log_response_history after insert or update on public.responses
  for each row execute function app.log_response_history();

-- 4. Closed cycles are read-only.
create or replace function app.guard_closed_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text; v_cycle uuid;
begin
  if tg_table_name = 'evidence' then
    select r.cycle_id into v_cycle from public.responses r where r.id = coalesce(new.response_id, old.response_id);
  else
    v_cycle := coalesce(new.cycle_id, old.cycle_id);
  end if;
  select status into v_status from public.assessment_cycles where id = v_cycle;
  if v_status in ('final','archived') and not app.has_role('admin') then
    raise exception 'This assessment cycle is %. Open a new cycle to record changes.', v_status using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_closed_cycle before insert or update or delete on public.responses
  for each row execute function app.guard_closed_cycle();
create trigger guard_closed_cycle before insert or update or delete on public.evidence
  for each row execute function app.guard_closed_cycle();
create trigger guard_closed_cycle before insert or update or delete on public.actions
  for each row execute function app.guard_closed_cycle();

-- ---------------------------------------------------------------- views -----
create view public.v_response_results with (security_invoker = true) as
select
  r.id as response_id, r.cycle_id, i.id as indicator_id, i.domain, d.part, i.type, i.weight,
  r.score, r.is_na, r.status,
  case when r.score is not null and not r.is_na then 1 else 0 end as is_scored,
  public.gap_priority_score(r.score, i.weight, i.type, d.part) as gap_priority_score,
  public.priority_band(public.gap_priority_score(r.score, i.weight, i.type, d.part)) as priority,
  case
    when r.is_na then 'N/A'
    when r.score is null then 'Not scored'
    when i.type = 'M' and d.part <> 'C' then case when r.score >= 3 then 'Compliant' else 'Non-compliant' end
    else case when r.score >= 3 then 'Meets GP' else 'Below GP' end
  end as compliance_status,
  (select coalesce(max(public.evidence_cap(e.strength)), 0) from public.evidence e where e.response_id = r.id) as evidence_cap
from public.responses r
join public.iat_indicators i on i.id = r.indicator_id
join public.iat_domains d on d.code = i.domain;

create view public.v_domain_results with (security_invoker = true) as
select
  c.id as cycle_id, d.code as domain, d.part, d.name,
  count(i.id) as indicators,
  count(rr.response_id) filter (where rr.is_scored = 1) as scored,
  round(sum(rr.score * rr.weight) filter (where rr.is_scored = 1)::numeric
        / nullif(sum(rr.weight) filter (where rr.is_scored = 1), 0), 2) as maturity_index,
  public.maturity_band(round(sum(rr.score * rr.weight) filter (where rr.is_scored = 1)::numeric
        / nullif(sum(rr.weight) filter (where rr.is_scored = 1), 0), 2)) as maturity_band,
  round(count(*) filter (where rr.is_scored = 1 and rr.type = 'M' and d.part <> 'C' and rr.score >= 3)::numeric
        / nullif(count(*) filter (where rr.is_scored = 1 and rr.type = 'M' and d.part <> 'C'), 0), 4) as mandatory_compliance,
  count(*) filter (where rr.priority = 'High') as high_gaps
from public.assessment_cycles c
cross join public.iat_domains d
join public.iat_indicators i on i.domain = d.code and i.is_active
left join public.v_response_results rr on rr.cycle_id = c.id and rr.indicator_id = i.id
group by c.id, d.code, d.part, d.name, d.sort
order by d.sort;

-- Part A, Part B, Institutional Maturity Index (A+B) and the separate Interface Index (C).
create view public.v_cycle_results with (security_invoker = true) as
with rr as (select * from public.v_response_results where is_scored = 1),
groups(cycle_id, grp, label, sort) as (
  select c.id, g.grp, g.label, g.sort from public.assessment_cycles c
  cross join (values ('A','Part A – CDRRMO',1), ('B','Part B – EOC',2),
                     ('IMI','Institutional Maturity Index (A+B)',3),
                     ('C','Part C – Interface Index (separate)',4)) g(grp,label,sort)
)
select g.cycle_id, g.grp, g.label,
  count(rr.*) as scored,
  round(sum(rr.score * rr.weight)::numeric / nullif(sum(rr.weight), 0), 2) as maturity_index,
  public.maturity_band(round(sum(rr.score * rr.weight)::numeric / nullif(sum(rr.weight), 0), 2)) as maturity_band,
  round(count(*) filter (where rr.type = 'M' and rr.part <> 'C' and rr.score >= 3)::numeric
        / nullif(count(*) filter (where rr.type = 'M' and rr.part <> 'C'), 0), 4) as mandatory_compliance,
  count(*) filter (where rr.priority = 'High') as high_gaps
from groups g
left join rr on rr.cycle_id = g.cycle_id and (
  (g.grp in ('A','B','C') and rr.part = g.grp) or (g.grp = 'IMI' and rr.part in ('A','B')))
group by g.cycle_id, g.grp, g.label, g.sort
order by g.sort;

-- ---------------------------------------------------------------- RLS -------
alter table public.iat_parts enable row level security;
alter table public.iat_domains enable row level security;
alter table public.iat_indicators enable row level security;
alter table public.master_requirements enable row level security;
alter table public.indicator_requirements enable row level security;
alter table public.indicator_lead_offices enable row level security;
alter table public.framework_crosswalk enable row level security;
alter table public.assessment_cycles enable row level security;
alter table public.responses enable row level security;
alter table public.evidence enable row level security;
alter table public.response_history enable row level security;
alter table public.actions enable row level security;

-- Reference catalogue: readable by any active user, maintained by admin.
do $$ declare t text; begin
  foreach t in array array['iat_parts','iat_domains','iat_indicators','master_requirements',
                           'indicator_requirements','indicator_lead_offices','framework_crosswalk'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (app.has_role(''admin'')) with check (app.has_role(''admin''))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

create policy cycles_read on public.assessment_cycles for select to authenticated using (app.is_active_user());
create policy cycles_write on public.assessment_cycles for all to authenticated
  using (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]));

-- Can the current user answer this indicator? Assessors: Parts A and B.
-- Lead-office focal persons: only the Part C indicators assigned to their office.
create or replace function app.can_answer(p_indicator text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[])
      or (app.has_role('lead_office_focal') and exists (
            select 1 from public.indicator_lead_offices l
            where l.indicator_id = p_indicator and l.office_id = app.my_office()))
$$;
grant execute on function app.can_answer(text) to authenticated;

create policy responses_read on public.responses for select to authenticated using (app.is_active_user());
create policy responses_insert on public.responses for insert to authenticated with check (app.can_answer(indicator_id));
create policy responses_update on public.responses for update to authenticated
  using (app.can_answer(indicator_id)) with check (app.can_answer(indicator_id));
create policy responses_delete on public.responses for delete to authenticated using (app.has_role('admin'));

create policy evidence_read on public.evidence for select to authenticated using (app.is_active_user());
create policy evidence_write on public.evidence for all to authenticated
  using (exists (select 1 from public.responses r where r.id = response_id and app.can_answer(r.indicator_id)))
  with check (exists (select 1 from public.responses r where r.id = response_id and app.can_answer(r.indicator_id)));

create policy history_read on public.response_history for select to authenticated using (app.is_active_user());

create policy actions_read on public.actions for select to authenticated using (app.is_active_user());
create policy actions_write on public.actions for all to authenticated
  using (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['assessor','validator','cdrrmo_head']::public.app_role[]));

grant select, insert, update, delete on public.assessment_cycles, public.responses, public.evidence, public.actions to authenticated;
grant select on public.response_history, public.v_response_results, public.v_domain_results, public.v_cycle_results to authenticated;
grant execute on function public.evidence_cap(public.evidence_strength), public.gap_priority_score(smallint,smallint,text,text),
  public.priority_band(numeric), public.maturity_band(numeric) to authenticated, anon;
