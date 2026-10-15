-- =============================================================================
-- 0004 EOC OPERATIONS
-- Hazards, activation levels (White / Blue / Red), incidents, logbook,
-- SitReps, barangay status reports, evacuation centres, resources and requests.
-- =============================================================================

create table public.hazards (
  code                   text primary key,
  name                   text not null,
  forecastable           boolean not null,       -- RA 12287 covers hazards that can be modelled and forecast
  typical_lead_hours     integer,                -- planning figure; the PDRA records the actual lead time
  declaration_eligible   boolean not null,       -- may reach the 3-day lead time for a State of Imminent Disaster
  note                   text,
  sort                   smallint not null
);

create type public.eoc_level as enum ('white','blue','red');

create table public.eoc_activations (
  id              uuid primary key default gen_random_uuid(),
  level           public.eoc_level not null,
  reason          text not null,
  hazard_code     text references public.hazards(code),
  authority_ref   text,                         -- memo / instruction number
  started_by      uuid default auth.uid() references public.profiles(id),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  ended_by        uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  check (ended_at is null or ended_at >= started_at)
);
create unique index eoc_one_open_activation on public.eoc_activations ((true)) where ended_at is null;

create table public.incidents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  hazard_code    text references public.hazards(code),
  activation_id  uuid references public.eoc_activations(id),
  location_text  text,
  started_at     timestamptz not null default now(),
  status         text not null default 'active' check (status in ('active','contained','closed')),
  incident_commander text,
  created_by     uuid default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);

-- Append-only operations log. Corrections are new entries that reference the original.
create table public.logbook_entries (
  id             uuid primary key default gen_random_uuid(),
  activation_id  uuid references public.eoc_activations(id),
  incident_id    uuid references public.incidents(id),
  occurred_at    timestamptz not null default now(),
  category       text not null default 'general'
                 check (category in ('general','decision','warning','request','resource','report','level_change','correction')),
  entry          text not null check (length(trim(entry)) > 0),
  corrects_id    uuid references public.logbook_entries(id),
  author         uuid default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now(),
  check (category <> 'correction' or corrects_id is not null)
);
create index logbook_activation_idx on public.logbook_entries(activation_id, occurred_at desc);
create trigger audit_row after insert on public.logbook_entries for each row execute function app.audit();

create table public.sitreps (
  id              uuid primary key default gen_random_uuid(),
  activation_id   uuid references public.eoc_activations(id),
  incident_id     uuid references public.incidents(id),
  seq             integer,                      -- assigned on submission
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  status          text not null default 'draft' check (status in ('draft','submitted','approved')),
  situation       text,
  actions_taken   text,
  needs           text,
  -- aggregate figures only; no names of affected persons (RA 10173)
  affected_families   integer check (affected_families >= 0),
  affected_persons    integer check (affected_persons >= 0),
  evacuated_families  integer check (evacuated_families >= 0),
  evacuated_persons   integer check (evacuated_persons >= 0),
  dead      integer check (dead >= 0),
  injured   integer check (injured >= 0),
  missing   integer check (missing >= 0),
  prepared_by   uuid default auth.uid() references public.profiles(id),
  submitted_at  timestamptz,
  approved_by   uuid references public.profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  check (period_end > period_start)
);

create table public.barangays (
  psgc            text primary key,             -- PSA Philippine Standard Geographic Code
  name            text not null,
  classification  text[] not null default '{}', -- urban, coastal, riverine, upland
  population      integer,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);

create table public.barangay_reports (
  id                  uuid primary key default gen_random_uuid(),
  barangay_psgc       text not null references public.barangays(psgc),
  activation_id       uuid references public.eoc_activations(id),
  reported_at         timestamptz not null default now(),
  condition           text not null check (condition in ('normal','monitoring','affected','isolated','evacuating')),
  families_evacuated  integer not null default 0 check (families_evacuated >= 0),
  persons_evacuated   integer not null default 0 check (persons_evacuated >= 0),
  remarks             text,
  channel             text check (channel in ('radio','sms','call','app','in_person')),
  reported_by         uuid default auth.uid() references public.profiles(id),
  created_at          timestamptz not null default now()
);
create index barangay_reports_latest_idx on public.barangay_reports(barangay_psgc, reported_at desc);

create table public.evacuation_centers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  barangay_psgc   text references public.barangays(psgc),
  capacity_persons integer check (capacity_persons >= 0),
  is_permanent    boolean not null default false,   -- RA 12076 Ligtas Pinoy Center
  accessible      boolean,
  status          text not null default 'closed' check (status in ('closed','open','full')),
  occupancy_persons integer not null default 0 check (occupancy_persons >= 0),
  lat double precision, lng double precision,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);

create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null check (category in ('vehicle','heavy_equipment','rescue','medical','relief','communications','power','other')),
  unit             text not null default 'unit',
  quantity         numeric not null default 0 check (quantity >= 0),
  owner_office_id  uuid references public.offices(id),
  location_text    text,
  is_serviceable   boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1
);

create table public.resource_requests (
  id                 uuid primary key default gen_random_uuid(),
  activation_id      uuid references public.eoc_activations(id),
  incident_id        uuid references public.incidents(id),
  requesting_party   text not null,               -- office, barangay or incident commander
  item               text not null,
  quantity           numeric not null check (quantity > 0),
  unit               text not null default 'unit',
  priority           text not null default 'routine' check (priority in ('life_safety','urgent','routine')),
  needed_by          timestamptz,
  status             text not null default 'requested'
                     check (status in ('requested','approved','mobilized','delivered','demobilized','rejected')),
  resource_id        uuid references public.resources(id),
  decision_note      text,
  requested_at       timestamptz not null default now(),
  approved_at        timestamptz,
  mobilized_at       timestamptz,
  delivered_at       timestamptz,
  demobilized_at     timestamptz,
  created_by         uuid default auth.uid() references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  version            integer not null default 1,
  check (status <> 'rejected' or coalesce(length(trim(decision_note)),0) > 0)
);

select app.track('public.eoc_activations');
select app.track('public.incidents');
select app.track('public.sitreps');
select app.track('public.barangays', false);
select app.track('public.evacuation_centers');
select app.track('public.resources');
select app.track('public.resource_requests');
create trigger audit_row after insert on public.barangay_reports for each row execute function app.audit();

-- Resource request lifecycle: forward-only transitions with timestamps.
create or replace function app.guard_resource_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare allowed text[];
begin
  if new.status = old.status then return new; end if;
  allowed := case old.status
    when 'requested' then array['approved','rejected']
    when 'approved' then array['mobilized','rejected']
    when 'mobilized' then array['delivered']
    when 'delivered' then array['demobilized']
    else array[]::text[] end;
  if not new.status = any(allowed) then
    raise exception 'A request that is % cannot move to %', old.status, new.status using errcode = '22023';
  end if;
  if new.status in ('approved','rejected') and not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager can approve or reject requests' using errcode = '42501';
  end if;
  case new.status
    when 'approved' then new.approved_at := now();
    when 'mobilized' then new.mobilized_at := now();
    when 'delivered' then new.delivered_at := now();
    when 'demobilized' then new.demobilized_at := now();
    else null;
  end case;
  return new;
end $$;
create trigger guard_resource_request before update of status on public.resource_requests
  for each row execute function app.guard_resource_request();

-- SitRep: numbered on submission; approved SitReps are locked.
create or replace function app.guard_sitrep() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'Approved SitReps cannot be changed. Issue the next SitRep instead.' using errcode = '42501';
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.submitted_at := now();
    if new.seq is null then
      select coalesce(max(seq), 0) + 1 into new.seq from public.sitreps
       where activation_id is not distinct from new.activation_id and seq is not null;
    end if;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the EOC Manager can approve a SitRep' using errcode = '42501';
    end if;
    if new.submitted_at is null then raise exception 'Submit the SitRep before approving it' using errcode = '22023'; end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  return new;
end $$;
create trigger guard_sitrep before insert or update on public.sitreps
  for each row execute function app.guard_sitrep();

-- Change the EOC level. Closes the open activation, opens the new one, logs it.
create or replace function public.set_eoc_level(p_level public.eoc_level, p_reason text,
  p_hazard text default null, p_authority text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_open public.eoc_activations; v_new uuid;
begin
  if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager or CDRRMO Head can change the activation level' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_reason)),0) = 0 then
    raise exception 'Give the reason for the level change' using errcode = '23514';
  end if;
  -- White is the normal state: no open activation. Blue and Red are open activations.
  select * into v_open from public.eoc_activations where ended_at is null for update;
  if (v_open.id is null and p_level = 'white') or (v_open.id is not null and v_open.level = p_level) then
    raise exception 'The EOC is already at % level', p_level using errcode = '22023';
  end if;
  if v_open.id is not null then
    update public.eoc_activations set ended_at = now(), ended_by = auth.uid(), version = version
     where id = v_open.id;
  end if;
  if p_level = 'white' then
    v_new := v_open.id;     -- the log entry stays with the activation being closed
  else
    insert into public.eoc_activations (level, reason, hazard_code, authority_ref)
    values (p_level, p_reason, p_hazard, p_authority) returning id into v_new;
  end if;
  insert into public.logbook_entries (activation_id, category, entry, author)
  values (v_new, 'level_change',
          format('EOC level changed %s → %s. Reason: %s', coalesce(upper(v_open.level::text), 'WHITE'), upper(p_level::text), p_reason),
          auth.uid());
  return v_new;
end $$;
grant execute on function public.set_eoc_level(public.eoc_level, text, text, text) to authenticated;

create view public.v_eoc_status with (security_invoker = true) as
select coalesce(a.level, 'white'::public.eoc_level) as level, a.id as activation_id, a.reason, a.hazard_code,
       a.started_at, a.started_by
from (select 1) one
left join public.eoc_activations a on a.ended_at is null;

create view public.v_barangay_latest with (security_invoker = true) as
select distinct on (r.barangay_psgc) r.*, b.name as barangay_name, b.classification
from public.barangay_reports r join public.barangays b on b.psgc = r.barangay_psgc
order by r.barangay_psgc, r.reported_at desc;

-- ----------------------------------------------------------- RLS ------------
alter table public.hazards enable row level security;
alter table public.eoc_activations enable row level security;
alter table public.incidents enable row level security;
alter table public.logbook_entries enable row level security;
alter table public.sitreps enable row level security;
alter table public.barangays enable row level security;
alter table public.barangay_reports enable row level security;
alter table public.evacuation_centers enable row level security;
alter table public.resources enable row level security;
alter table public.resource_requests enable row level security;

create policy hazards_read on public.hazards for select to authenticated using (app.is_active_user());
create policy hazards_admin on public.hazards for all to authenticated using (app.has_role('admin')) with check (app.has_role('admin'));

create policy act_read on public.eoc_activations for select to authenticated using (app.is_active_user());
-- writes only through set_eoc_level()

do $$ declare t text; ops constant public.app_role[] := array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']; begin
  foreach t in array array['incidents','sitreps','evacuation_centers','resources','resource_requests'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (app.has_any_role(%2$L))', t, ops);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (app.has_any_role(%2$L)) with check (app.has_any_role(%2$L))', t, ops);
  end loop;
end $$;

create policy log_read on public.logbook_entries for select to authenticated using (app.is_active_user());
create policy log_insert on public.logbook_entries for insert to authenticated
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]) and author = auth.uid());

create policy brgy_read on public.barangays for select to authenticated using (app.is_active_user());
create policy brgy_admin on public.barangays for all to authenticated using (app.has_role('admin')) with check (app.has_role('admin'));

create policy brep_read on public.barangay_reports for select to authenticated using (app.is_active_user());
create policy brep_insert on public.barangay_reports for insert to authenticated
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));

grant select on public.hazards, public.eoc_activations, public.v_eoc_status, public.v_barangay_latest to authenticated;
grant insert, update, delete on public.hazards, public.barangays to authenticated;
grant select, insert on public.logbook_entries, public.barangay_reports to authenticated;
grant select, insert, update on public.incidents, public.sitreps, public.barangays, public.evacuation_centers,
  public.resources, public.resource_requests to authenticated;

-- Realtime: the status band and boards refresh when these change.
alter publication supabase_realtime add table public.eoc_activations, public.logbook_entries,
  public.sitreps, public.barangay_reports, public.resource_requests;
