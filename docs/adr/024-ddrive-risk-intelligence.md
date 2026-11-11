# ADR-024 — DDRiVE risk-intelligence base layer

- Status: Accepted
- Date: 10 November 2026
- Extends: 011 (tools/hazard services), 017 (EOC structure); supports MR-07, MR-11; Area 6 (Geo-COP and maps), Area 3 (risk information)

## Context

The City's desk assessment workbook `Ormoc-City-Barangays_Hazard-Assessment_QRE_2026-11-09.xlsx`
(v1.2) holds the barangay-level risk picture: a verified 85-barangay baseline with 2024 POPCEN
counts, representative coordinates, proposed response clusters, flood assessment, a multi-hazard
profile transcribed from CDRA Table 3, exposure, vulnerability, an evidence-based priority
ranking, a source register (S-01 to S-31), and a city-level 10-hazard desk scoring with a
likelihood × severity → band matrix. The tool is renamed by the platform owner to
**DDRiVE — Data-Driven Risk and Vulnerability Estimation**. (Historical file names and
sheet names still say QRE; that provenance is kept in each row's source column.)

The EOC needs this as its Risk Intelligence base layer, offline-capable, before any hazard
overlays (PHIVOLCS maps, QGIS exports, NASA GPM IMERG) are drawn on top.

## Decision

1. Ingest the workbook as read-only reference tables (`ddrive_*`, migration
   `20261110002100_ddrive_base.sql`), one table per workbook sheet family, natural keys
   (10-digit PSGC for barangay rows, hazard event for city scores, ranking for the matrix).
   Reference-only: RLS grants select to any active user; no API writes. Missing values stay
   NULL — the workbook's rule "a missing value is never zero" is enforced by parsing: only
   numeric text becomes a number. The workbook's 9-digit PSGC typo (sheet 04, row 2) is
   normalised to the 10-digit code during seed generation.
2. The risk band is **computed, not stored**: `v_ddrive_city_risk` looks up each desk score's
   (likelihood, severity) in `ddrive_risk_matrix`. The TypeScript mirror
   `src/domain/ddrive.ts` implements the identical lookup and a parity test pins the ten
   workbook rows to their published bands (H7, M6, L4, M6, L4, L3, M5, VL1, L4, L4).
3. The EOC gains a **Risk** page (`/eoc/risk`): the city desk scores as a ranked picture, and a
   searchable/filterable barangay profile drill-down (flood, hazards, exposure, vulnerability,
   priority) with validation-status flags visible on every section. Aggregate data only —
   RA 10173 is not implicated, and the page says so.
4. DDRiVE output is **decision support, never an evacuation trigger** — evacuation decisions
   follow the Manual's SOPs (declaration, EOC activation). The page carries this notice.
5. Renaming: the platform UI and docs say DDRiVE. No migration renames historical artefacts
   (workbook file name, sheet names, source register entries); provenance is preserved.

## Consequences

- The EOC Risk page works offline after first sync (reference tables, write `none`).
- Later overlays (PHIVOLCS hazard maps, QGIS GeoJSON/GeoTIFF layers, NASA GPM IMERG
  rainfall) register as `geo_layers` (1.9) and render on the existing Map page; DDRiVE gives
  them the barangay join key (PSGC) and the base risk picture.
- Workbook revisions re-run `scripts/ddrive_seed.py` and seed part 26; approved text and
  prior validation records are unaffected because nothing here is an assessed response.
- The desk scores are explicitly labelled "Desk score — pending DDRiVE working-session
  validation" in the source workbook; the platform shows the same status verbatim.

## Amendments

- **1.12.2 (11 Nov 2026), migration `20261111002200_ddrive_grants.sql`:** the `ddrive_*` tables
  keep select only for signed-in users (no API write grants for anyone), signed-out visitors read
  nothing, and `v_ddrive_city_risk` runs as `security_invoker` so the tables' RLS applies to it.
- **1.12.2:** seed part 26 is split into parts `26a`-`26d` (each under 90 KB) so the Supabase SQL
  editor accepts them. The check is unchanged: 85 | 85 | 85 | 85 | 85 | 85 | 10 | 25 | 31.
- **1.13.0:** part `26a` restores the former barangay names on South (`0803738116`) and West
  (`0803738117`), as listed in City Ordinance No. 052 s. 2021.
