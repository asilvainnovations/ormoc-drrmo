# ADR-038: SitRep — DILG VIII harmonized fields, reporting cut-offs and Excel export (v1.21.0)

Status: Proposed, 14 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.

## Context

IAT B5.1 asks for the harmonized DILG VIII response-reporting template and B5.2 for BDRRMC → EOC reporting times before the 6 AM / 6 PM submission. The platform's SitReps were numbered on submission and locked when approved, but did not carry the template's report types (pre-disaster, during, post, terminal), incident type, damaged houses, lifelines and assistance fields, any reporting-time reference, or a way to hand the Province the workbook it expects.

## Decision

1. **Template fields on `sitreps`** (migration `20261114003200`): `report_type` (the four DILG VIII types, default `during_disaster`), `incident_type`, `affected_barangays`, `damaged_houses_totally`/`partially`, `lifelines_status`, `assistance_provided`, `cost_of_assistance`. All additive; the numbered-on-submit, locked-on-approve behavior in `app.guard_sitrep` is unchanged.
2. **`sitrep_cutoffs`**: reporting times per alert level (White/Blue/Red) — barangay reports due at the EOC, and city submission to the Province/Region. Seeded from the DILG VIII SOP Table 3 (White submission 6:00/18:00; Blue and Red 09:00/19:00; barangay cut-offs one hour earlier), editable online by the CDRRMO Head or admin. The SitRep editor shows the times in force; the Barangays page flags a report "Late · due HH:MM" when it arrived after its window's cut-off (morning window ends at noon Manila time). The late flag is decision support for the liaison desk, never a sanction — the rule lives in `src/domain/eoc.ts` with a unit test.
3. **Excel export** on the SitRep editor: a client-side `.xlsx` in the DILG VIII harmonized layout (situation overview, figures, lifelines, actions taken, assistance, needs), named `CDRRMO-Ormoc_SitRep-No-<seq>_<yyyymmdd>_<type>.xlsx` (B5.1's file naming). The writer (`src/lib/xlsx.ts`, built on fflate, already a platform dependency) is deliberately minimal — one sheet, inline strings — and unit-tested; Print/PDF stays as it was.

## Consequences

- The workbook the Province receives matches the regional template without re-typing.
- The reporting times are data in SQL; changing them never needs a redeploy.
