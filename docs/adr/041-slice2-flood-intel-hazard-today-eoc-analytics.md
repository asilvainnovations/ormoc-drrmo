# ADR-041: Slice 2 — Flood intelligence (Assess/Tools), hazard watch on Today, EOC risk analytics and roster scenarios

Status: Proposed, 16 Nov 2026. Builds on ADR-011 (readiness tools), ADR-024 (DDRiVE), ADR-030 (hazard maps in Assess), ADR-035 (EOC capability), ADR-039 (resources / DDRiVE decisions), ADR-040 (conversations).

## Context

Slice 1 delivered object-scoped conversations. Slice 2 adds operational intelligence requested for the validation workshop and daily EOC use:

1. Flood intelligence in Assess, modelled on an external Bayesian prototype, plus on-demand geospatial mapping (Copernicus EMS).
2. City Risk Picture analytics (barangay and city profile visualisation already started by DDRiVE).
3. EOC Roster showing designated officers/offices by law and standards, and interactive EOC/IC structures by hazard scenario.
4. EOC Capability data from the November 2026 accomplished checklist (already largely seeded under ADR-035).
5. Today: analytics and hazard detection cards (PAGASA Visayas forecast, PHIVOLCS earthquake monitoring, flood intelligence summary).

Constraints that must not be broken:

- **ADR-011:** hazard services are **links** (`rel="noopener noreferrer"`), never iframes. Tools that keep working offline store data in the browser; they do not pull live external APIs as a hard dependency.
- **CSP:** no new wildcards; do not embed third-party mapping widgets.
- **Privacy (RA 10173):** no names of affected persons; barangay aggregates only.
- **Decision support only:** DDRiVE and flood intelligence never auto-trigger evacuations or declarations (ADR-024, ADR-039).
- **Local-first:** Today and Assess read Dexie; outbound links need a connection by nature.

## Decision

### 1. Flood intelligence (Assess + Tools)

- **Do not** port the full external Bayesian HTML (CDN D3, chatbot, multi-panel prototype) into the React app as a first-class live model. That would violate ADR-011, CSP, and maintainability by a local IT contractor.
- **Do** add a MODE **Flood intelligence** internal tool at `/tools/flood-intelligence` that:
  - Explains Ormoc flood context (Anilao–Malbasag, short-lead flash flood, 72 h AA floor).
  - Shows **local** DDRiVE flood susceptibility and priority barangays from Dexie (same source as EOC Risk).
  - Offers **outbound** links: Copernicus EMS On-Demand Mapping, Global Flood Awareness, HazardHunterPH, PAGASA, UP NOAH.
  - Optionally hosts the prototype HTML as a **static reference asset** under `public/tools/` opened in a new tab (not an iframe), labelled “reference prototype — not an official forecast.”
- Assess gains a “Flood intelligence” entry on the Tools/hazard strip and a Mode link from relevant B_EOC / A5 / A6 indicators where already mapped.

### 2. On-demand mapping / geospatial

- Add Copernicus **On-Demand Mapping** (`https://mapping.emergency.copernicus.eu/`) to ToolsHome as an official/supporting international link with clear limitations (activation is institutional; not a City live feed).
- Keep existing GeoAnalyticsPH, HazardHunterPH, basemap/Geo-COP (ADR-015/028).

### 3. City Risk Picture analytics (EOC → Risk)

- Extend `RiskPage` with summary analytics already computable offline from DDRiVE: counts by flood susceptibility class, priority-rank distribution, cluster coverage, top-N priority barangays.
- Charts use existing design tokens / simple CSS or the app’s chart library only if already in the bundle — no new CDN.
- Remains **decision support, never a trigger**.

### 4. EOC Roster and scenario structures

- Roster continues to use `eoc_positions` + `eoc_designations` (office, designee_position, person when assigned).
- Add **scenario structure views**: preset organigrams (White / Blue / Red or hazard family: hydromet, geological, multi-hazard) that highlight which positions are required at each min_level and which designations are filled vs gap (depth &lt; required_depth).
- Structures are interactive within MODE (filter by scenario); they are not a substitute for the approved EOC Manual organogram.

### 5. EOC Capability data

- The November 2026 accomplished checklist is the source for ADR-035 seeds (`eoc_assessment_*` / `eoc_cap_*`). Slice 2 verifies seed parity and documents re-load steps if the City updates the workbook; no parallel duplicate schema.

### 6. Today — hazard watch

- Add a **Hazard watch** card on `/today`:
  - Outbound: PAGASA Visayas regional forecast, PHIVOLCS earthquake monitoring system, PAGASA weather.
  - Local: short DDRiVE flood snapshot (count of high-susceptibility barangays, top priority names) when reference data is loaded — **not** a live model forecast.
  - Link into Flood intelligence tool and EOC Risk.

## Consequences

- New/updated screens stay offline-first for local data; external intelligence is always an explicit “open outside MODE” action.
- No change to scoring, declaration rules, or AA fund guards.
- Version target: **1.22.0** continues (Slice 1 conversations + Slice 2 intelligence), or **1.23.0** if Slice 1 is already tagged alone.
- Legal: official forecasts remain PAGASA/PHIVOLCS; MODE never presents a prototype model as an official warning.

## Out of scope

- Live scrape/API integration of PAGASA/PHIVOLCS into Postgres.
- Full Bayesian network reimplementation inside React.
- Auto-activation or auto-SitRep from any external feed.
- Embedding Copernicus or NOAH in an iframe.
