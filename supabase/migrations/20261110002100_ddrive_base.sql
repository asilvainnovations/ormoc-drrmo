-- =============================================================================
-- 1.12.1 (10 Nov 2026) - DDRiVE risk-intelligence base layer (ADR-024).
--
-- DDRiVE = Data-Driven Risk and Vulnerability Estimation (renamed from QRE by the
-- platform owner). The City's desk-assessment workbook
-- (Ormoc-City-Barangays_Hazard-Assessment_QRE_2026-11-09.xlsx, v1.2) becomes the EOC's
-- risk base layer, read-only reference data loaded by seed part 26:
--   1. ddrive_barangay_profiles - the verified 85-barangay baseline (sheets 01-03):
--      official PSGC and names, 2024 POPCEN / 2020 CPH counts, representative points,
--      proposed response clusters. Sheet 04's 9-digit PSGC typo is normalised to the
--      10-digit code at seed time.
--   2. ddrive_flood / ddrive_hazards / ddrive_exposure / ddrive_vulnerability /
--      ddrive_priority - the per-barangay assessment sheets (04-08).
--   3. ddrive_city_scores - the city-level 10-hazard desk scoring (sheet 14), and
--      ddrive_risk_matrix - the likelihood x severity -> band matrix (sheet 13).
--      The band is COMPUTED by v_ddrive_city_risk, never stored; the TS mirror in
--      src/domain/ddrive.ts is pinned by a parity test to the workbook's published
--      bands.
--   4. ddrive_sources - the source register (sheet 09, S-01 to S-31): provenance for
--      every figure.
--
-- Data rules carried from the workbook: a missing value is never 0 (non-numeric text
-- becomes NULL in numeric columns); aggregate data only, no personal data (RA 10173);
-- desk scores are decision support, never an evacuation trigger.
--
-- RLS: any active user reads; only admin writes (through SQL - the app treats these as
-- reference tables, write 'none'). Supports MR-07, MR-11; Area 6 (Geo-COP and maps).
-- Safe to run again.
-- =============================================================================

-- ---------------------------------------------------------- 1. barangay baseline
create table if not exists public.ddrive_barangay_profiles (
  psgc                     text primary key check (psgc ~ '^[0-9]{10}$'),
  name                     text not null,
  former_name              text,
  urban_rural              text,
  population_2024          integer,                -- PSA 2024 POPCEN; null only if the source itself is missing
  population_2020          integer,              -- 2020 CPH (110-barangay configuration, see source register)
  growth_rate_2020_2024  numeric,               -- annual growth rate, fraction (0.0236 = 2.36%/yr)
  households               integer,
  density_per_ha           numeric,
  data_quality_flag        text,
  lat                      numeric not null,     -- WGS 84 / EPSG:4326 representative point
  lng                      numeric not null,
  coord_source             text,
  coord_validation         text,
  cluster_no               smallint,             -- proposed response cluster (1-6); null = not assigned
  cluster_label            text,
  district_zone            text,
  assigned_coordinator     text,
  cluster_validation       text,
  workbook_rev             text not null default 'v1.2'   -- source workbook version (file keeps the historical QRE name)
);

-- ---------------------------------------------------------- 2. per-barangay assessment
create table if not exists public.ddrive_flood (
  psgc                        text primary key references public.ddrive_barangay_profiles(psgc),
  susceptibility_class        text,
  hazard_source               text,
  prone_area_ha               numeric,
  land_area_ha                numeric,
  prone_pct                   numeric,
  exposed_population          integer,
  exposure_base_population    integer,
  exposure_base_year          text,
  exposure_pct                numeric,
  depth_scenario              text,
  confidence                  text,
  validation_status           text
);

create table if not exists public.ddrive_hazards (
  psgc                 text primary key references public.ddrive_barangay_profiles(psgc),
  rain_landslide       text,
  eq_landslide         text,
  ground_shaking       text,
  ground_rupture       text,
  liquefaction         text,
  tsunami              text,
  storm_surge          text,
  facilities_exposure  text,
  lifeline_exposure    text,
  vulnerable_population text,
  evacuation_access    text,
  source_vintage       text,
  validation_status    text
);

create table if not exists public.ddrive_exposure (
  psgc               text primary key references public.ddrive_barangay_profiles(psgc),
  population_2024    integer,
  pop_0_4            integer,
  pop_5_17           integer,
  pop_18_59          integer,
  pop_60_plus        integer,
  schools            integer,
  health_facilities  integer,
  infrastructure     text,
  source             text,
  status             text
);

create table if not exists public.ddrive_vulnerability (
  psgc                text primary key references public.ddrive_barangay_profiles(psgc),
  social_sensitivity  text,
  access_constraints  text,
  coping_capacity     text,
  adaptive_capacity   text,
  method_source       text,
  validation_status   text
);

create table if not exists public.ddrive_priority (
  psgc              text primary key references public.ddrive_barangay_profiles(psgc),
  priority_rank     smallint,          -- proposed 1-85; null = not assessed
  basis             text,
  population_2024   integer,
  confidence        text,
  validation_status text
);

-- ---------------------------------------------------------- 3. city desk scores + matrix
create table if not exists public.ddrive_city_scores (
  hazard_event          text primary key,   -- e.g. 'Riverine & flash flood'
  hazard_family         text not null,      -- H1 Geophysical, H2 Hydrological, ...
  exposure_infrastructure text,
  exposure_productive   text,
  exposure_essential    text,
  exposure_human      text,
  vulnerability_rating  integer,
  response_measures   text,
  likelihood          smallint not null check (likelihood between 0 and 10),
  severity            smallint not null check (severity between 0 and 100),
  evidence_anchor     text,
  validation_status   text
);

create table if not exists public.ddrive_risk_matrix (
  ranking        smallint primary key,   -- 1..25
  severity_min   smallint not null,
  severity_max   smallint not null,
  likelihood_min numeric not null,
  likelihood_max numeric not null,
  band           text not null,          -- VL1, VL2, L3, L4, M5, M6, H7, H8, VH9
  label          text not null           -- Very Low, Low, Moderate, High, Very High
);

-- The band of a desk score is computed from the matrix, never stored (ADR-024).
-- Severity = (likelihood - resilience) is the workbook's scoring parameter; the matrix
-- bands the raw severity x likelihood pair, so the view looks the pair up directly.
create or replace view public.v_ddrive_city_risk as
select s.hazard_event, s.hazard_family, s.likelihood, s.severity,
       m.ranking, m.band, m.label,
       s.vulnerability_rating, s.response_measures, s.evidence_anchor, s.validation_status
from public.ddrive_city_scores s
join public.ddrive_risk_matrix m
  on s.severity between m.severity_min and m.severity_max
 and s.likelihood between m.likelihood_min and m.likelihood_max;

-- ---------------------------------------------------------- 4. source register
create table if not exists public.ddrive_sources (
  source_id  text primary key,           -- S-01 to S-31
  name       text not null,
  owner      text,
  url        text,
  vintage    text,
  coverage   text,
  accessed_on text,
  limitations text
);

-- ---------------------------------------------------------- RLS: read for active users, admin maintains
do $$ declare t text;
begin
  foreach t in array array['ddrive_barangay_profiles','ddrive_flood','ddrive_hazards','ddrive_exposure',
                           'ddrive_vulnerability','ddrive_priority','ddrive_city_scores','ddrive_risk_matrix','ddrive_sources']
  loop
    execute format('alter table public.%s enable row level security', t);
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (app.has_role(''admin'')) with check (app.has_role(''admin''))', t);
  end loop;
end $$;

comment on view public.v_ddrive_city_risk is 'DDRiVE desk-score bands, computed from ddrive_risk_matrix. TS mirror: src/domain/ddrive.ts (parity test pins the workbook rows). Decision support only - never an evacuation trigger.';
