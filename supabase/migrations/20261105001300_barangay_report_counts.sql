-- =============================================================================
-- 1.6.2: A blank evacuation count is "not reported", not zero (audit 31 Oct 2026, #17).
--
-- Before this migration families_evacuated and persons_evacuated were NOT NULL DEFAULT 0, and
-- the form saved a blank box as 0. During an event a barangay that had not yet given figures
-- looked like a barangay with no evacuees, and the SitRep totals could not tell them apart.
--
-- After it:
--   * Both counts may be null, meaning not reported. Totals add the reported counts and say
--     how many barangays have not reported (src/domain/eoc.ts, evacuationTotals).
--   * A barangay recorded as "evacuating" needs both counts (0 is a valid count).
--   * Persons evacuated cannot be fewer than families evacuated.
-- The last two mirror barangayReportProblem() in src/domain/eoc.ts. Existing rows are kept as
-- they are: the persons/families check is added NOT VALID, so it applies to new reports only.
--
-- Supports MR-07 (reporting) and the DILG VIII Harmonized Template's evacuation figures.
-- Safe to run again.
-- =============================================================================

alter table public.barangay_reports
  alter column families_evacuated drop not null,
  alter column families_evacuated drop default,
  alter column persons_evacuated  drop not null,
  alter column persons_evacuated  drop default;

alter table public.barangay_reports drop constraint if exists barangay_reports_evacuating_counts;
alter table public.barangay_reports add constraint barangay_reports_evacuating_counts
  check (condition <> 'evacuating' or (families_evacuated is not null and persons_evacuated is not null));

alter table public.barangay_reports drop constraint if exists barangay_reports_persons_ge_families;
alter table public.barangay_reports add constraint barangay_reports_persons_ge_families
  check (persons_evacuated is null or families_evacuated is null or persons_evacuated >= families_evacuated) not valid;

comment on column public.barangay_reports.families_evacuated is 'Families evacuated, as reported. Null means not reported (not zero).';
comment on column public.barangay_reports.persons_evacuated  is 'Persons evacuated, as reported. Null means not reported (not zero).';
