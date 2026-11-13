# System design: Manual of Operations for the DRRMO and EOC (MODE) Platform
Version 1.0 · 15 October 2026 · Prepared for the City Government of Ormoc (CDRRMO) by Alvin M. Silva

## 1. Purpose

The platform supports the two outputs of the engagement: the CDRRMO Manual of Operations (MOO) and the Emergency Operations Center (EOC) Manual. It does four jobs:

1. **Assess** the office and the EOC with the Institutional Assessment Tool (IAT) v1.1. That means 140 indicators, evidence-gated scoring and a prioritised action plan.
2. **Write and trace** the manuals. Every section links to the indicators and master requirements (MR-01 to MR-18) it answers.
3. **Run** the manuals as protocols: step-by-step checklists with owners, timings and an audit trail.
4. **Operate** the EOC and the anticipatory-action process under RA 12287 and its IRR (14 Sep 2026). This covers the alert level, logbook, SitReps, barangay status, resource requests, PDRA, declarations, the AA checklist and fund tranches.

The platform supports the manuals but is not the manual. The approved Manual of Operations (one manual for the CDRRMO and the EOC since v1.6, ADR-012) remains the legal document. The platform holds their current text, their version history and the evidence that they are used.

## 2. Users and roles

| Role | Typical person | Can do |
|---|---|---|
| `cdrrmo_head` | CDRRMO Head | Approve SOP versions; validate; manage EOC and declarations; release funds |
| `eoc_manager` | EOC Manager / Operations Chief | Change the EOC level; approve SitReps and resource requests; run PDRA; record declaration steps |
| `eoc_staff` | EOC section staff | Log entries, SitRep drafts, resource requests, barangay figures |
| `duty_officer` | 24/7 duty officer | Logbook, protocols, barangay figures |
| `assessor` | Assessment team | Create cycles, answer indicators, attach evidence |
| `validator` | Validation panel | Validate or return answers; finalise cycles |
| `lead_office_focal` | Focal person of CSWDO, CHO, CEO, CPDO and other lead offices | Answer the Part C indicators their office leads |
| `author` | Manual drafters | Draft SOP versions |
| `viewer` | CDRRMC members, oversight | Read approved material and results |
| `admin` | City ICT | Accounts and roles |

The rules for each role are enforced in the database (ADR-004).

## 3. Architecture

```
 Phone / tablet / desk browser (installable PWA)
 ┌───────────────────────────────────────────────────────────┐
 │ React screens ── domain rules (scoring, AA, EOC, protocol) │
 │        │ reads                         │ writes            │
 │        ▼                               ▼                   │
 │   IndexedDB (Dexie) ◄──── store.save() ──► outbox          │
 │        ▲  pull (cursors)                │ push (FIFO)      │
 │        │                                ▼                  │
 │   Service worker: app shell + fonts cached; API not cached │
 └────────┼────────────────────────────────┼──────────────────┘
          │ HTTPS                          │
 ┌────────┴────────────────────────────────┴──────────────────┐
 │ Supabase (City-owned project, ap-northeast-1 Tokyo)        │
 │  Auth (email + password / magic link)                      │
 │  PostgREST ── Postgres 15+                                  │
 │                ├ RLS policies + role helpers               │
 │                ├ triggers: versioning, audit, workflow,    │
 │                │           evidence gate, record locks     │
 │                ├ RPC: start_protocol, set_eoc_level,       │
 │                │      load_aa_checklist, my_roles          │
 │                └ views: results, traceability, EOC status, │
 │                         declaration board, AA fund status  │
 │  Storage: private "evidence" bucket (15 MB per file)       │
 │  Realtime: EOC tables → clients pull immediately           │
 └────────────────────────────────────────────────────────────┘
```

There is no custom application server. The rules live in SQL so they hold for every client, including future ones such as reports or an SMS gateway.

## 4. Modules

| Module | Route | Main records | Notes |
|---|---|---|---|
| Public pages (1.10) | `/`, `/about`, `/faq`, `/support`, `/policies/*` | — | Indexable; open without an account and without the workspace. Policies from typed data and env (`src/lib/site.ts`), marked draft until approved (ADR-020) |
| Today | `/today` | — | Greeting, active declaration with next deadline, quick actions by role, running protocols, latest log, assessment progress, Manual readiness (approved protocols, workflows and forms), and the Pareto priority dashboard (1.17, ADR-031): the 23 priority indicators in three tiers with live met counts from the current IAT cycle, each gap one tap from its indicator in Assess. Ctrl+K search palette on every workspace screen (ADR-023) |
| Assessment | `/assess` | `assessment_cycles`, `responses`, `evidence`, `actions` | Evidence first, then score; caps by evidence strength; validator workflow; domain and maturity readouts; CSV export; action plan by priority. **Hazard maps** (`/assess/hazard-maps`, moved from the EOC in 1.16, ADR-030) sit just below the IAT: full-width map, full screen, panels and instructions under the map |
| Library | `/library` | `manual_parts`, `manual_areas`, `moo_documents`, `moo_versions`, `moo_document_indicators` | One manual: 5 Parts, 10 functional areas (area outlines carry each indicator's gap by its primary area), drafted Chapters 1–3 with their annexes, SOPs and forms, as Markdown; old codes kept as aliases; draft → for review → approved (Head only), approved versions immutable; traceability, master requirements, framework crosswalk |
| Tools | `/tools` | — (kept in the browser; exported or printed) | ECHO (below), ICS exercise simulator, PSCP workbench, Gawad KALASAG Seal readiness; links (new tab, never framed) to official PAGASA and PHIVOLCS bulletins, Philippine hazard and risk maps, international and satellite services, and DDRiVE-M |
| Tools: ECHO (1.16) | `/tools/echo` (simulator), `/echo/intel`, `/echo/camps`, `/echo/dashboard` | `evacuation_centers`, `camp_reports` (append-only), `camp_feedback`; the exercise stays in the browser | Evacuation and Camp Handling Operations (ADR-030): eight-module training simulator; evacuation intelligence (hazard sheets, DDRiVE exposure, centre and route screening); Camp Management Information System (inventory with RA 12076 Sec. 4 items, aggregate camp reports, feedback log); EOC dashboard with SitRep text and resource requests. Aggregates only; opening and closure are authority records filed online; nothing certifies a centre as safe |
| DRRM: workflows, protocols, forms | `/drrm` (old `/protocols` links redirect) | `protocol_templates`, `protocol_steps`, `protocol_runs`, `protocol_run_steps`, `form_templates`, `v_indicator_sops` | 28 drafts: 13 protocols and 15 workflows (197 steps, 50 forms), including the nine Chapter 3 workflows and the Chapter 4 SOPs 4-01 to 4-09 (ADR-022). Every template names its kind, controlling SOP, process owner, policy basis and IAT indicators (ADR-019). Runs work offline; every step closes on its form (ADR-016) |
| EOC | `/eoc` | `eoc_activations`, `logbook_entries`, `sitreps`, `barangay_reports`, `resource_requests` | Level board (White / Blue / Red), append-only logbook with corrections, SitRep numbering on submit, barangay counts only (a blank count is "not reported", not 0), forward-only request flow. EOC location card (coordinates, map links that open outside the app, KML download; ADR-015). Board, barangay list and SitRep totals count only the current event: back-to-back activations (Blue → Red) are one event; at White level, the last 24 hours |
| EOC: risk intelligence (1.12.1) | `/eoc/risk` | `ddrive_barangay_profiles`, `ddrive_flood`, `ddrive_hazards`, `ddrive_exposure`, `ddrive_vulnerability`, `ddrive_priority`, `ddrive_city_scores`, `ddrive_risk_matrix`, `ddrive_sources` (+ `v_ddrive_city_risk`) | DDRiVE (Data-Driven Risk and Vulnerability Estimation, renamed from QRE) desk-assessment base layer, read-only reference (ADR-024). City risk picture with computed bands; per-barangay profile drill-down; a missing value stays null, never 0. Decision support only — never an evacuation trigger |
| Anticipatory action | `/eoc/aa` | `pdra_sessions`, `declarations`, `aa_actions`, `aa_fund_years`, `aa_disbursements`, `aa_rules` | PDRA decision; declaration timeline per IRR; 29-item MODE checklist derived from the ten sections of IRR Rule IV (the IRR sets no count); fund cap and tranche guard |
| Document Vault | `/vault` | `vault_documents` (+ private `vault` bucket) | Register of laws, guidelines, City issuances, plans and records; each linked to indicators; Document Review checklist with request list download; reference catalogue. Assessors, validators, admin and CDRRMO staff only. Documents are superseded, never deleted |
| RACI board (1.19) | `/raci` | `raci_matrices`, `raci_activities`, `raci_assignments` (+ `v_raci_board`) | Interactive RACI board from the Manual's RACI matrices — Annex 1-F and Chapters 1-10 (ADR-033): search by activity, actor, protocol code or SOP; colour-coded duties (R navy, A dark green, C gold, I white); activities without exactly one Accountable carry a warning (Annex 1-F says "normally one", so it is a flag, not a rule). Sixty activities link to their protocol or workflow; the protocol detail and the Library document page link back. The CDRRMO Head adjusts assignments online (ADR-006); reads stay offline |
| EOC capability assessment (1.20) | `/eoc-assessment` | `eoc_assessment_items`, `eoc_assessment_runs`, `eoc_assessment_responses` (+ `v_eoc_assessment_board`) | The 154-item EOC Capability Assessment Checklist (OCD/NDRRMC TWG Dec 2017) in 15 sections, answered from the IAT v1-7 B_EOC evidence (ADR-035): the item status derives in SQL from the weakest mapped indicator score (`app.eoc_assessment_status`, mirrored in `src/domain/eoc_assessment.ts` under a parity test); summary counts; item drawer with evidence, gap, recommended action and tool links (SOP/Protocol/Workflow/Form) edited online by the assessment team; the CDRRMO Head validates and locks each run (ADR-006). Links out to DDRiVE for risk — never re-scores |
| Settings | `/settings` | `profiles`, `user_roles`, `barangays`, `client_errors` | Sync status and conflict review; appearance; users and roles (admin, online); barangay list import (PSGC CSV); error reports (admin, online); interface components gallery; about and privacy |

## 5. Data model (summary)

All editable tables have `id uuid`, `version int`, `created_at`, `updated_at`, maintained by `app.touch_row()`. The audit trigger writes every insert, update and delete of institutional records to `audit_log` (who, when, before, after).

**Reference (seeded from the v1.1 workbooks).** These are `iat_parts` (3), `iat_domains` (22), `iat_indicators` (140), `master_requirements` (18), `indicator_requirements` (935 links), `indicator_lead_offices` (Part C), `framework_crosswalk` (71 rows: 57 UNDRR Disaster Resilience Scorecard items, 14 RA 12287 IRR provisions), `offices` (26), `hazards` (10) and `aa_action_templates` (29, a MODE checklist derived from the ten sections of IRR Rule IV).

**Manual structure (v1.6, ADR-012).** `manual_parts` (5) and `manual_areas` (10) come from the Inception Report (Annex A). Each `iat_indicators` row has a `functional_area` (Traceability Dictionary v1.1). Each `moo_documents` row has `area_no`, `also_areas`, `chapter_no`, `aliases` (old codes) and `parent_id` (an annex to its chapter; a merged shell to its new home). `kind` is `area`, `chapter`, `annex`, `sop` or `form`. Merged shells are `superseded` and hold no indicator links. The Introduction is front matter (1.17, ADR-031; un-chaptered in 1.18, ADR-032 addendum): doc code `Introduction`, `chapter_no` NULL - code checks `chapter_no != null`, never truthiness, and the Library sorts the Introduction first. The Library renders each chapter and area under its DRRM pillar color (prevention / preparedness / response / recovery; area → pillar map in `src/features/library/pillars.ts`).

**Language (1.17, ADR-031).** Navigation, dashboard chrome and settings speak English or Cebuano (user choice, per device, `src/lib/i18n.tsx`); the manual, citations, tooltips and protocols stay in English.

**Assessment.** A cycle has one response per indicator. A response has evidence items (kind and strength) and a history of score changes. Actions are the improvement plan rows generated from gaps. The views `v_response_results`, `v_domain_results` and `v_cycle_results` compute caps, gap priority, maturity, mandatory compliance, the IMI and the Interface Index.

**Anticipatory action parameters** (`aa_rules`; an admin updates them, on the CDRRMO Head's instruction, when national guidance changes. Every change is audited):

| Key | Value | Basis |
|---|---|---|
| `aa_share_of_ldrrmf_70` | 0.10 | AA from ≤ 10% of the 70% LDRRMF |
| `tranche_beyond_max` | 0.30 | At most 30% for interventions beyond a lead time of three (3) days (IRR Rule V Sec. 2) |
| `tranche_within_max` | 0.70 | Up to 70% within a maximum lead time of three (3) days (IRR Rule V Sec. 2) |
| `lead_threshold_days` | 3 | Tranche boundary: three (3) days |
| `min_declaration_lead_days` | 3 | A declaration needs severe impact and a lead time of at least three (3) days, checked at the PDRA, at the request and again at the Mayor's declaration (RA 12287 Sec. 6(b); IRR Rule II Sec. 3); otherwise city early action |
| `extended_declaration_lead_days` | 5 | The three-day lead time may be extended to five (5) days (RA 12287 Sec. 6(b)); a PDRA earlier than that is flagged, not blocked |
| `rdrrmc_reply_hours` | 24 | RDRRMC recommends within twenty-four (24) hours (IRR Rule III Sec. 2) |
| `report_days` | 45 | Report to OCD within forty-five (45) days from the lifting (RA 12287 Sec. 8; IRR Rule VI Sec. 1) |

The graduation applies only to the LDRRMF anticipatory action allocation and only to hydrometeorological and geological hazards (`hazards.aa_family`). Drought and other slow-onset hazards follow the NDRRMC operational guidelines, still pending; the platform does not graduate them but still keeps LDRRMF disbursements within the year's AA allocation. Other lawful sources (Special Trust Fund balances, donors, ODA, other LGUs, agency budgets) are recorded but not graduated (IRR Rule V Sec. 1(b) and Sec. 2).

**Lifting** (RA 12287 Sec. 7; IRR Rule II Sec. 6, Rule III Sec. 4). When the forecast hazard occurs the declaration is lifted automatically: the EOC records the occurrence time and its evidence (advisory, incident report, SitRep or damage assessment), the lifting time is the occurrence time, and the 45-day report clock starts from it. When the projected impacts are not met, the Mayor lifts upon the RDRRMC recommendation; both references are recorded.

## 6. Offline behaviour and sync

See ADR-003. In short:

| Works offline | Needs a connection |
|---|---|
| Reading everything already synced | Changing the EOC level |
| Logbook entries and corrections | Approving an SOP version |
| Starting and running protocols | Recording declaration steps and disbursements |
| Barangay figures, SitRep drafts, resource requests | Managing users and roles |
| Assessment answers and evidence notes; evidence files queue for upload | Signing in for the first time |

Conflicts and refusals are listed under Settings → Sync with the server's reason.

A refused evidence or Vault upload keeps the file on the device (1.5.1). The Sync screen holds it with **Retry upload**, **Save a copy** and **Discard** (asked twice). The device copy is deleted only after the server has the file, or when the person discards it. Held files count as unsent, so signing out warns first.

**One stuck item does not hold up the queue (1.7.1).** No connection, an expired token or a rate limit stop sending at once. A server problem with one item (an error page, a timeout) puts that item on a backoff (15 s, doubling, at most 30 minutes) with the server's reason shown on the Sync screen. Items that depend on it wait with it: the same row, rows that refer to it, files under it. Everything else keeps sending, and the latest data is still fetched. Two server problems in one round stop the round. The status band shows "Server problem, N waiting"; **Retry now** and **Sync now** try again at once. Nothing is dropped.

**Shared devices (1.7.1, ADR-014).** Signing out removes this account's data from the device. Another account's unsent changes, held files, refusals and conflicts stay, with the local rows they need, and are sent or shown only when that account signs in again. Each person sees and resolves only their own refusals and conflicts. Sign-out warns only about the signed-in account's own unsent items.

## 7. Security and privacy

- Sign-in uses Supabase Auth. Anyone can create an account (email confirmed); it reads nothing until an administrator grants a role, which is the approval step (ADR-009). The administrator sees the verified email, and grants only to confirmed addresses.
- RLS is enabled on every table. SECURITY DEFINER helpers use a fixed `search_path`. Grants are minimal: the logbook and barangay reports allow insert and select only.
- Record locks:
  - Validated responses, approved SOP versions, approved SitReps, and closed protocol runs with their step snapshots cannot be edited.
  - AA action snapshots and lifted declarations accept report fields only.
  - Evidence cannot be moved to another response.
  - Protocols (1.7, ADR-013): only the CDRRMO Head approves, retires or reopens one; approved text and steps are fixed. A draft runs as a drill, or live when the EOC Manager or Head starts it; each run records whether its protocol was a draft. The IRR checklist templates are the Head's and are never deleted.
  - Library documents (1.7): only the Head marks a document approved or changes its approved text (the guard now runs as the caller; it had never fired).
  - PDRAs (1.7): fixed once a declaration that cites them leaves draft; the time a PDRA was held is the server's unless the device time is within the last 24 hours.
  - No deletes (1.7): DELETE is revoked on PDRAs, declarations, AA actions, funds and disbursements, the AA rules and checklist, protocol templates and runs, activations, incidents, SitReps, resource requests, the logbook, barangay reports, the Vault and the audit log. TRUNCATE is revoked everywhere. The logbook and barangay reports are insert-only.
  - Resource requests (1.5.1): the request itself (party, item, quantity, unit, priority, needed by) can be corrected only while it is still requested. After approval only fulfilment fields change: the assigned resource until mobilisation, the note until delivery. Rejected and demobilised requests are closed. Lifecycle times, the request time and the creator are the server's. Requests are never deleted.
- Evidence files sit in a private bucket. They are opened from the device copy when there is one, otherwise through a five-minute signed URL.
- Personal data is limited to staff identity and role. The platform holds no names of affected persons, evacuees, beneficiaries or informants, and screens remind users of this (ADR-002).
- Signing out clears that account's data from the device, also offline; another account's unsent changes and held files stay for that account (ADR-014). Queued changes, refusals and conflicts carry the account that made them and are sent or resolved only under that account; a different account signing in removes the previous account's synced copy first.
- Crash reports (1.8.0): a screen that crashes shows a recovery screen and sends the app version, screen path and error to `client_errors` in the City's own project (no third-party service, no CSP change). Email addresses and long numbers are blanked out first; no form contents are sent. Administrator only; kept 90 days.
- Who-did-what columns (created by, prepared by, validated by, done by) are set by the server, never by the client. Legal clocks for declarations use server time (a device time is accepted only within the last 24 hours).

## 8. Traceability to the master requirements

The platform provides **the means** for each requirement. The Manual of Operations content, validated by the City, provides **the substance**.

| MR | Requirement | Platform support |
|---|---|---|
| MR-01 | Validated, actionable MOO | Library with versioning and Head approval; protocols turn sections into checklists; usage evidence from runs |
| MR-02 | Mandate, organisation, authority, roles | Role model mirrors authority; Chapter 1 and Area 1; IAT Domain A1 |
| MR-03 | Risk intelligence and risk-informed planning | IAT indicators and evidence; hazard list; Chapter 3 SOPs 3-1 to 3-9 as workflows WF-SOP3-01 to 09 with Forms 3-01 to 3-11 (ADR-019); Geo-COP map layers with validation status (ADR-015) |
| MR-04 | Preparedness, contingency planning, drills | IAT; any protocol can be run as a drill (recorded as such, with step times and notes as evidence for the "tested" level) |
| MR-05 | EOC activation, ICS interface, escalation, anticipatory action | EOC level board, activation protocol, PDRA, declaration timeline, AA checklist |
| MR-06 | Monitoring, warning, dissemination, public information | Warning dissemination and flash-flood protocols; logbook categories "warning" |
| MR-07 | Situational awareness, SitReps, reporting | SitReps with numbering and approval; barangay status; logbook; realtime board; EOC location with KML placemark (ADR-015) |
| MR-08 | Resources, logistics, mutual aid | Resource request flow (requested → approved → mobilised → delivered → demobilised). The `resources` inventory table exists; its screen is a later addition |
| MR-09 | Responder safety and welfare, inclusion | IAT indicators and MOO sections; duty handover protocol. No roster or fatigue module (future) |
| MR-10 | Digital continuity, alternate EOC, protected data | Offline-first PWA; EOC location card that flags the alternate EOC as not yet recorded; City-owned hosting; backups of the database and the file buckets with a quarterly restore test (`docs/runbook-backup-restore.md`); crash screen and error reports; uptime check; portable to self-hosting; audit log |
| MR-11 | Recovery, learning, AARs, reassessment | Annual IAT cycles compared over time; action plan tracking; lifting and report protocol |
| MR-12 | Evidence standard | Evidence gate enforced in SQL; evidence kinds and strengths; Document Vault register for Document Review |
| MR-13 | Scoring and priority engine | SQL views; TypeScript mirror with parity test (ADR-005) |
| MR-14 | Traceability | `v_traceability`; indicator ↔ MR ↔ manual section screens; vault document ↔ indicator links; reference notes on every citation |
| MR-15 | Governance, privacy, annual reuse | RLS, audit log, privacy notice, versioned cycles |
| MR-16 | RA 12287 and IRR | `aa_rules`, declaration guard, tranche guard, deadlines, 29-item checklist derived from IRR Rule IV |
| MR-17 | Part C interface indicators | Lead-office answering; Interface Index kept apart from the IMI |
| MR-18 | UNDRR Scorecard alignment | Framework crosswalk screen |

## 9. Quality checks

| Suite | What it proves | Command |
|---|---|---|
| SQL rules and security (250 checks) | Every rule and RLS policy, run as each role on Postgres 16 with Supabase's default grants | `scripts/db_test.sh` |
| Unit (149) | Scoring, AA rules, EOC event windows and barangay counts, sync backoff and shared-device sign-out, ids, coordinates and the EOC placemark (record = KML), sync engine with a fake client, CSV import, citation parsing against every reference in the data; TS = SQL scoring parity | `npm test` |
| Integration (8) | Real supabase-js → PostgREST 12 → Postgres: evidence gate, conflict, RLS refusal, offline protocol ids, logbook replay, AA checklist ids, viewer pull, vault sync and access, repeated edits, keyset paging past 1,000 rows, a pending account reads nothing | `npm run test:it` |
| End-to-end (Playwright, phone and desktop) | Against real migrations and RLS through PostgREST: sign-in, wrong-password answers, sign-out; main journeys (sign-up, email confirmation and password reset are written but marked `fixme`: the local gateway has no sign-up or email stand-in); offline open and logbook save; dark mode contrast; vault journey; reference notes; tooltip on every control of 21 screens, hover, keyboard and long press | `npm run test:e2e` |
| Accessibility (axe, WCAG 2.1 AA) | No serious or critical violations on every main screen | part of `npm run test:e2e` |

The integration suite found two defects that the fake client could not show, and both are fixed. First, version conflicts used SQLSTATE 40001, which PostgREST retries forever. Second, append-only rows were sent with a `version` column that does not exist.

## 10. Open items

- **Reference notes.** The plain-language notes in `src/data/references.ts` are for orientation. They need validation by the CDRRMO with the City Legal Office. Citations inside manual section text (the "Basis" lines) are not yet tappable.

- **Barangay list.** Ormoc’s 85 barangays (PSA PSGC as of 31 July 2025; City PSGC 0803738000) need importing from the PSA masterlist (Settings → Barangays → Import CSV) before operations use.
- **Protocol and workflow validation.** The 28 templates and 50 forms are drafts. Each needs validation by the CDRRMO and its process owner (ADR-019), then approval by the Head (DRRM module).
- **Pending national guidance.** NDRRMC guidelines on anticipatory action triggers and DBM–COA rules on AA fund use and liquidation are expected under the IRR. Update `aa_rules` and the AA checklist when they are issued.
- **Manual content.** Chapters 1 to 8 are drafted and await validation (1–4 Dec workshop): the Introduction (v1.1, the drafting team’s official draft: assessment-informed method stated once, §5 the 2026 baseline and systems diagnosis, §7 systems thinking/TQM; front matter, code `Introduction`), Chapters 1 and 2 (v1.2), Chapter 3 (v1.1, Contingency Planning Guidebook applied), Chapter 4 (v1.1, Early Warning, EOC Activation, Incident Management and Emergency Response), Chapter 5 (v1.0, Recovery, Rehabilitation and Build Back Better; area 10), Chapter 6 (v1.1, DRRM Financing, Resource Management and Accountability; area 1, also 7 — renumbered from the working Chapter 5 financing draft by ADR-032), Chapter 7 (v1.0, Monitoring, Evaluation, Knowledge Management and Continuous Improvement; area 10, also 3) and Chapter 8 (v1.0, Stakeholder Engagement and Institutional Partnerships; area 1, also 3 and 7), each with its annexes and proposed SOP templates in the registry. Chapter 3 still needs the CDRA's adopted hazard tables (the PDF holds an unadopted reconstruction). Chapters 9 and 10 are not yet drafted; SOP 6-GIS-01 sits under Area 6 as a proposal until EOC Chapter 6. The ten area outlines list the requirements still to be written up. The Introduction states the assessment method once (140 indicators / 22 domains, M vs GP, evidence-gated 0–4 scoring with the interviews-only cap at 2, maturity indices and the action plan) so no chapter repeats it; the target structure is the ten-chapter roadmap in its §4 (ADR-031, ADR-032).
- **Area 8 has no indicators.** No indicator in the Traceability Dictionary v1.1 names Area 8 (Responder Safety, Welfare and Inclusive Emergency Operations) as its primary area. A2.7, B4.6 and A7.6 are candidates. A dictionary revision decides; the platform follows it on the next seed.
- **Annex 1-C alert levels.** The draft EO uses Levels 0–3; the National Disaster Response Plan, the RDRRMC VIII SOP (Res. No. 12-006, s. 2023), SOP GOV-05 and the EOC board use White, Blue and Red. NDRRMC Memorandum No. 131, s. 2018 does not fix colours: it lets each EOC set its own codes (para. 9.2.2) and governs activation triggers and EOC functions. Settle one scheme or a crosswalk before the workshop.
- **EOC location.** The primary EOC position comes from a Google Earth placemark (6 Nov 2026) and shows as "To be confirmed" until the CDRRMO checks it. The alternate EOC is not yet recorded (EOC Capability Checklist; MR-10). Both are edits to `src/data/eoc-site.ts` plus a KML in `public/eoc-site/` (ADR-015).
- **Possible later modules.** Responder roster and fatigue tracking (MR-09), and a risk-map layer (MR-03).

## Hazard maps and QGIS-style tools (1.14, ADR-028)

`src/features/eoc/map/`: `HazardMapPage.tsx` (Assess → Hazard maps since 1.16; `/eoc/hazard-maps` redirects), `hazardMaps.ts` (catalogue of fitted sheets:
corners, source, custodian, fit error, legend), `themes.ts` (DDRiVE barangay colouring and exposure summary),
`geodesy.ts` (geodesic distance and area, UTM 51N, sheet pixel mapping), `identify.ts` (class from a sheet's pixel
colour), `places.ts` (nearest EOC places; the GeoAnalyticsPH address, embedded per the ADR-011 amendment), `base.ts` (basemap set-up
shared with the Geo-COP map). Files: `public/geo/hazard/*.webp`, `public/geo/ormoc-barangays.geojson` (OCHA COD-AB,
PSGC-keyed), cached by the service worker on first use. Sheets are pictures: identify answers "about" a class, and
every export carries the source and fit error.

## Status colour code (1.14)

`src/components/StatusBadge.tsx` is the one place that maps approval status to colour for Manual text, workflows,
protocols and forms: Draft = warn (ochre), For validation (`in_review`) = info (blue), Approved = ok (green),
Returned = bad, Superseded and Retired = neutral. `StatusLegend` shows the key once per list.

## ECHO: Evacuation and Camp Handling Operations (1.16, ADR-030)

`src/domain/echo.ts` holds every benchmark with its own source (Sphere 2018, JMC No. 02 s. 2021, RA 12076 Sec. 4,
NDRRMC DPMS Vol. 2) and the arithmetic (water, space, toilets, movement, totals, alerts); none is merged with another.
`src/features/tools/echo/`: `EchoSimulator.tsx` (eight modules; exercise in `localStorage` via `tools/storage.ts`, JSON
export and import, including the standalone prototype's file), `EchoReport.tsx` (print), `EchoIntel.tsx` (map, lazy),
`screening.ts` (severity from legend wording, route sampling about every 50 m), `EchoCamps.tsx` (inventory, camp
reports, feedback), `EchoDashboard.tsx` (EOC picture, SitRep draft, resource request). Migration
`20261112002800_echo_camp_management.sql`: `evacuation_centers` extended (verification is about the record, never a
safety certificate), `camp_reports` append-only with group-size checks and an authority reference for opening and
closure (EOC Manager or Head, inserted online through `insertOnline`), `camp_feedback` with fixed summaries.

## RACI board (1.19, ADR-033)

`raci_matrices` / `raci_activities` / `raci_assignments` (migration `20261113002900_raci_board.sql`) store the
Manual's RACI matrices verbatim (qualifiers and footnote caveats included): Annex 1-F matrices 6.1–6.5, the
chapter matrices of Chapters 1–10, plus the `DOC` matrix for the manual
review cycle, which mirrors the enforced draft → in_review → approved guards rather than creating a parallel
permission system. One Accountable per activity is the Manual's "normally", so the board warns instead of
constraining; the seeded zero- and multi-Accountable rows warn by design, faithful to the draft matrices. Actors are positions, offices and bodies, never personal
names (RA 10173). `src/features/raci/raci.ts` assembles and searches the board from Dexie (display logic only);
`actions.ts` sends the CDRRMO Head's add/edit/remove online (ADR-006), with PT409 handling. The board links to
protocols (`raci_activities.template_id`) and is linked back from the protocol SOP-control tab, the Library
document page and the Today dashboard card. Seed: `scripts/raci_seed.py` → `supabase/seed/parts/37_raci.sql`
(deterministic uuid5 ids; re-runs upsert the same rows).

## EOC capability assessment (1.20, ADR-035)

`eoc_assessment_items` / `eoc_assessment_runs` / `eoc_assessment_responses` (migration
`20261114003000_eoc_assessment.sql`) store the 154-item EOC Capability Assessment Checklist
(OCD/NDRRMC TWG Dec 2017, FEMA-derived) and the accomplished baseline: each item maps to the IAT v1-7
B_EOC indicators (`iat_links`), and its status derives from the weakest mapped indicator score —
the rule lives in SQL (`app.eoc_assessment_status`), is mirrored in `src/domain/eoc_assessment.ts`
and locked by a parity test (ADR-005). Runs are drafts until the CDRRMO Head validates them; the
guard `app.guard_eoc_assessment` stamps and locks validated runs and their responses (approved
records are immutable), refuses non-team writes in plain words (42501), and refuses deletes —
responses are corrected, never removed. `tool_links` is a JSON array of `{code,title}` display
links to the SOP, Protocol, Workflow or Form that closes the gap (controlled vocabulary), like the
RACI template links. The board (`src/features/eoc-assessment/`) reads from Dexie (ADR-003); edits
and validation go online only through `updateOnline` with PT409 conflict handling (ADR-006). The
module links out to DDRiVE for risk and never re-scores. Seed: `scripts/eoc_assessment_seed.py` →
`supabase/seed/parts/38_eoc_assessment.sql` (reads the accomplished workbook at generation time
only; deterministic uuid5 ids; insert-only; the one baseline run `IAT v1-7 (Oct 2026)` stays a draft).
