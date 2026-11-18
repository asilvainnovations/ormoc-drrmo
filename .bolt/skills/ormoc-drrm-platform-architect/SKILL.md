---
name: ormoc-drrm-platform-architect
description: "Use this skill for architecture, design, back-end or front-end work, production-readiness audit, release verification, IAT integration, hazard intelligence, barangay spatial data, or Manual governance work on the Ormoc MODE Platform — the mobile-first, offline-capable PWA supporting the CDRRMO and EOC Manual of Operations for the City Government of Ormoc. Triggers: MODE platform, ormoc-drrmo repo, MOO/EOC digitisation, IAT assessment, barangay hazard assessment, Geo-COP, flood intelligence, SOP/protocol/workflow templates, RA 12287 anticipatory action, Manual review and validation, EOC operations, DRR-CCA systems, release or go-live review."
---

# Ormoc MODE Platform — Architect, Builder and Auditor

MODE means *Manual of Operations for the DRRMO and EOC*. It is a mobile-first, offline-capable Progressive Web App (PWA) for the City Government of Ormoc. It supports the CDRRMO and EOC Manual of Operations (MOO), the institutional assessment, the controlled procedure library, operational workflows and EOC coordination. The approved Manual and applicable official legal instruments remain authoritative; MODE is the supporting information and operational platform, not a source of legal power.

Repository: `github.com/asilvainnovations/ormoc-drrmo`.

## 0. Sources Of Truth, Version Control And Confidence

Use the following hierarchy and record the version/date of every source used:

1. **Applicable law and official instruments.** Enacted laws, their effective IRRs, valid national issuances, City ordinances and executive issuances, approved plans and certified official records govern legal authority. A draft Manual, assessment workbook, app screen, map, AI output or consultant interpretation cannot amend or override them.
2. **The approved City Manual.** Once adopted, the approved MOO is the authoritative operational text within the authority conferred by law and City instruments. Until then, the consolidated Manual supplied for this engagement is a controlled working draft for review and validation. Never describe draft provisions, proposed offices, proposed cluster assignments, proposed SOPs or draft RACI allocations as adopted City policy.
3. **Current repository source code and database migrations.** Inspect the actual source tree, `package.json`, migrations, seeds, routes, tests and deployment configuration at the beginning of each coding task. Code describes what the current snapshot implements; it does not prove that a feature is deployed or that its content is legally approved.
4. **Controlled reference workbooks and datasets.** Use the latest named version supplied for the task. The current assessment reference is `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx`. The current barangay hazard reference is `Ormoc_City_Barangay_Level_Hazard_Assessment_Updated_2026-11-17.xlsx` (uploaded filename may include `(1)`). Use the accompanying boundary and DDRiVE/QRE workbooks as supporting datasets, not as interchangeable versions.
5. **The consolidated Manual and its chapter/annex registers.** Use the supplied consolidated draft to ground the ten-chapter structure, operating model, SOPs, roles, RACI, quality approach and validation notes. Reconcile it with the current IAT, workbook evidence and code; do not silently harmonise contradictions.
6. **Repository documentation, ADRs, release notes and project write-ups.** These explain intended design. Check them against implementation and controlled source files before acting.

### Current Supplied Snapshot — 18 November 2026

The supplied repository ZIP has `package.json` version **1.22.0**. The ZIP does not contain Git history, so its branch, commit hash, remote state and whether it is identical to `main` cannot be established from the archive. Do not repeat the old 9 November 2026 assertion that `main` is at commit `974ef11` or package version `1.10.0`; that is stale for this supplied snapshot.

The archive contains documents labelled `MODE-2.0.0-UPDATE` and an `APPLY_STEPS.txt` describing a MODE 1.23.0 Manual Governance Slice 1. These are package/handover labels, **not evidence of a released application version**. The application manifest remains 1.22.0. The GIS update notes state that tests/build were not run in the packaging environment because `node_modules` was absent. Never claim that 1.23.0 or 2.0.0 has been released, merged, deployed or passed CI unless independently verified.

The archive includes ADR-043, migration `20261117003400_manual_governance.sql`, governance seed material and `src/features/governance/`. However, the supplied `src/App.tsx` does not mount a `/governance/*` route and the supplied AppShell navigation does not expose it. The governance feature is therefore present in the snapshot but not demonstrably reachable through the application shell. The `APPLY_STEPS.txt` explicitly calls for route and navigation wiring. Check this before describing the Manual Review and Validation Workspace as live or accessible.

**Snapshot verification protocol:**

- Inspect `package.json`, lockfile, `src/App.tsx`, `src/components/AppShell.tsx`, `supabase/migrations/`, `supabase/seed/`, `src/lib/bootstrap.ts`, `DEPLOY.md`, `.github/workflows/` and tests.
- If a fresh Git clone is available, record `git remote -v`, branch, `git log -1 --oneline`, `git status --short`, tags and GitHub release/PR state. Do not infer them from a ZIP.
- Treat a source ZIP, an apply package, a Git branch, a pull request, a production deployment and an adopted Manual as six different states.

## 1. Institutional, Legal And Manual Anchors

### 1.1 Legal And Policy Anchors

The platform and Manual must respect, as applicable to the feature being built:

| Source | Application And Guardrail |
|---|---|
| Republic Act No. 10121 and its IRR | Local DRRM governance, CDRRMO and CDRRMC mandates, LDRRMF, planning, preparedness, response and recovery responsibilities. |
| Republic Act No. 12287 and its IRR | State of Imminent Disaster and anticipatory action. Model the exact statutory sequence, legal deadlines, decision authorities, funding ceilings and reporting requirements from verified official text. |
| Republic Act No. 10173 and its IRR | Privacy by design, lawful processing, minimisation, access control, retention and secure handling of personal information. |
| Republic Act No. 7160 | Local government powers, local legislative and executive authority and local institutional arrangements. |
| Republic Act No. 12076 | Evacuation-centre standards and applicable requirements. |
| NDRRMC / OCD issuances, DILG VIII guidance, ICS doctrine and applicable national technical-agency products | EOC organisation, reporting, incident coordination, planning, warning and operational standards. Confirm exact titles, amendments and current effectivity before encoding a rule. |
| City ordinances, executive issuances, CDRRMC resolutions, approved plans and official records | Ormoc-specific mandate, organisation, delegated authority, procedures, resource arrangements and approved local data. |
| UNDRR MCR2030 Ten Essentials and relevant Scorecards | Resilience alignment, assessment and planning reference. These frameworks do not themselves confer City legal authority. |

Legal readings from scanned/OCR copies, incomplete copies or secondary summaries are provisional until checked against certified or official text by the proper City/legal authority. Record the source, section, version/date, confidence, reviewer and verification status. Where legal interpretation is contested, do not hard-code a guess. Keep the rule configurable only where legally appropriate, record the interpretation and route it to the City Legal Office or competent authority. A configurable parameter does not legalise an otherwise unauthorised action.

### 1.2 Institutional Boundaries

- **CDRRMC:** statutory policy, coordination and oversight body within RA 10121 and valid local instruments.
- **CDRRMO:** permanent City technical and institutional office; leads DRRM planning, preparedness, risk information, coordination, capacity development, recovery support, institutional monitoring and Manual stewardship within its mandate.
- **EOC:** activated coordination, information-management and decision-support mechanism. It is not a fourth CDRRMO division, not automatically the Incident Command Post and not a substitute for field command.
- **Incident Commander / Incident Management Team (ICS):** retain incident-site command responsibilities under the applicable ICS doctrine and valid activation arrangements.
- **City Mayor and other statutory decision-makers:** retain the powers assigned to them by law and valid City instruments. A platform role or RACI entry cannot create or transfer those powers.
- **City Legal Office:** provide formal legal advice where interpretation, authority, conflicting instruments or legal sufficiency require it; it is not a blanket approver of every operational edit.
- **OCD Region VIII and other national agencies:** consult, coordinate or inform as required by the law, issuance or technical mandate. Do not assign them City decision rights by default.

The Manual cannot independently create powers to declare a State of Calamity or State of Imminent Disaster, order evacuation, establish no-build zones, procure, disburse, impose restrictions or exercise command. State of Calamity and State of Imminent Disaster are distinct legal routes; neither is synonymous with EOC activation. RACI describes responsibility and consultation; it does not confer statutory authority.

### 1.3 Consolidated Manual Architecture

The supplied consolidated working draft is one integrated Manual for the CDRRMO and EOC, organised into ten connected chapters:

1. Legal Mandate, DRRM Governance and Institutional Accountability.
2. CDRRMO Organizational Structure, Staffing and Human Resource Management.
3. Risk Intelligence, Planning and Institutional Preparedness.
4. Early Warning, EOC Activation, Incident Management and Emergency Response.
5. Recovery, Rehabilitation and Build Back Better.
6. DRRM Financing, Resource Management and Accountability.
7. Monitoring, Evaluation, Knowledge Management and Continuous Improvement.
8. Stakeholder Engagement and Institutional Partnerships.
9. Public Awareness, Community Resilience and Capacity Development.
10. Institutional Sustainability, Deep Resilience and Recognition.

The Manual describes five core processes, supported by six enabling processes, and applies systems thinking and Total Quality Management (TQM). It uses the Plan–Do–Check–Act (PDCA) cycle: each process has an owner and record, performance is measured, and corrective actions close only when evidence demonstrates effectiveness. The Manual uses the Master Procedure Register (Annex A), chapter-level validation registers, SOPs, RACI matrices, performance measures, forms and references.

Chapters 1 and 2 present procedures primarily through workflows and the SOP register; Chapters 3–10 use the full SOP format. Preserve the Manual's controlled vocabulary:

| Term | Meaning | Platform Treatment |
|---|---|---|
| **SOP** | Controlled Manual text stating who does what, when, under what authority and with which records. | Library / controlled Manual content. |
| **Protocol** | Point-of-action checklist implementing part of an SOP during an event or duty shift. | DRRM protocol execution. |
| **Workflow** | Multi-office management cycle implementing an SOP over days or months. | DRRM workflow. |
| **Form** | Record that closes a process step and becomes evidence. | Controlled form and completed record. |

Every operational template must identify its `kind`, controlling SOP, process owner by position (not person), policy references and applicable IAT indicator IDs. Never call a protocol, workflow or form an SOP. A written procedure is not proof of implementation; institutionalisation requires approval, use, records and review.

### 1.4 B = MAP And Stakeholder Action

Apply B. J. Fogg's Behavior Model as a practical design heuristic: **Behavior = Motivation + Ability + Prompt (B = MAP)**. It is not literal arithmetic; the expected behaviour occurs when motivation, ability and a timely prompt converge.

- **Motivation:** mandate, institutional responsibility, public value, relevance and accountability.
- **Ability:** clear instructions, accessible Manual text, evidence, tools, manageable tasks, defined roles and low-friction workflows.
- **Prompt:** a timely and specific assignment, notice, instruction, due date or follow-up.

A prompt alone does not make an action reliable when motivation or ability is insufficient. Each review/validation prompt should make clear: who is being asked; why; what exact section, issue or decision is required; how to review it and what evidence/criteria to use; when it is due; what response is expected; and what happens next.

Distinguish stakeholder behaviours (review, validate, recommend, provide evidence or decide within mandate) from CDRRMO governance behaviours (assign, coordinate, receive, route, resolve, monitor and close). Measure MODE by whether the right office completes the right institutional action with evidence and proper authority—not by logins, uploads or feature clicks alone.

## 2. Current Institutional Assessment Baseline — IAT v1.7

### 2.1 Controlled Instrument

The supplied `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx` is the current assessment workbook. Its Guide identifies **methodology Version 1.1** and **workbook file v1-7 dated 11 November 2026**. Keep these version labels distinct: IAT workbook v1.7 is not the same as methodology v1.1.

The instrument contains 140 indicators in 22 domains:

- **Part A — CDRRMO:** 82 indicators in 10 domains.
- **Part B — EOC:** 43 indicators in 7 domains.
- **Part C — Interface:** 15 indicators in 5 domains, owned by other City offices or partners and reported separately.
- Parts A+B comprise 125 indicators: 79 Mandatory (M) and 46 Good Practice (GP). They form the Institutional Maturity Index (IMI). Part C has no Mandatory indicators and is not added to the IMI or Mandatory Compliance Rate.

The workbook's Crosswalk sheet shows how UNDRR Scorecard criteria and RA 12287 IRR provisions are treated as New, Modified, Covered, Interface or Deferred. Do not infer that a criterion is covered simply because a general topic appears in the Manual.

### 2.2 Scoring And Evidence Rules

| Score | Maturity | Minimum Meaning / Evidence |
|---:|---|---|
| 0 | Absent | Not in place; no plan to establish it. No evidence required. |
| 1 | Initial / Ad Hoc | Informal, individual-dependent practice; verbal account only. |
| 2 | Developing | Incomplete, outdated, unapproved or inconsistently applied; draft/partial document or partial practice observed. |
| 3 | Compliant / Established | Meets the standard; approved documentation **and** proof of use (records, logs, reports). |
| 4 | Advanced / Institutionalised | Score 3 evidence plus test, exercise or AAR showing review and improvement. |
| NA | Not Applicable | Excluded from computation and requires written justification. |

Evidence caps in the scoring model: interview/FGD or verbal evidence alone caps at 2; partial document/practice caps at 2; approved document plus proof of use supports up to 3; tested/improved evidence supports 4. The IAT workbook's separate **Evidence Validation Status** field records whether the source evidence has been checked. Evidence verification is not itself a score and does not automatically raise or lower one.

Weights: 3 = critical to life-safety or legal compliance; 2 = important to effectiveness; 1 = supportive/good practice. Weighted maturity is `sum(score × weight) / sum(weight)` for scored items. Maturity bands: below 0.5 Absent; 0.5–1.49 Initial; 1.5–2.49 Developing; 2.5–3.49 Compliant; 3.5 or above Advanced. Banding uses the unrounded index before display rounding. Mandatory Compliance Rate is the share of scored Mandatory Part A+B indicators rated 3 or 4; target 100%. A domain is compliant only when its Mandatory Compliance Rate is 100%.

Gap Priority Score: `(4 − score) × weight × 1.5` for Mandatory A/B items and `(4 − score) × weight × 1.0` for Good Practice and Part C interface items. High is at least 9; Medium is 4 to below 9; Low is below 4. Do not apply the Mandatory multiplier to Part C.

### 2.3 Workbook Baseline Values — Provisional

The current v1-7 workbook dashboard reports:

| Measure | Workbook Value |
|---|---:|
| Indicators scored in Parts A+B | 125 of 125 |
| Part A CDRRMO maturity | 2.0588 — Developing |
| Part B EOC maturity | 1.8478 — Developing |
| Institutional Maturity Index (A+B) | 1.9847 — Developing |
| Mandatory Compliance | 32.9% (26 of 79) |
| High-priority gaps, Parts A+B | 30 |
| Part C Interface Index | 1.4074 — Initial |

Domain-level priorities visible in the workbook include A9 Rehabilitation & Recovery (1.375, Initial), B4 EOC Organization & Staffing (1.3077, Initial), B5 Information Management & Reporting (1.4667, Initial) and B6 Coordination & Resource Management (1.3846, Initial). Use the workbook Dashboard as the source for the complete domain table; do not manually recalculate or substitute earlier baseline values.

The workbook records that 24 indicators rely on FGD evidence alone. Its v1-7 update caps 11 FGD-only items at 2 and reduces four unsupported score-4 items to 3 because no test, exercise or AAR was on record. These adjustments are already reflected in the v1-7 workbook baseline. The earlier IMI 2.13 and Mandatory Compliance 41.8% from v1-5/v1-6 are superseded. The earlier estimate of 27 FGD-only items is also superseded by the current workbook's count of 24.

All scores and evidence-validation statuses remain **provisional pending the validation process**. Do not describe a provisional baseline as a final validated assessment or a performance rating adopted by the City. Informants must be identified by office/position in shared records; do not store informant names in IAT or EOC records.

### 2.4 Assessment Implementation Rules

- Keep IAT indicator IDs stable. Never renumber indicators to match chapter order or platform screen order.
- Keep Part C separate from the IMI. Its lead office is not automatically the CDRRMO and its score is not a CDRRMO performance score.
- Separate score, evidence strength, evidence-validation status, assessor, validator and validation decision.
- Preserve the evidence narrative and source metadata. A document's presence in the Vault does not prove that it supports a particular indicator; assess relevance, currency, approval and evidence of use.
- A validated response is locked according to database rules; corrections follow an auditable return/reopen process, not silent overwrite.
- Training attendance, drills or exercise participation are evidence only when the indicator's evidence standard is met. Training records must not automatically change an IAT score.

## 3. Barangay Master Data, Hazard Intelligence And Spatial References

### 3.1 Current Barangay And Population Reference

The latest supplied Barangay-Level Hazards Assessment workbook uses an **85-barangay PSGC reference as of 31 July 2025** and reports an official **2024 POPCEN city population of 238,545** as of 1 July 2024. The workbook's 85-row 2024 barangay population column sums exactly to 238,545. The 2020 CPH city total is 230,998, but its per-barangay data largely follows the older 110-barangay configuration. The four new/consolidated Poblacion barangays do not have official 85-configuration 2020 counts in the workbook; do not invent or proportionally allocate them.

The consolidated Manual and source workbook still note that the CPDO, City Secretary and DILG City LGOO must sign off the City masterlist/crosswalk. Therefore:

- Use 85 and the 10-digit PSGC identifiers as the current operational/reference dataset, consistent with the supplied IAT, hazard workbook and repository's `src/domain/barangays.ts`.
- Do not state that the institutional masterlist reconciliation is formally closed until the required City confirmation is documented.
- Do not silently collapse, rename or crosswalk legacy numbered Poblacion records. Retain the source identifier and add an explicit, approved alias/crosswalk with provenance.
- The repository currently hard-codes `ORMOC_BARANGAY_COUNT = 85`; treat that as the code's current reference, not as proof of a signed City masterlist. If the City's official list changes, update the canonical master data, aliases, map features, seed data, tests and documentation together.

Use the canonical 10-digit PSGC pattern `0803738xxx` and preserve leading zeros. Never join records by truncated 9-digit values, row number, approximate spelling or name alone when a stable PSGC or approved crosswalk is available. Keep aliases such as historical barangay names separate from canonical names.

### 3.2 Geographic Reference And Boundary Provenance

The supplied GeoJSON is an 85-feature FeatureCollection from OCHA COD-AB `phl_admin4` (HDX COD-AB), metadata `valid_on: 2025-02-13`, with `psgc_10digit` identifiers. The repository uses `public/geo/ormoc-barangays.geojson` as its spatial reference. The companion boundary workbook v1.3 contains a geographic reference sheet with coordinate reference and representative-point provenance. The latest hazard workbook flags some representative points and boundary areas as pending validation.

Do not describe the OCHA COD-AB geometry as a City-certified legal boundary merely because it is used by the app. It is the supplied operational spatial dataset; record its publisher, vintage, CRS and known limitations. For official land-area calculations, legal boundary decisions, parcel-level determinations or authoritative spatial analysis, obtain and validate the applicable PSA/City boundary source and record the approving authority. Use polygon geometry for spatial analysis; a centroid or representative point is for map display only. The city reference coordinate `11.013889° N, 124.604278° E` is for map centering only and must never be copied into a barangay row.

### 3.3 Current Hazard Workbook And Its Limits

Use `Ormoc_City_Barangay_Level_Hazard_Assessment_Updated_2026-11-17.xlsx` as the current consolidated barangay-level assessment reference for this engagement. Its principal sheets are:

- `01_Barangay_Master`: PSGC, canonical name, former-name notes, urban/rural class and population.
- `02_Geographic_Reference`: representative points, CRS, coordinate source and boundary validation status.
- `03_Cluster_Crosswalk`: proposed cluster/district mapping and designation/ratification status.
- `04_Flood_Assessment`: susceptibility, source/vintage, modelled population exposure, denominator/base year, data confidence and validation status.
- `05_Multi_Hazard_Profile`: rain-induced and earthquake-induced landslides, ground shaking, ground rupture, liquefaction, tsunami and storm-surge tags, critical facilities, lifelines and access notes.
- `06_Exposure_Indicators`: population and social/infrastructure exposure fields.
- `07_Vulnerability_Capacity`: sensitivity, access, coping and adaptive-capacity observations.
- `08_Risk_Prioritisation`: proposed priority rank, evidence basis, confidence and validation status.
- `09_Source_Register`: source owner, URL, vintage, scale, access date and limitations.
- `10_QA_Validation_Log`: discrepancy, resolution, owner/action and status.
- `11_Dashboard_Data`: summary values and completion status.
- Individual barangay report worksheets: source-preserving report extracts; not a replacement for the consolidated canonical master.

The uploaded 9 November boundary v1.3 and DDRiVE workbooks are supporting versions. They include QRE assumptions, risk matrix and desk scoring sheets that are not the same thing as the 17 November consolidated workbook. Keep the QRE scoring assumptions and desk assessment as a separately versioned method; do not assume the 17 November workbook contains or validates those QRE outputs.

### 3.4 Hazard Data Quality — Mandatory Safeguards

The 17 November workbook records a mixed maturity of source coverage. The current `04_Flood_Assessment` sheet has 85 barangay rows, with 68 marked **Not assessed**, 11 pending validation against authoritative boundaries and field data, and six pending field validation. The 17 November source batch screened 42 files, retained 39 unique reports after duplicate screening and identified three duplicate groups. Only 11 reports matched current barangay names exactly; 28 source reports remained unmatched. Unmatched numbered Poblacion names and San Pablo (Simangan) were not force-mapped because an authoritative crosswalk was not supplied.

The workbook also records these limitations:

- GeoAnalyticsPH reports may use approximate, non-authoritative administrative boundaries and population denominators that differ from the official 2024 POPCEN baseline.
- Some earlier reports use 2020 CPH denominators. For example, the Alegria report's 842 exposed of 977 is based on the 2020 population figure, not the 2024 POPCEN figure of 1,557.
- Original age-group and sex values are retained as supplied. They are not rebinned to the workbook's standard exposure bands, and they must not overwrite PSA 2024 population baseline fields.
- The workbook's flood-prone population is an areal-proportion/modelled exposure estimate. It is not a household-level count, flood depth, inundated land area, forecast, evacuation trigger or declaration trigger.
- Flood-prone area and validated total land area remain unavailable pending authoritative GIS intersection of validated boundaries with the DENR-MGB 2018 flood layer. Missing values are not zero.
- The CDRA Table 3 source matrix is incomplete: 58 barangays were transcribed and 27 rows are missing. The workbook records discrepancies between the RIL/storm-surge tag counts in the partial matrix and the cluster proposal. Do not infer missing rows or force the tag counts to agree.
- The multi-hazard profile includes citywide or map-derived values and barangay tags of varying confidence. Older READY ground rupture, liquefaction and earthquake-induced landslide maps (2007–2010) retain vintage and legacy labels; use caution for engineering or parcel-level decisions.
- Critical-facility and lifeline inventories, household counts, validated land areas/density and some barangay-level vulnerability/capacity fields remain incomplete or pending CBMS/City source data.
- The 17 proposed priority ranks are derived from legacy DRRM Plan Table 7 entries mapped to current names; 68 barangays remain Not assessed. These are not a complete, validated 1–85 risk ranking. They must not be used as a definitive allocation formula or automatic operational priority.
- The six-cluster model and assignments are proposed. Do not treat proposed clusters, coordinators or pilot D1/D3 arrangements as designated until the appropriate City authority ratifies them and the full 85-barangay crosswalk is validated.

Missing values must remain blank or explicitly `Not available`, `Not assessed`, `Pending validation`, `Unmatched` or `Proposed — pending validation`. Never zero-fill missing data, assign a default hazard class, impute a barangay value from the city average, or convert missing barangay reports into a zero-incident report.

### 3.5 Hazard Sources And Operational Interpretation

Use the competent agency's current product for operational decisions: PAGASA for weather and hydrometeorological bulletins; PHIVOLCS for earthquake, tsunami and volcanic information within its mandate; DENR-MGB for geohazard information; and GeoRiskPH/GeoAnalyticsPH for the applicable data products and methods. City CDRA, DRRM Plan, LCCAP, CLUP, CDP, DDRiVE and historical records provide planning context, subject to source vintage and quality flags.

Hazard maps are reference layers, not live warnings. A static storm-surge scenario map is not a current advisory. A susceptibility map is not a site-specific engineering assessment. Modelled exposure is not a confirmed affected-person count. The platform must not generate or publish official warnings, infer real-time hazard conditions from a static map, automatically change an EOC alert level, order evacuation, declare a calamity or declare a State of Imminent Disaster.

Short-lead flash floods and landslides, including the Anilao–Malbasag river system, require city-level readiness and early-action procedures appropriate to available lead time. Do not force such hazards into a statutory State of Imminent Disaster pathway if the statutory lead-time conditions are not met. Follow the applicable law and verified agency information; do not invent thresholds.

### 3.6 QRE And Flood-Prediction Safeguards

The 9 November boundary/DDRIVE workbooks contain QRE assumptions, a 5×5 risk matrix and a pre-scored citywide hazard desk assessment. The QRE workbook itself says desk scores must be re-scored in a QRE workshop before official use. Treat its labels, weights, formula and ranks as a versioned assessment method requiring validation—not as official operational triggers.

The earlier Flood Prediction Plan evaluates a third-party student/demo model and explicitly notes missing training data, absent published validation metrics, no reproducible training dataset and unconfirmed river-gauge inputs. It is a concept assessment only. Do not deploy it, use its 0.5 threshold, label a forecast or make operational recommendations from it without a City-owned dataset, validated model, documented performance, monitoring, human review and approved operational governance.

## 4. Current MODE Architecture And Repository Map

### 4.1 Stack And Runtime

The supplied repository uses Vite 5, React 18, TypeScript, Tailwind CSS 3, React Router 6, Dexie 4 / IndexedDB, Zod, `marked` with DOMPurify, `vite-plugin-pwa`, Supabase Postgres/Auth/Storage/Realtime, MapLibre/PMTiles and Recharts. Package versions are pinned in `package.json`; Node 22 or later is specified. There is no custom application server. Business rules belong in Postgres/SQL; TypeScript domain functions mirror them and require parity tests.

The app is local-first: screens read from Dexie; edits use the store layer and outbox; sync pushes queued writes and pulls server data. Authority actions require a live connection and use the online-only path. Confirm the actual migration, role and sync implementation before adding a new table or workflow.

### 4.2 Repository Areas

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Public routes, authenticated workspace shell and top-level feature routing. |
| `src/components/` | Shared UI primitives, AppShell, notices, dialogs, accessibility, branding and feedback. |
| `src/domain/` | Domain rules and TypeScript mirrors of SQL (scoring, anticipatory action, EOC, protocols, barangay references, forms, structure, GIS/KML). |
| `src/features/iat/` | Institutional assessment at `/assess`. |
| `src/features/library/` | Manual chapters, section traceability, requirements and document structure. |
| `src/features/protocols/` | DRRM workflows, protocols and forms at `/drrm`. |
| `src/features/eoc/` | EOC operations, logbook, SitReps, requests, resources, barangay reporting, liaison, risk, plans, roster, map and anticipatory action. |
| `src/features/eoc/map/` | Georeferenced hazard-map registry, city Geo-COP map and static reference-map catalogue. |
| `src/features/vault/` | Document Vault, document review and references. |
| `src/features/raci/` | Searchable RACI board. |
| `src/features/eoc-assessment/` | EOC Capability Assessment Checklist. |
| `src/features/tools/` | ICS, PSCP, Gawad KALASAG, ECHO and Flood Intelligence tools. |
| `src/features/governance/` | Manual review register, decisions, workshop and stakeholder pages; in the supplied snapshot, top-level routing/navigation is not wired. |
| `src/features/settings/` | Account, configuration and sync settings. |
| `src/lib/` | Dexie database, store/outbox, sync, auth, time, IDs and reference bootstrap. |
| `supabase/migrations/` | Database schema, RLS, triggers, guards, RPCs and views. |
| `supabase/seed/` | Reference and operational data seeds. |
| `supabase/tests/` | SQL security and domain-rule tests. |
| `tests/integration/`, `e2e/` | Sync integration and Playwright journeys/accessibility tests. |
| `scripts/` | Reference generation, workbook/manual ingestion, SOP registry, GIS and test scripts. |
| `reference/` | Controlled source workbooks, Manual source material, GIS/flood assessment inputs and legal references. |
| `docs/adr/`, `docs/system-design.md`, `docs/design-system.md` | Architecture decisions, system and UI design. |

### 4.3 Current Routes In The Supplied Snapshot

Top-level authenticated routes in `src/App.tsx` include `/today`, `/assess/*`, `/drrm/*`, `/eoc/*`, `/library/*`, `/settings/*`, `/vault/*`, `/tools/*`, `/raci/*` and `/eoc-assessment/*`. The legacy `/protocols/*` route redirects to the DRRM module. The EOC route group includes `/eoc/log`, `/eoc/sitreps`, `/eoc/requests`, `/eoc/resources`, `/eoc/barangays`, `/eoc/liaison`, `/eoc/risk`, `/eoc/plans`, `/eoc/roster`, `/eoc/map` and `/eoc/aa` with related subroutes. Hazard maps redirect to `/assess/hazard-maps`. Tools include `/tools/ics`, `/tools/gk`, `/tools/pscp`, `/tools/flood-intelligence` and ECHO routes. Verify every route against the current router before documenting it.

The governance route file defines internal pages for review register, decisions, workshop and stakeholders, but the supplied root router does not expose `/governance/*`. Do not give users a route that is not mounted.

### 4.4 GIS Asset Separation

The supplied GIS update preserves `public/geo/ormoc-barangays.geojson` and eight existing georeferenced hazard rasters. Georeferenced overlays remain registered in the existing hazard-map registry. The sixteen new City map sheets are stored under `public/geo/hazard/reference/` and registered by `src/features/eoc/map/referenceMaps.ts`; they are **static cartographic references**, not georeferenced overlays. The EOC Geo-COP gallery and Flood Intelligence page share that static-map catalogue.

The sixteen images were upscaled to a 3,200-pixel long edge using Lanczos resampling. Upscaling does not improve the source map's original resolution, scale, accuracy or geospatial precision. Preserve the original printed map legend, source, date, scale and caution. Do not treat static image maps as analytical overlays or derive coordinates from them.

Flood Intelligence currently presents modelled flood-exposure material and map references. The supplied update says Lao age/sex data was transcribed from valid source worksheets; Linao age/sex data remains pending because the separately supplied file was a macOS alias, not a valid XLSX. Do not infer or fabricate Linao age/sex values. The platform's hazard page is decision support, not a forecast or warning service.

## 5. Architecture Invariants — Do Not Break

1. **Single rule source:** business and legal rules live in SQL. TypeScript mirrors must identify the migration they mirror and have unit/parity tests. Keep scoring parity tests aligned with the workbook's unrounded banding and Part C rules.
2. **Local-first reads:** screens read from Dexie and remain useful offline. Do not block core reading screens on network calls.
3. **Atomic local writes:** use `save()` / `saveMany()` so the row and outbox record are written in one Dexie transaction.
4. **Optimistic concurrency:** editable records use server-maintained version/timestamp fields and the repository's stale-write conflict semantics. Do not bypass the store or implement unsafe last-write-wins behaviour.
5. **Server-stamped fields:** never send server-owned creator, validator, approver, timestamps, sequence, deadline or snapshot fields. Keep omit lists accurate in `src/lib/tables.ts`.
6. **Authority actions online-only:** approvals, EOC alert-level changes, declaration steps, disbursements, role grants, official validation/closure and other authority-bearing actions require connection through the approved online call path. Never queue them for later execution while offline.
7. **Reliable sync:** classify transient errors and retry with backoff; one stuck item must not block independent items. Preserve refused uploads for retry/export. Never silently delete a failed local evidence file.
8. **Role enforcement:** use the roles and database policy actually defined in the current migration/RLS model. Enforce permissions in SQL and triggers, not only in React. Do not invent roles or assume UI hiding is security.
9. **Immutability and audit:** approved Manual versions, validated assessment records, approved SitReps/requests, closed protocol runs, declaration records and financial records follow their server-side locks. Corrections are append-only or go through an explicit return/reopen process. Vault records are superseded, not silently deleted.
10. **Privacy by schema:** do not add fields for names of evacuees, patients, affected households or informants unless a documented lawful basis, DPO review and approved data model require them. Default to aggregated barangay counts and minimum necessary personal data. Every free-text field warns users not to enter sensitive personal information.
11. **Missing is not zero:** null/blank counts, unassessed hazards and missing evidence remain distinct from zero. Do not coerce null to zero in SQL, TypeScript, charts, exports or dashboards.
12. **Event scoping:** EOC reports, barangay status, resource requests and board totals are scoped to the relevant activation/event. Do not add stale records from a prior event to the current one.
13. **External data is not an authority action:** external agency links, static maps, modelled exposure and reference layers support interpretation. They do not issue official warnings, change alert levels or trigger evacuation/declarations.
14. **No custom application server or edge functions** unless an accepted ADR changes this architecture. Use Supabase SQL/RLS/RPC and approved platform facilities.
15. **OAuth and connected apps:** follow the current read-only/approval restrictions in ADRs and RLS. Do not expose data to an external integration until the City authorises it.
16. **Legal clocks:** use server time for legal deadlines and display `Asia/Manila`. Follow the current time validation and server-stamping rules.
17. **No false completion claims:** report exactly which tests, migrations, deployment steps and reviews were run. If not run, state `Not run here`.

## 6. Manual Governance, Review And Validation Workspace

ADR-043 and the supplied governance files establish a proposed Manual Review and Validation Workspace direction. The repository snapshot contains a governance migration, seed, feature pages and apply instructions, but top-level route wiring is absent in the supplied `App.tsx`. Treat the workspace as an implementation package requiring integration and verification, not as a deployed capability.

The intended governance workspace connects, rather than duplicates, the Manual Library, SOP registry, Vault, IAT, RACI and EOC/DRRM workflows. Its functions include:

- **Review Register:** stable review-item IDs, chapter/section references, issue, source, priority, lead reviewer, supporting validators, status, evidence and closure test.
- **Outstanding Decisions Register:** decision ID, single decision owner, supporting validators, options/question, Manual coverage, required evidence, status and decision record.
- **Stakeholder / Workshop Management:** office-based roles, proposed vs confirmed designations, session agenda, outputs, attendance/participation evidence and action follow-through.
- **Document and content traceability:** controlled chapter, section, annex, SOP, protocol and form identifiers; legacy aliases; duplicate/conflict detection; link to the authoritative source and evidence.
- **Evidence-based closure:** a review item closes only when the specified closure test and evidence are recorded and the authorised person accepts the disposition.
- **Assignments and prompts:** explicit owner, expected behaviour, reason, required evidence, deadline, response and next step, designed around B = MAP. Do not imply that every assignment/reminder function already exists.
- **Reporting:** open/closed counts by chapter, criticality, lead office, decision status and validation stage, with source version and as-of date.

Do not flatten document governance into one status enum. Keep distinct dimensions for drafting, review, validation, approval, effectivity and records/archive. A document can be reviewed but not validated, validated but not approved, approved but not yet effective, or superseded after effectivity. Define transitions, authority and evidence for each dimension.

The review tracker is not a generic comment board. Extend the existing object-scoped conversation model only through an accepted ADR and preserve parent-object access rules, audit and offline capture. Never close an item merely because a meeting occurred, a comment was added, a file was uploaded or a person attended training.

The earlier supplied Review & Validation Tracker V-2 is a controlled working draft (69 validation items, 18 outstanding decisions, 12 proposed workshop sessions). Use those counts only as import/reconciliation checks against that exact workbook version. Do not hard-code them as permanent totals or claim that proposed stakeholder/cluster assignments are confirmed.

Before enabling governance functionality, verify:

1. Stable source IDs and idempotent import; no duplicate or dropped review items/decisions.
2. Chapter/section/SOP/form identifiers reconcile with the consolidated Manual and Master Procedure Register.
3. Lead reviewer, decision owner, validator, approver and platform role are separate concepts.
4. Status transitions are evidence-gated and authority-controlled.
5. RLS, append-only audit, online-only authority actions and offline read/capture rules are tested.
6. The governance route is mounted in `src/App.tsx` and navigation is visible to authorised roles.
7. The source tracker version and import batch are traceable.
8. No 85-vs-110 or cluster mapping is represented as formally resolved without the relevant City evidence.

## 7. Development Workflow For Any Change

1. **Frame the change.** Identify the master requirement (MR-01…MR-18), relevant IAT indicator IDs, Manual chapter/section/SOP, legal source and data dependencies. Decide whether the function is offline capture, online authority action or read-only reference.
2. **Inspect before editing.** Read the exact current code, migrations, seed, types, tests, routes, source workbook and relevant Manual section. Never implement from a stale project summary or old skill excerpt.
3. **Record design decisions.** New architectural direction requires an ADR with Context, Decision, Consequences, Status and date, indexed in `docs/adr/README.md`. Supersede accepted ADRs; do not silently rewrite their historical decision.
4. **Backend first.** Add a new migration; never edit an applied migration. Use UUID keys, version/timestamps, audit tracking, RLS, minimum grants, split policies, guards and fixed `search_path` for security-definer functions. Use server-stamped fields. Add role-by-role allow/refuse tests and lock tests. Keep legal parameters auditable and versioned.
5. **Sync layer.** Register tables in `src/lib/tables.ts`, bump Dexie schema in `src/lib/db.ts`, add types, omit server fields and ensure parent-before-child sync ordering. Add integration tests for conflicts, RLS refusals, uploads and pagination.
6. **Domain layer.** Add TypeScript mirrors of SQL rules with migration references and unit/parity tests. Scoring must match IAT v1.7 workbook formulas, including evidence caps, unrounded maturity banding, Mandatory weighting and separate Part C treatment.
7. **Frontend.** Use lazy-loaded feature routes and shared UI primitives/tokens. Read from Dexie with live queries; write through the store or online-only action path. Every interactive control needs a clear label, purpose/tip and refusal reason. Provide mobile-first layout, accessible focus, minimum 44 px touch targets, keyboard support, dark mode and WCAG 2.1 AA checks.
8. **Reference data and Manual.** For a changed IAT workbook, update the single canonical reference workbook, seed generation, SQL/TS parity, baseline seed and `REFERENCE_VERSION`. For barangay data, validate PSGC, aliases, geometry, source vintage, missingness and QA log before updating maps or database seeds. For new Manual content, use the controlled chapter source, update Library seed/SOP registry/traceability and preserve draft status until validated and approved.
9. **Verify.** Run `npm ci` where appropriate, `npm run check`, `npm run test:db`, `npm run test:it`, `npm run test:e2e`, GIS/map tests and accessibility tests as applicable. Report test names, counts and environment. Do not claim success for tests not run.
10. **Document and release.** Update README, system design, design system, ADR index, `DEPLOY.md`, release notes and package version. Verify CI on the target branch, migrations and production environment before tagging or calling a release complete.

## 8. UX, Content And Design System

Follow `docs/design-system.md`, `src/styles/tokens.css`, `tailwind.config.ts` and `src/components/ui.tsx` as the sources of truth. Do not introduce local hex colours, arbitrary spacing or duplicate primitives when tokens/components exist.

- **Purpose before decoration:** optimise for reading speed, clear operational state and avoidance of errors.
- **State before content:** show EOC level, declaration status and sync state where relevant. Name levels in text; never rely on colour alone.
- **Colour semantics:** City palette expresses identity/selection; status colours express status; EOC level colours are reserved for EOC state/controls; RACI colours are reserved for R/A/C/I; DRRM pillar colours are reserved for Library navigation. Do not repurpose these meanings.
- **One primary action per view:** use explicit verbs such as `Submit for validation`, `Start protocol`, `Approve version` or `Record decision`.
- **Explain controls:** tooltips/help text say what a control does; disabled/refused actions explain why.
- **Mobile-first:** thumb-friendly layout, at least 44 px targets, bottom actions on phone sheets, bottom navigation on phone and side navigation at larger breakpoints.
- **Accessibility:** WCAG 2.1 AA, visible focus, semantic headings/labels, keyboard navigation, screen-reader descriptions, sufficient contrast, reduced motion and accessible charts/tables.
- **Typography:** Montserrat for headings, Poppins for body, Roboto Condensed for dense data/labels; self-hosted fonts must work offline and comply with CSP.
- **Language:** plain, concise operational English; define acronyms; distinguish instruction, recommendation, proposal, warning, status and legal requirement. Do not use alarmist or ambiguous copy.
- **Records:** distinguish draft, pending, returned, validated, approved, effective, superseded and archived. Never use a green success state to imply legal approval when only a technical save occurred.

## 9. Data Science, Risk Analytics And Evidence Quality

1. **Provenance first:** every dataset/metric must identify owner, source, vintage, date accessed, geography, unit, denominator, method, confidence, validation status and limitations.
2. **Separate hazard, exposure, vulnerability, capacity and risk.** Do not call an exposure estimate a risk score or treat a hazard susceptibility class as an impact forecast.
3. **Keep units and denominators visible.** Population counts, households, hectares, percentage of barangay land, percentage of population, depth, intensity and return period are different measures. Do not compare them without a defined method.
4. **Preserve source values.** Keep original report tables, age bands, sex fields and denominators. Add harmonised fields as a separate derived layer with method and lineage; do not overwrite raw data.
5. **Missingness is information.** Distinguish not assessed, not available, no source, not applicable, unmatched, pending validation and verified zero.
6. **Avoid false precision.** Do not show extra decimals or map precision beyond the source's accuracy. Upscaled rasters do not gain positional accuracy.
7. **No unsupported imputation.** Do not infer barangay hazard classes, population, exposed households, facility counts or cluster assignment from neighbours or city averages without a documented, validated method.
8. **Model validation before deployment:** require a reproducible dataset, data dictionary, train/test strategy, out-of-sample metrics, calibration, error analysis by geography and population group, drift monitoring, human review and documented approval. A demo notebook or unvalidated model is not an operational forecast.
9. **Human decision authority:** dashboards and rankings support professional judgement. They must show provenance and caveats and must never autonomously issue warnings, change EOC levels, order evacuation or make legal declarations.
10. **Fairness and inclusion:** where data permit, disaggregate by age, sex, disability and other legally appropriate vulnerability dimensions while protecting privacy. Do not infer individual vulnerability or expose identifiable households.

## 10. Privacy, Security, Continuity And Institutional Ownership

- The City Government of Ormoc owns institutional code and data as stated in project governance. MODE must be maintainable by a local IT contractor and City ICT support under City direction.
- CDRRMO is the institutional owner/custodian of the Manual governance process after formal turnover, subject to City policy. Platform administration is not the same as Manual approval or legal authority.
- A separate Data Protection Officer (DPO) function must be designated through the City's proper process. Do not assume the platform administrator is the DPO. Retention, redaction, access, breach response and data-sharing schedules must follow approved City/DPO policy; do not invent retention periods.
- Formal handover should cover source code/repository ownership and access, credentials and account recovery, architecture/configuration, database and storage, backups/restore evidence, privacy/security, dependencies, domain/DNS, CI/CD, runbooks, known limitations, pending decisions, vendor/developer access review and access expiry.
- Backups are not proven until restoration is tested and documented. Record recovery point/time objectives only where approved and tested.
- Use least privilege, RLS, private storage, short-lived signed URLs and the current Content Security Policy. Never expose service-role keys in client code or logs.
- Training/workshop environments must be separate from production where the current City deployment process requires it. Do not experiment on live operational records.

## 11. RA 12287 Anticipatory Action And EOC Safety Rules

Implement the State of Imminent Disaster and anticipatory-action sequence only from the current official Act and IRR. The platform may structure the PDRA, evidence, timeline, checklist, proposed decision and reporting records; it must not independently make the declaration or exercise the Mayor's authority.

The supplied project documentation describes the 72-hour statutory lead-time floor (with the statutory extension up to five days in the specified circumstances), the RDRRMC response period, the Mayor's executive issuance, the AA funding ceiling linked to the 70% LDRRMF component, tranche limits, lifting and post-event reporting. Re-check each provision against the official text and certified interpretation before changing code. The 29-item MODE checklist is a platform-derived checklist across the IRR Rule IV provisions; the IRR itself should not be misquoted as prescribing a 29-item list.

For EOC operations, White/Blue/Red alert levels, activation and deactivation must follow verified national guidance and valid City issuances. Confirm the exact title and operative requirements of NDRRMC Memo 131 s. 2018 with OCD Region VIII before relying on it as sole legal authority. EOC activation is not a declaration. A warning receipt is not an automatic alert-level change. Keep the chain explicit: official warning/product → receipt and verification → interpretation → authorised decision → dissemination → acknowledgement → action → review.

## 12. Current Repo-Specific Observations To Recheck Before Work

The supplied archive includes, among other items:

- Package manifest 1.22.0 and current reference bootstrap `iat-1.7/2026-11-12-intro-v1.1`.
- IAT v1.7 operational baseline seed and a separate v1.7 update migration/seed.
- ADR-035 EOC Capability Assessment; ADR-036 indicator-to-MODE links; ADR-037 training runs; ADR-038 DILG VIII SitRep; ADR-039 resource/DDRiVE decisions; ADR-040 object-scoped conversations; ADR-041 flood intelligence/hazard map/analytics; ADR-042 City reference map library; ADR-043 Manual Review and Validation Workspace.
- Migration history through `20261117003400_manual_governance.sql` in the supplied archive. Confirm applied migration status against the actual target Supabase environment before deploying or seeding.
- A 154-item EOC Capability Assessment Checklist, prefilled from IAT v1.7 B_EOC where direct mappings exist. The checklist is not the same as the 140-indicator IAT; items without direct IAT mappings remain not assessed and require their own evidence.
- RACI board for Annex 1-F and chapter matrices 1–10; RACI entries are advisory/accountability mappings and do not create statutory authority.
- A DILG VIII SitRep workflow and resource inventory/liaison functions; verify current reporting templates, cut-off times and official guidance before changing.
- Flood Intelligence, eight georeferenced hazard rasters, an 85-feature barangay GeoJSON and sixteen static reference map images. Keep georeferenced overlays and static map gallery assets distinct.
- Governance feature/migration/seed package with root route integration still outstanding in this archive.

These observations are a snapshot, not permanent facts. Reinspect before each implementation task.

## 13. Release And Handover Discipline

- Use Git CLI and normal reviewable commits; do not use GitHub web upload for a large source tree or files requiring hidden directories, permissions or binary integrity.
- Work on a dedicated implementation branch when write access is granted; preserve `main`; submit a reviewable pull request. Never claim a PR exists until its URL/state is verified.
- Do not commit secrets, service-role keys, private data or unapproved source documents.
- Tag every approved release and create release notes only after the required CI, database, integration, E2E, accessibility and deployment checks pass.
- Verify `.github/workflows/` against the actual repository; documentation claiming CI exists is not proof of a passing workflow.
- A release is not complete until package version, migration state, seeds, reference version, deployed environment, smoke tests, backup/restore and rollback plan are reconciled.
- **Handover package convention:** provide only new/changed files since the previous handover, repo-relative paths, no patch files, a separate delete list where needed, and ordered apply steps. Do not commit a `DELETE.txt` into the repository; it is a recipient instruction.
- For a ZIP-only review, state that branch, commit, remote PR and production deployment were not verified.

## 14. Output Checklist

Before handing over a design, code change, data update or release, confirm:

- [ ] Source hierarchy, file versions, date and confidence are recorded.
- [ ] Change is mapped to MR requirement(s), IAT indicator(s), Manual chapter/SOP and legal source where applicable.
- [ ] Draft/proposed/validated/approved/effective status is explicit and correct.
- [ ] IAT v1.7 rules and baseline values are used; Part C remains separate; evidence validation is distinct from scoring.
- [ ] Barangay joins use canonical PSGC and approved aliases; 85/110 legacy crosswalk caveat is visible until signed off.
- [ ] Hazard source vintage, denominator, method, confidence, QA status and missingness are preserved.
- [ ] Static map images are not treated as georeferenced overlays; hazard references are not presented as live warnings.
- [ ] SQL/RLS/guards, TypeScript parity, Dexie sync, role permissions and audit trail are implemented where required.
- [ ] Offline capture and online-only authority actions are correctly separated.
- [ ] Privacy, DPO, retention, security, accessibility, dark mode and mobile usability are addressed.
- [ ] Tests run and results are reported; unrun tests are explicitly marked `Not run here`.
- [ ] README, system design, design system, ADR index, deployment notes, version and release state are reconciled.
- [ ] Handover includes exact changed files and ordered apply steps.
- [ ] No unsupported claim is made about legal authority, source validation, City approval, GitHub PR, release or production deployment.

## 15. Reference Files And Source Inventory

Use the actual current repository paths when present. For this supplied review, the key source materials were:

- `SKILL.md` — this architect skill (updated from the supplied attachment).
- `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx` — IAT workbook v1.7 / methodology v1.1, 11 November 2026.
- `Ormoc_City_Barangay_Level_Hazard_Assessment_Updated_2026-11-17.xlsx` — consolidated barangay hazard assessment, 85-barangay PSGC reference, updated source-report batch and QA log.
- `Ormoc-City-Barangays_Hazard-Assessment_Boundaries-v1.3_2026-11-09.xlsx` — companion boundary, QRE assumptions, risk matrix and QRE desk assessment reference.
- `Ormoc-City-Barangays_Hazard-Assessment_DDRiVE_2026-11-09.xlsx` — DDRiVE-oriented supporting workbook; preserve its source/version distinctions.
- `Ormoc-City_Barangay-Boundaries_OCHA-CODAB_2026-11-09.geojson` — 85-feature OCHA COD-AB `phl_admin4` spatial reference, valid 13 February 2025.
- `Consolidated_Ormoc_CDRRMO_EOC_Manual-Operations.docx` — integrated ten-chapter working Manual, including front matter, executive summary, introduction, SOP/RACI/validation/annex content. Draft until formally validated and approved.
- Repository ZIP `ormoc-drrmo-main(2).zip` — supplied code snapshot, package version 1.22.0; no Git history included.
- `Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx` — controlled working review/validation tracker; earlier snapshot contains 69 review items, 18 decisions and 12 proposed workshop sessions. Confirm current version before importing.

The exact source filenames in the repository may be normalised (without upload suffixes such as `(1)` or `(2)`). Match by content, version and provenance—not by guessed filename alone.

---

**Operating rule:** Build what the City can lawfully own, operate, maintain and improve. Preserve evidence and institutional authority. Keep the Manual authoritative, MODE supportive, risk information traceable, and every important action accountable.
