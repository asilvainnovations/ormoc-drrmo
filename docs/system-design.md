# System design: Ormoc DRRM Operations Platform

Version 1.0 · 15 October 2026 · Prepared for the City Government of Ormoc (CDRRMO) by Alvin M. Silva

## 1. Purpose

The platform supports the two outputs of the engagement: the CDRRMO Manual of Operations (MOO) and the Emergency Operations Center (EOC) Manual. It does four jobs:

1. **Assess** the office and the EOC with the Institutional Assessment Tool (IAT) v1.1. That means 140 indicators, evidence-gated scoring and a prioritised action plan.
2. **Write and trace** the manuals. Every section links to the indicators and master requirements (MR-01 to MR-18) it answers.
3. **Run** the manuals as protocols: step-by-step checklists with owners, timings and an audit trail.
4. **Operate** the EOC and the anticipatory-action process under RA 12287 and its IRR (14 Sep 2026). This covers the alert level, logbook, SitReps, barangay status, resource requests, PDRA, declarations, the AA checklist and fund tranches.

The platform supports the manuals but is not the manual. The approved MOO and EOC Manual remain the legal documents. The platform holds their current text, their version history and the evidence that they are used.

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
 │ Supabase (City-owned project, ap-southeast-1 Singapore)    │
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
| Today | `/` | — | Greeting, active declaration with next deadline, quick actions by role, running protocols, latest log, assessment progress |
| Assessment | `/assess` | `assessment_cycles`, `responses`, `evidence`, `actions` | Evidence first, then score; caps by evidence strength; validator workflow; domain and maturity readouts; CSV export; action plan by priority |
| Library | `/library` | `moo_documents`, `moo_versions`, `moo_document_indicators` | 19 manual sections (MOO and EOC Manual) as Markdown; draft → for review → approved (Head only), approved versions immutable; traceability, master requirements, framework crosswalk |
| Protocols | `/protocols` | `protocol_templates`, `protocol_steps`, `protocol_runs`, `protocol_run_steps` | 10 draft protocols (66 steps) for CDRRMO validation; runs work offline; critical steps and required notes block completion |
| EOC | `/eoc` | `eoc_activations`, `logbook_entries`, `sitreps`, `barangay_reports`, `resource_requests` | Level board (White / Blue / Red), append-only logbook with corrections, SitRep numbering on submit, barangay counts only, forward-only request flow |
| Anticipatory action | `/eoc/aa` | `pdra_sessions`, `declarations`, `aa_actions`, `aa_fund_years`, `aa_disbursements`, `aa_rules` | PDRA decision; declaration timeline per IRR; 29 AA checklist templates from IRR Rule IV; fund cap and tranche guard |
| Document Vault | `/vault` | `vault_documents` (+ private `vault` bucket) | Register of laws, guidelines, City issuances, plans and records; each linked to indicators; Document Review checklist with request list download; reference catalogue. Assessors, validators, admin and CDRRMO staff only. Documents are superseded, never deleted |
| Settings | `/settings` | `profiles`, `user_roles`, `barangays` | Sync status and conflict review; users and roles (admin, online); barangay list import (PSGC CSV); about and privacy |

## 5. Data model (summary)

All editable tables have `id uuid`, `version int`, `created_at`, `updated_at`, maintained by `app.touch_row()`. The audit trigger writes every insert, update and delete of institutional records to `audit_log` (who, when, before, after).

**Reference (seeded from the v1.1 workbooks).** These are `iat_parts` (3), `iat_domains` (22), `iat_indicators` (140), `master_requirements` (18), `indicator_requirements` (935 links), `indicator_lead_offices` (Part C), `framework_crosswalk` (71 rows: 57 UNDRR Disaster Resilience Scorecard items, 14 RA 12287 IRR provisions), `offices` (26), `hazards` (10) and `aa_action_templates` (29).

**Assessment.** A cycle has one response per indicator. A response has evidence items (kind and strength) and a history of score changes. Actions are the improvement plan rows generated from gaps. The views `v_response_results`, `v_domain_results` and `v_cycle_results` compute caps, gap priority, maturity, mandatory compliance, the IMI and the Interface Index.

**Anticipatory action parameters** (`aa_rules`; an admin updates them, on the CDRRMO Head's instruction, when national guidance changes. Every change is audited):

| Key | Value | Basis |
|---|---|---|
| `aa_share_of_ldrrmf_70` | 0.10 | AA from ≤ 10% of the 70% LDRRMF |
| `tranche_beyond_max` | 0.30 | ≤ 30% for interventions more than 72 h before impact |
| `tranche_within_max` | 0.70 | ≤ 70% within 72 h |
| `lead_threshold_hours` | 72 | Tranche boundary |
| `min_declaration_lead_hours` | 72 | Declaration needs severe impact and ≥ 72 h lead time; otherwise city early action |
| `rdrrmc_reply_hours` | 24 | RDRRMC recommends within 24 h |
| `report_days` | 45 | Report to OCD within 45 days of lifting |

Tranche limits apply to LDRRMF AA disbursements only. Other fund sources are recorded but exempt.

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

## 7. Security and privacy

- Sign-in uses Supabase Auth. Anyone can create an account (email confirmed); it reads nothing until an administrator grants a role, which is the approval step (ADR-009). The administrator sees the verified email, and grants only to confirmed addresses.
- RLS is enabled on every table. SECURITY DEFINER helpers use a fixed `search_path`. Grants are minimal: the logbook allows insert and select only.
- Record locks:
  - Validated responses, approved SOP versions, approved SitReps, and closed protocol runs with their step snapshots cannot be edited.
  - AA action snapshots and lifted declarations accept report fields only.
  - Evidence cannot be moved to another response.
- Evidence files sit in a private bucket. They are opened from the device copy when there is one, otherwise through a five-minute signed URL.
- Personal data is limited to staff identity and role. The platform holds no names of affected persons, evacuees, beneficiaries or informants, and screens remind users of this (ADR-002).
- Signing out clears the local database on that device, also offline. Queued changes carry the account that made them and are sent only under that account; a different account signing in removes the previous account's synced copy first.
- Who-did-what columns (created by, prepared by, validated by, done by) are set by the server, never by the client. Legal clocks for declarations use server time (a device time is accepted only within the last 24 hours).

## 8. Traceability to the master requirements

The platform provides **the means** for each requirement. The MOO and EOC Manual content, validated by the City, provides **the substance**.

| MR | Requirement | Platform support |
|---|---|---|
| MR-01 | Validated, actionable MOO | Library with versioning and Head approval; protocols turn sections into checklists; usage evidence from runs |
| MR-02 | Mandate, organisation, authority, roles | Role model mirrors authority; MOO Ch. 1 sections; IAT Domain A1 |
| MR-03 | Risk intelligence and risk-informed planning | IAT indicators and evidence; hazard list; MOO sections. No risk-map module (outside scope) |
| MR-04 | Preparedness, contingency planning, drills | IAT; any protocol can be run as a drill (recorded as such, with step times and notes as evidence for the "tested" level) |
| MR-05 | EOC activation, ICS interface, escalation, anticipatory action | EOC level board, activation protocol, PDRA, declaration timeline, AA checklist |
| MR-06 | Monitoring, warning, dissemination, public information | Warning dissemination and flash-flood protocols; logbook categories "warning" |
| MR-07 | Situational awareness, SitReps, reporting | SitReps with numbering and approval; barangay status; logbook; realtime board |
| MR-08 | Resources, logistics, mutual aid | Resource request flow (requested → approved → mobilised → delivered → demobilised). The `resources` inventory table exists; its screen is a later addition |
| MR-09 | Responder safety and welfare, inclusion | IAT indicators and MOO sections; duty handover protocol. No roster or fatigue module (future) |
| MR-10 | Digital continuity, alternate EOC, protected data | Offline-first PWA; City-owned hosting; backups; portable to self-hosting; audit log |
| MR-11 | Recovery, learning, AARs, reassessment | Annual IAT cycles compared over time; action plan tracking; lifting and report protocol |
| MR-12 | Evidence standard | Evidence gate enforced in SQL; evidence kinds and strengths; Document Vault register for Document Review |
| MR-13 | Scoring and priority engine | SQL views; TypeScript mirror with parity test (ADR-005) |
| MR-14 | Traceability | `v_traceability`; indicator ↔ MR ↔ manual section screens; vault document ↔ indicator links; reference notes on every citation |
| MR-15 | Governance, privacy, annual reuse | RLS, audit log, privacy notice, versioned cycles |
| MR-16 | RA 12287 and IRR | `aa_rules`, declaration guard, tranche guard, deadlines, 29 IRR-based actions |
| MR-17 | Part C interface indicators | Lead-office answering; Interface Index kept apart from the IMI |
| MR-18 | UNDRR Scorecard alignment | Framework crosswalk screen |

## 9. Quality checks

| Suite | What it proves | Command |
|---|---|---|
| SQL rules and security (177 checks) | Every rule and RLS policy, run as each role on Postgres 16 | `scripts/db_test.sh` |
| Unit (81) | Scoring, AA rules, ids, sync engine with a fake client, CSV import, citation parsing against every reference in the data; TS = SQL scoring parity | `npm test` |
| Integration (11) | Real supabase-js → PostgREST 12 → Postgres: evidence gate, conflict, RLS refusal, offline protocol ids, logbook replay, AA checklist ids, viewer pull, vault sync and access, repeated edits, keyset paging past 1,000 rows, a pending account reads nothing | `npm run test:it` |
| End-to-end (Playwright, phone and desktop) | Against real migrations and RLS through PostgREST: sign-up, email confirmation, waiting for approval, approval by an administrator, password reset, sign-out; main journeys; offline open and logbook save; dark mode contrast; vault journey; reference notes; tooltip on every control of 21 screens, hover, keyboard and long press | `npm run test:e2e` |
| Accessibility (axe, WCAG 2.1 AA) | No serious or critical violations on every main screen | part of `npm run test:e2e` |

The integration suite found two defects that the fake client could not show, and both are fixed. First, version conflicts used SQLSTATE 40001, which PostgREST retries forever. Second, append-only rows were sent with a `version` column that does not exist.

## 10. Open items

- **Reference notes.** The plain-language notes in `src/data/references.ts` are for orientation. They need validation by the CDRRMO with the City Legal Office. Citations inside manual section text (the "Basis" lines) are not yet tappable.

- **Barangay list.** Ormoc’s 85 barangays (PSA PSGC, 4th quarter 2022 update) need importing from the PSA masterlist (Settings → Barangays → Import CSV) before operations use.
- **Protocol validation.** The 10 protocols are drafts. Each needs validation by the CDRRMO and the owning office, then approval in the Library.
- **Pending national guidance.** NDRRMC guidelines on anticipatory action triggers and DBM–COA rules on AA fund use and liquidation are expected under the IRR. Update `aa_rules` and the AA checklist when they are issued.
- **Manual content.** The 19 manual sections hold skeleton text until the drafting and validation weeks.
- **Possible later modules.** Responder roster and fatigue tracking (MR-09), and a risk-map layer (MR-03).
