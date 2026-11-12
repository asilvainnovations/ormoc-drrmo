-- 1.16.0: ECHO — Evacuation and Camp Handling Operations (ADR-030).
--
-- Three connected records behind the ECHO tool (/tools/echo):
--   1. evacuation_centers (exists since 0004, never used by the app) becomes the City's evacuation-centre inventory:
--      capacity, covered area, WASH counts, RA 12076 Sec. 4 readiness items, hazard screening note and the reference
--      to a structural assessment. "field_verified" means the inventory data were checked in the field. It is not a
--      safety certificate: no status here certifies a centre as safe or compliant.
--   2. camp_reports: aggregate snapshots of each centre in an activation (JMC No. 02 s. 2021 camp monitoring). Append-only;
--      a correction is a new report. Opening, closing and closure record an authorised decision: they need an authority
--      reference and the EOC Manager or the CDRRMO Head. The platform does not open or close a centre by itself.
--   3. camp_feedback: the complaints and feedback log, as non-identifying summaries.
--
-- Privacy (RA 10173): counts only. No names of evacuees, patients or informants, no DAFAC data (the DAFAC stays with
-- the CSWDO), no case narratives. Free text is length-limited. A blank count is "not reported" (null), never zero.
-- Safe to run again.

-- ---------------------------------------------------------------- 1. evacuation-centre inventory
alter table public.evacuation_centers add column if not exists code text;
alter table public.evacuation_centers add column if not exists kind text not null default 'other';
alter table public.evacuation_centers add column if not exists covered_area_m2 numeric;
alter table public.evacuation_centers add column if not exists toilets_male integer;
alter table public.evacuation_centers add column if not exists toilets_female integer;
alter table public.evacuation_centers add column if not exists toilets_accessible integer;
alter table public.evacuation_centers add column if not exists bathing integer;
alter table public.evacuation_centers add column if not exists water_l_day numeric;
alter table public.evacuation_centers add column if not exists is_school boolean not null default false;
alter table public.evacuation_centers add column if not exists hazard_screening text;
alter table public.evacuation_centers add column if not exists structural_ref text;
alter table public.evacuation_centers add column if not exists ra12076 jsonb not null default '{}'::jsonb;
alter table public.evacuation_centers add column if not exists verification_status text not null default 'pending_field_validation';
alter table public.evacuation_centers add column if not exists verified_by uuid references public.profiles(id);
alter table public.evacuation_centers add column if not exists verified_at timestamptz;
alter table public.evacuation_centers add column if not exists custodian_office_id uuid references public.offices(id);
alter table public.evacuation_centers add column if not exists point_id uuid references public.geo_reference_points(id);
alter table public.evacuation_centers add column if not exists note text;
alter table public.evacuation_centers add column if not exists created_by uuid default auth.uid() references public.profiles(id);

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.evacuation_centers'::regclass and conname like 'evac_ctr_%' loop
    execute format('alter table public.evacuation_centers drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.evacuation_centers
  add constraint evac_ctr_code check (code is null or code ~ '^[A-Z][A-Z0-9-]{1,30}$'),
  add constraint evac_ctr_kind check (kind in ('ligtas_pinoy_center','multipurpose','covered_court','barangay_hall','school_last_resort','other')),
  add constraint evac_ctr_counts check (coalesce(covered_area_m2, 0) >= 0 and coalesce(toilets_male, 0) >= 0 and coalesce(toilets_female, 0) >= 0
                                        and coalesce(toilets_accessible, 0) >= 0 and coalesce(bathing, 0) >= 0 and coalesce(water_l_day, 0) >= 0),
  add constraint evac_ctr_verification check (verification_status in ('training','pending_field_validation','field_verified','superseded')),
  add constraint evac_ctr_school check (is_school = (kind = 'school_last_resort')),
  add constraint evac_ctr_ra12076 check (jsonb_typeof(ra12076) = 'object'),
  add constraint evac_ctr_text check (length(coalesce(hazard_screening, '')) <= 1000 and length(coalesce(structural_ref, '')) <= 300
                                      and length(coalesce(note, '')) <= 1000 and length(name) <= 160),
  add constraint evac_ctr_coords check ((lat is null) = (lng is null) and (lat is null or (lat between -90 and 90 and lng between -180 and 180)));
create unique index if not exists evac_ctr_one_current_code on public.evacuation_centers (code)
  where code is not null and verification_status <> 'superseded';

comment on column public.evacuation_centers.verification_status is
  'training (exercise only) | pending_field_validation | field_verified (inventory data checked in the field; NOT a safety certificate) | superseded.';
comment on column public.evacuation_centers.ra12076 is 'RA 12076 Sec. 4 readiness items: key -> yes | no | unknown. A "yes" is recorded, not certified.';
comment on column public.evacuation_centers.status is 'Legacy (0004). The centre''s phase in an activation comes from camp_reports.';
comment on column public.evacuation_centers.occupancy_persons is 'Legacy (0004). Occupancy comes from camp_reports.';

create or replace function app.guard_evacuation_center() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if exists (select 1 from jsonb_each(new.ra12076) e where e.value not in ('"yes"'::jsonb, '"no"'::jsonb, '"unknown"'::jsonb)) then
    raise exception 'RA 12076 items are yes, no or unknown' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.verification_status not in ('pending_field_validation', 'training') then
      raise exception 'A new centre starts as pending field validation (or as a training site)' using errcode = '42501';
    end if;
    new.created_by := auth.uid(); new.verified_by := null; new.verified_at := null;
    new.status := 'closed'; new.occupancy_persons := 0;   -- legacy columns: occupancy lives in camp_reports
    return new;
  end if;
  new.created_by := old.created_by;
  new.status := old.status; new.occupancy_persons := old.occupancy_persons;
  if old.verification_status = 'superseded' then
    raise exception 'A superseded centre is kept as a record' using errcode = '42501';
  end if;
  if (old.verification_status = 'training') <> (new.verification_status = 'training') then
    raise exception 'A training site stays a training site; add the real centre as a new entry' using errcode = '42501';
  end if;
  -- A change to what was verified sends the entry back for field validation.
  if old.verification_status = 'field_verified' and new.verification_status = 'field_verified'
     and row(new.lat, new.lng, new.capacity_persons, new.covered_area_m2, new.kind, new.barangay_psgc, new.toilets_male, new.toilets_female,
             new.toilets_accessible, new.bathing, new.water_l_day)
         is distinct from row(old.lat, old.lng, old.capacity_persons, old.covered_area_m2, old.kind, old.barangay_psgc, old.toilets_male,
             old.toilets_female, old.toilets_accessible, old.bathing, old.water_l_day) then
    new.verification_status := 'pending_field_validation';
  end if;
  if new.verification_status = 'field_verified' and old.verification_status <> 'field_verified' then
    if not app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or the EOC Manager records a field verification' using errcode = '42501';
    end if;
    if new.lat is null or new.capacity_persons is null then
      raise exception 'Record the location and capacity before field verification' using errcode = '23514';
    end if;
    new.verified_by := auth.uid(); new.verified_at := now();
  elsif new.verification_status = 'field_verified' then
    new.verified_by := old.verified_by; new.verified_at := old.verified_at;
  else
    new.verified_by := null; new.verified_at := null;
  end if;
  if new.verification_status = 'superseded' and not app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]) then
    raise exception 'Only the CDRRMO Head or the EOC Manager retires a centre from the inventory' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_evacuation_center on public.evacuation_centers;
create trigger guard_evacuation_center before insert or update on public.evacuation_centers
  for each row execute function app.guard_evacuation_center();

-- Policies: anyone active reads; EOC operators and the Head maintain; no delete (records are kept).
drop policy if exists evacuation_centers_read on public.evacuation_centers;
drop policy if exists evacuation_centers_insert on public.evacuation_centers;
drop policy if exists evacuation_centers_update on public.evacuation_centers;
create policy evacuation_centers_read on public.evacuation_centers for select to authenticated using (app.is_active_user());
create policy evacuation_centers_insert on public.evacuation_centers for insert to authenticated
  with check (app.has_any_role(array['eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
create policy evacuation_centers_update on public.evacuation_centers for update to authenticated
  using (app.has_any_role(array['eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
revoke delete, truncate on public.evacuation_centers from authenticated, anon;

-- ---------------------------------------------------------------- 2. camp reports (aggregate, append-only)
create table if not exists public.camp_reports (
  id                   uuid primary key default gen_random_uuid(),
  activation_id        uuid references public.eoc_activations(id),
  centre_id            uuid not null references public.evacuation_centers(id),
  reported_at          timestamptz not null default now(),
  phase                text not null check (phase in ('opening','open','consolidating','closing','closed')),
  families             integer check (families >= 0),
  persons              integer check (persons >= 0),
  female               integer check (female >= 0),
  male                 integer check (male >= 0),
  children             integer check (children >= 0),
  older                integer check (older >= 0),
  pwd                  integer check (pwd >= 0),
  pregnant_lactating   integer check (pregnant_lactating >= 0),
  ip                   integer check (ip >= 0),
  arrivals             integer check (arrivals >= 0),
  departures           integer check (departures >= 0),
  water_l_day          numeric check (water_l_day >= 0),
  toilets_functional   integer check (toilets_functional >= 0),
  bathing_functional   integer check (bathing_functional >= 0),
  services             jsonb not null default '{}'::jsonb check (jsonb_typeof(services) = 'object'),
  referrals_cp         integer check (referrals_cp >= 0),
  referrals_gbv        integer check (referrals_gbv >= 0),
  referrals_health     integer check (referrals_health >= 0),
  unmet_needs          text check (length(unmet_needs) <= 1000),
  authority_ref        text check (length(authority_ref) <= 200),
  remarks              text check (length(remarks) <= 500),
  reported_by          uuid default auth.uid() references public.profiles(id),
  created_at           timestamptz not null default now(),
  constraint camp_reports_persons_ge_families check (persons is null or families is null or persons >= families),
  constraint camp_reports_groups_le_persons check (persons is null or (
    coalesce(female, 0) <= persons and coalesce(male, 0) <= persons and coalesce(female, 0) + coalesce(male, 0) <= persons
    and coalesce(children, 0) <= persons and coalesce(older, 0) <= persons and coalesce(pwd, 0) <= persons
    and coalesce(pregnant_lactating, 0) <= persons and coalesce(ip, 0) <= persons)),
  constraint camp_reports_open_has_count check (phase <> 'open' or persons is not null),
  constraint camp_reports_authority check (phase not in ('opening','closing','closed') or length(trim(coalesce(authority_ref, ''))) > 0)
);
create index if not exists camp_reports_latest_idx on public.camp_reports (centre_id, reported_at desc);
create index if not exists camp_reports_activation_idx on public.camp_reports (activation_id);
comment on table public.camp_reports is 'ECHO camp monitoring (JMC No. 02 s. 2021): aggregate snapshot per centre. Append-only; null = not reported.';

create or replace function app.guard_camp_report() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.reported_by := auth.uid();
  new.created_at := now();
  if new.reported_at > now() + interval '10 minutes' then
    raise exception 'A camp report cannot be dated in the future' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(new.services) e where e.value not in ('"yes"'::jsonb, '"partial"'::jsonb, '"no"'::jsonb)) then
    raise exception 'Service items are yes, partial or no' using errcode = '23514';
  end if;
  if exists (select 1 from public.evacuation_centers c where c.id = new.centre_id and c.verification_status in ('training','superseded')) then
    raise exception 'Camp reports are for centres in the inventory, not training or superseded entries' using errcode = '23514';
  end if;
  if new.phase in ('opening','closing','closed')
     and not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Opening, closing and closure record an authorised decision: the EOC Manager or the CDRRMO Head files them' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_camp_report on public.camp_reports;
create trigger guard_camp_report before insert on public.camp_reports for each row execute function app.guard_camp_report();
drop trigger if exists audit_row on public.camp_reports;
create trigger audit_row after insert on public.camp_reports for each row execute function app.audit();

alter table public.camp_reports enable row level security;
drop policy if exists camp_reports_read on public.camp_reports;
drop policy if exists camp_reports_insert on public.camp_reports;
create policy camp_reports_read on public.camp_reports for select to authenticated using (app.is_active_user());
create policy camp_reports_insert on public.camp_reports for insert to authenticated
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
revoke update, delete, truncate on public.camp_reports from authenticated, anon;
grant select, insert on public.camp_reports to authenticated;

-- ---------------------------------------------------------------- 3. complaints and feedback log
create table if not exists public.camp_feedback (
  id             uuid primary key default gen_random_uuid(),
  activation_id  uuid references public.eoc_activations(id),
  centre_id      uuid references public.evacuation_centers(id),
  category       text not null check (category in ('access_inclusion','wash','safety_privacy','child_protection_referral','gbv_referral',
                                                    'health_mhpss','food_nfi','information','other')),
  status         text not null default 'open' check (status in ('open','referred','action_assigned','closed')),
  summary        text not null check (length(trim(summary)) between 3 and 500),
  action_office  text check (length(action_office) <= 120),
  closed_at      timestamptz,
  created_by     uuid default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);
create index if not exists camp_feedback_activation_idx on public.camp_feedback (activation_id, status);
comment on column public.camp_feedback.summary is 'Describe the service issue, not the person or the case. Referrals go through confidential pathways outside MODE.';
select app.track('public.camp_feedback');

create or replace function app.guard_camp_feedback() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
  if tg_op = 'UPDATE' and row(new.category, new.summary, new.centre_id, new.activation_id) is distinct from
                         row(old.category, old.summary, old.centre_id, old.activation_id) then
    raise exception 'A feedback entry''s category and summary are kept as logged; add a new entry for new information' using errcode = '42501';
  end if;
  new.closed_at := case when new.status = 'closed' then coalesce(case when tg_op = 'UPDATE' then old.closed_at end, now()) else null end;
  return new;
end $$;
drop trigger if exists guard_camp_feedback on public.camp_feedback;
create trigger guard_camp_feedback before insert or update on public.camp_feedback for each row execute function app.guard_camp_feedback();

alter table public.camp_feedback enable row level security;
drop policy if exists camp_feedback_read on public.camp_feedback;
drop policy if exists camp_feedback_insert on public.camp_feedback;
drop policy if exists camp_feedback_update on public.camp_feedback;
create policy camp_feedback_read on public.camp_feedback for select to authenticated using (app.is_active_user());
create policy camp_feedback_insert on public.camp_feedback for insert to authenticated
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
create policy camp_feedback_update on public.camp_feedback for update to authenticated
  using (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
revoke delete, truncate on public.camp_feedback from authenticated, anon;
grant select, insert, update on public.camp_feedback to authenticated;

-- Connected apps (OAuth clients) do not write operational records (as for the Geo-COP tables).
do $$ declare t text; begin
  foreach t in array array['evacuation_centers','camp_reports','camp_feedback'] loop
    execute format('drop trigger if exists aa0_block_oauth_client_writes on public.%1$s', t);
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%1$s
                    for each row execute function app.block_oauth_client_writes()', t);
  end loop;
end $$;

-- Realtime: the EOC dashboard refreshes when these change.
do $$ declare t text; begin
  foreach t in array array['evacuation_centers','camp_reports','camp_feedback'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
