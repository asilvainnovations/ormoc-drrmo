-- =============================================================================
-- 1.21.0 (14 Nov 2026) - SitRep: DILG VIII harmonized fields and reporting cut-offs (ADR-038).
--
-- IAT B5.1 asks for the harmonized DILG VIII response-reporting template and B5.2 for
-- BDRRMC → EOC reporting times before the 6 AM / 6 PM submission. The DILG VIII template
-- (RDRRMC VIII Res. No. 12-006, s. 2023; DILG VIII Memorandum R08-LGCDD-2025-02-26-008,
-- "Adopting the Disaster Response Reporting Template and SOPs") adds report types
-- (pre-disaster, during, post, terminal), incident type, damaged houses, lifelines and
-- assistance fields the platform did not carry, and Table 3 of that SOP sets the frequency:
-- White on or before 6:00 AM and 6:00 PM; Blue and Red 09:00 AM and 07:00 PM. Barangay
-- reports must reach the EOC before those submission times, so the EOC can consolidate.
--
-- This migration adds the template fields to sitreps (nullable; the numbered/locked behavior
-- in app.guard_sitrep is unchanged) and a sitrep_cutoffs table with the seeded defaults the
-- CDRRMO Head or admin can adjust online. The "late" flag on the Barangays page is derived in
-- the client from these times (decision support, like the DDRiVE ranking); the times
-- themselves are data, kept in SQL.
--
-- Supports MR-08 (EOC readiness). Indicators B5.1, B5.2, B1.5.
-- Safe to run again.
-- =============================================================================

alter table public.sitreps add column if not exists report_type text;
do $$ begin
  alter table public.sitreps add constraint sitreps_report_type_check
    check (report_type in ('pre_disaster','during_disaster','post_disaster','terminal'));
exception when duplicate_object then null; end $$;
update public.sitreps set report_type = 'during_disaster' where report_type is null;
alter table public.sitreps alter column report_type set default 'during_disaster';
alter table public.sitreps alter column report_type set not null;

alter table public.sitreps add column if not exists incident_type text;
alter table public.sitreps add column if not exists affected_barangays integer check (affected_barangays is null or affected_barangays >= 0);
alter table public.sitreps add column if not exists damaged_houses_totally integer check (damaged_houses_totally is null or damaged_houses_totally >= 0);
alter table public.sitreps add column if not exists damaged_houses_partially integer check (damaged_houses_partially is null or damaged_houses_partially >= 0);
alter table public.sitreps add column if not exists lifelines_status text;
alter table public.sitreps add column if not exists assistance_provided text;
alter table public.sitreps add column if not exists cost_of_assistance numeric check (cost_of_assistance is null or cost_of_assistance >= 0);

comment on column public.sitreps.report_type is 'DILG VIII harmonized report type (RDRRMC VIII Res. 12-006 s. 2023): pre_disaster / during_disaster / post_disaster / terminal (ADR-038).';
comment on column public.sitreps.lifelines_status is 'Status of power, water, communications and road access, per the DILG VIII checklist.';
comment on column public.sitreps.cost_of_assistance is 'Cost of assistance provided (PHP), per the DILG VIII checklist.';

create table if not exists public.sitrep_cutoffs (
  id             uuid primary key default gen_random_uuid(),
  alert_level    text not null unique check (alert_level in ('white','blue','red')),
  barangay_am    time not null,
  barangay_pm    time not null,
  submission_am  time not null,
  submission_pm  time not null,
  updated_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);
comment on table public.sitrep_cutoffs is 'Reporting times by alert level (ADR-038): barangay reports due to the EOC before the city consolidates and submits to the Province/Region (DILG VIII SOP Table 3). Seeded defaults; the CDRRMO Head or admin adjusts online.';
comment on column public.sitrep_cutoffs.submission_am is 'City submission to the Province/Region, morning window (DILG VIII SOP Table 3).';

alter table public.sitrep_cutoffs enable row level security;
drop policy if exists sitrep_cutoffs_read on public.sitrep_cutoffs;
drop policy if exists sitrep_cutoffs_update on public.sitrep_cutoffs;
create policy sitrep_cutoffs_read on public.sitrep_cutoffs for select to authenticated using (app.is_active_user());
create policy sitrep_cutoffs_update on public.sitrep_cutoffs for update to authenticated
  using (app.is_active_user())
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
grant select on public.sitrep_cutoffs to authenticated;
grant update on public.sitrep_cutoffs to authenticated;
select app.track('public.sitrep_cutoffs');

-- Seeded defaults (insert-only): barangay cut-offs one hour before the DILG VIII submission times.
-- Deterministic uuid5 ids (namespace 6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab), like every seed.
insert into public.sitrep_cutoffs (id, alert_level, barangay_am, barangay_pm, submission_am, submission_pm) values
  ('c1145a37-91d4-5a88-8249-ddcb3c6ef868'::uuid, 'white', '05:00', '17:00', '06:00', '18:00'),
  ('b6d46b52-d663-5bad-a0e9-421b16e493b6'::uuid, 'blue',  '08:00', '18:00', '09:00', '19:00'),
  ('3b73744e-4887-5b97-85e1-684d50a1d14e'::uuid, 'red',   '08:00', '18:00', '09:00', '19:00')
on conflict (alert_level) do nothing;
