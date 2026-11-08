# MODE: Ormoc City DRRMO & EOC Manual of Operations Development Platform

**MODE** stands for *Manual of Operations for the DRRMO and EOC*. Version **1.10.0** (8 November 2026).

MODE is a mobile-first, offline-capable web app (PWA) for the City Disaster Risk Reduction and Management Office (CDRRMO) and the Emergency Operations Center (EOC) of the City Government of Ormoc. It supports the single Manual of Operations for the CDRRMO and the EOC: five Parts, ten functional areas (ADR-012).

The approved Manual and the City's issuances remain the legal documents. MODE holds their current text, their version history, the procedures that put them into practice, and the evidence that they are used.

## Modules

- **Assessment** (`/assess`). Runs the Institutional Assessment Tool (IAT) v1.1: 140 indicators in 22 domains.
  - Part A, CDRRMO (82 indicators, domains A1–A10) and Part B, EOC (43, B1–B7) make up the **Institutional Maturity Index (IMI)**: 125 indicators, 79 Mandatory and 46 Good Practice.
  - Part C, Interface (15, C1–C5) covers city systems owned by other offices (CPDO, City Engineer, utility providers, CENRO, City Health Office, DepEd, City Agriculture and Veterinary Offices, DTI and the Chamber of Commerce). It gives a separate **Interface Index** and is never added to the IMI.
  - Each indicator is scored 0–4 or NA. Scoring is gated by evidence: an interview or FGD alone caps a score at 2; a 3 needs an approved document and proof of use; a 4 needs a test, exercise or after-action review showing improvement.
  - Results are shown by domain and maturity band, with mandatory compliance and a gap priority score. Gaps feed a prioritised action plan. The rules are listed under [Scoring rules](#scoring-rules).
- **Library** (`/library`). Holds the Manual of Operations by Part and functional area: area outlines, drafted chapters and their annexes, SOPs and forms, with version control and approval by the CDRRMO Head. Old chapter codes (MOO Ch.4, EOC Ch.2) still find their new home. Each section traces to the IAT indicators and the master requirements MR-01 to MR-18, and to the UNDRR Scorecard and RA 12287 IRR crosswalk. Chapters 1 and 2 (v1.2) and Chapter 3 (v1.0) are loaded as working drafts.
- **DRRM: workflows, protocols and forms** (`/drrm`). Turns the Manual's SOPs into steps the CDRRMO can run, live or as drills, with an audit trail. Every step closes on a form.
  - An **SOP** is the controlled Manual text.
  - A **protocol** is a point-of-action checklist for an event or duty shift.
  - A **workflow** is a multi-office management cycle.
  - Every template names its controlling SOP, process owner, policy basis and IAT indicators (ADR-019).
  - 23 templates (8 protocols, 15 workflows, 161 steps, 40 forms) are drafted for validation, including the nine Chapter 3 risk-information and planning workflows (WF-SOP3-01 to 09, Forms 3-01 to 3-11).
- **EOC** (`/eoc`). White / Blue / Red alert level, an append-only logbook, SitReps, barangay status (counts only), resource requests, EOC positions and three-deep designations, contingency plans that activate response clusters, barangay clusters, and the Geo-COP map with the EOC's location and a KML placemark.
- **Anticipatory action** (RA 12287 and its IRR). Records the PDRA and the declaration timeline with its legal deadlines. It holds the 29-item IRR checklist and enforces the fund cap (up to 10% of the 70% LDRRMF component) and the 30% / 70% tranche limits.
- **Tools** (`/tools`). Readiness tools and hazard information in one place:
  - an ICS exercise simulator (individual drills, facilitated tabletops and position drills on six Ormoc scenarios, scored against Philippine ICS doctrine, with a printable after-action review);
  - a Public Service Continuity Plan workbench (essential functions and business impact analysis, risks, alternate sites, succession, vital records, activation, printable plan);
  - a Gawad KALASAG Seal readiness self-check (six criteria rated 0 to 3, weighted mean and rating, suggestions from the IAT);
  - links to HazardHunterPH, GeoAnalyticsPH, Zoom Earth (centred on Ormoc) and DDRiVE-M. They open outside the app and are never embedded.
- **Document Vault** (`/vault`). One register of the laws, guidelines, City issuances, plans and records gathered for Document Review. Each document is linked to the indicators it evidences. The vault includes a Document Review checklist and a catalogue of the cited references, each explained in plain language. Restricted entries are visible only to the CDRRMO Head, assessors and validators.

Public pages (`/`, `/about`, `/faq`, `/support` and `/policies/privacy`, `terms`, `accessibility`, `cookies`) open without an account; the workspace starts at `/today` (ADR-020). Every button, tab, card, link and field has a tooltip. Every cited law or guideline (for example "RA 10121 Sec. 21") opens a short note when tapped.

It works with no signal. Entries are saved on the device and sent when a connection returns. Actions that carry legal authority (EOC level changes, approvals, declaration steps, disbursements, role grants) need a live connection and are never queued (ADR-006).

## Standards and policy basis

Each rule in the platform cites its source in the code, in an ADR and in the in-app reference catalogue (`src/data/references.ts`). The official text always governs. Readings of scanned legal texts are provisional until checked against certified copies with the City Legal Office and OCD Region VIII.

| Level | Instrument | What it drives in MODE |
|---|---|---|
| International | Sendai Framework for DRR 2015–2030 | Good-practice benchmark; targets A–G in the M&E layer of the City DRRM Plan |
| International | UNDRR Disaster Resilience Scorecard for Cities, Detailed Level (2017); Ten Essentials | 11 Good Practice indicators and the Part C interface indicators; the framework crosswalk (MR-18) |
| International | ISO 22301 terms (MTPD, RTO, RPO) | PSCP workbench |
| National | RA 10121 and IRR | CDRRMC and CDRRMO mandate, LDRRMF, roles; Part A domains |
| National | RA 12287 (State of Imminent Disaster) and IRR, signed 14 Sep 2026 | PDRA → declaration → Mayor's EO; AA fund cap and tranches; lifting and the 45-day report; 29 checklist actions (MR-16) |
| National | NDRRMC Memorandum No. 131, s. 2018 (EOC guidelines) | EOC establishment, alert levels, activation and deactivation; Part B domains |
| National | NDRRMC MC No. 4, s. 2012 (ICS); NDCC MC No. 12, s. 2008 (cluster approach) | ICS simulator, EOC positions, response clusters |
| National | NDRRMC–DILG–DBM–CSC JMC No. 2014-1; JMC No. 2013-1; COA Circular No. 2012-002 | CDRRMO structure and plantilla; LDRRMF use and reporting |
| National | NDRRMC Memorandum Circular No. 147, s. 2017 | LDRRMP review: AIP consistency with DRRM-CCA PAPs and judicious LDRRMF use |
| National | DSWD–DILG–DOH–DepEd JMC No. 02, s. 2021 | Camp coordination and camp management and IDP protection |
| National | RA 10821 (Children's Emergency Relief and Protection) | Child protection and limits on schools as evacuation centres |
| National | RA 10173 (Data Privacy Act) | No names of affected persons, evacuees or informants; aggregate counts only (MR-15) |
| National | NDRRMP 2020–2030; NDRRMC Disaster Preparedness Minimum Standards Vol. 2; Disaster Rehabilitation and Recovery Planning Guide; Supplemental Guidelines on Mainstreaming CC and DRR in the CLUP | Preparedness, recovery and risk-informed planning standards (Parts A and C) |
| National | NDRRMC–OCD PSCP Guidebook | PSCP workbench and continuity indicators |
| National | Gawad KALASAG Seal CY 2026 (OCD Memorandum No. 763, s. 2026, under NDRRMC MC No. 3, s. 2025) | GK readiness self-check |
| Regional | DILG VIII Harmonized Disaster Response Reporting Template and SOP | SitRep fields, report types and cut-off times |
| Local | Ormoc City DRRM 10-Year Plan 2023–2032; CDP 2024–2030, CLUP, LCCAP and CDRA; City EOs and SP and CDRRMC resolutions | Local hazards, priorities and the Vault register |
| Local | City Ordinance No. 052, s. 2021 (ratified 8 Oct 2022) | 85 barangays (PSA PSGC since 4Q 2022) |

The full list, with status notes, is on the `References` sheet of the IAT workbook and in the Vault.

## Assessment baseline

The **2026 Baseline (IAT v1.1)** cycle holds provisional scores from the October 2026 FGD, key-informant interviews, site visits and the desk reviews of 30 October and 6 November 2026. IAT workbook v1-6 shows:

| Result | Value |
|---|---|
| Institutional Maturity Index (Parts A + B, 125 indicators) | 2.13 / 4.00, Developing |
| Part A, CDRRMO | 2.29, Developing |
| Part B, EOC | 1.85, Developing |
| Mandatory compliance (A + B) | 41.8% |
| High-priority gaps (A + B) | 29 |
| Interface Index (Part C, separate) | 1.41 / 4.00, Initial |
| Evidence validation status | 140 of 140 pending validation |

The scores are provisional until the validation workshop (1–4 December 2026). The Assess module shows the live result, which is the one to quote.

## Scoring rules

The rules live in SQL; the TypeScript in `src/domain/scoring.ts` mirrors them under a parity test (ADR-005).

| Metric | Rule |
|---|---|
| Domain, Part and IMI | sum(score × weight) / sum(weights) over scored indicators. NA and blanks are left out |
| Maturity band | below 0.5 Absent; 0.5–1.49 Initial; 1.5–2.49 Developing; 2.5–3.49 Compliant; 3.5 and above Advanced |
| Mandatory compliance | Mandatory indicators scored 3 or 4 ÷ scored Mandatory indicators. A domain is compliant only at 100% |
| Gap priority score | (4 − score) × weight × 1.5 for Mandatory; × 1.0 for Good Practice and all Part C indicators |
| Priority band | High 9 or more; Medium 4–8.9; Low below 4 |
| Weights | 3 = life-safety or legal compliance; 2 = effectiveness; 1 = supportive |

## Master requirements

Every feature and Manual section traces to at least one master requirement in the traceability workbook (v1.1).

| ID | Requirement | Priority |
|---|---|---|
| MR-01 | One integrated, evidence-based Manual (all 140 indicators) | Critical |
| MR-02 | Governance, organisation and institutional arrangements (FA 1) | High |
| MR-03 | Risk intelligence, prevention and mitigation (FA 2) | High |
| MR-04 | Preparedness, planning and capacity development (FA 3) | High |
| MR-05 | EOC activation, incident management and coordination (FA 4) | Critical |
| MR-06 | Early warning, emergency communications and public information (FA 5) | Critical |
| MR-07 | Situational awareness, information management and reporting (FA 6) | High |
| MR-08 | Resource, logistics and emergency support (FA 7) | High |
| MR-09 | Responder safety, welfare and inclusion (FA 8) | Critical |
| MR-10 | Digital continuity, cybersecurity and alternate EOC (FA 9) | Critical |
| MR-11 | Recovery, learning and continuous improvement (FA 10) | High |
| MR-12 | Evidence standard: every score traceable to evidence | Critical |
| MR-13 | Scoring and priority engine; IMI and Interface Index kept apart | Critical |
| MR-14 | Indicator → gap → action → Manual traceability | Critical |
| MR-15 | Governance, privacy and annual reuse | Critical |
| MR-16 | RA 12287 and IRR readiness (anticipatory action) | Critical |
| MR-17 | Part C interface indicators by lead office | High |
| MR-18 | UNDRR Scorecard alignment | Medium |

## Accounts

Anyone can create an account with an email address and a password. The account sees nothing until a system administrator approves it by granting a role (Settings → Users and roles). Invited staff, sign-in links by email and password reset all work too. See [ADR-009](docs/adr/009-open-signup-and-live-data.md).

Ten roles are enforced in the database, not only in the screens: `cdrrmo_head`, `eoc_manager`, `eoc_staff`, `duty_officer`, `assessor`, `validator`, `lead_office_focal`, `author`, `viewer` and `admin` (ADR-004, ADR-013). Only the CDRRMO Head approves, retires or reopens Manual versions and protocols.

Other City systems can offer **Sign in with MODE**: the platform is the consent screen for the project's OAuth 2.1 / OpenID Connect server (`/oauth/consent`). An app reads nothing until the City approves it, and tokens issued to other apps are read-only in the database. People see and withdraw the apps they allowed under Settings → Connected apps. See [ADR-010](docs/adr/010-oauth-provider-read-only-clients.md), [ADR-018](docs/adr/018-connected-app-approval.md) and DEPLOY.md section 2a.

## Run it

The app always works against a Supabase project; there is no demo mode. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY` on older projects), then:

```bash
npm ci
npm run dev        # http://localhost:5173
```

Optional public-page settings (`VITE_SITE_URL`, `VITE_SUPPORT_EMAIL`, `VITE_DPO_EMAIL`, `VITE_BUSINESS_ADDRESS`, `VITE_NPC_REGISTRATION`, `VITE_POLICY_EFFECTIVE`, `VITE_POLICY_OWNER`) are described in DEPLOY.md, "To 1.10.0". None is secret.

For training and validation workshops, use a separate training Supabase project with test accounts, never the production one. A production build without valid settings stops with a message. See [DEPLOY.md](DEPLOY.md) for creating the City-owned project, applying the database, opening sign-up and publishing the app.

## Project layout

```
src/
  components/     shared UI primitives, app shell, sheet, toast, tooltip, RefText
  domain/         rules mirrored from SQL: scoring, anticipatory action, EOC, protocols, forms, structure, KML
  features/       screens per module (public, auth, home, iat, library, protocols = DRRM module, eoc, eoc/aa, vault, tools, settings)
  lib/            local database, outbox store, sync engine, auth, OAuth, time (Asia/Manila), ids
  data/           reference.json (generated) and the citation catalogue
  styles/         design tokens and base CSS
supabase/
  migrations/     schema, RLS, triggers, RPCs, views (apply in order); migration_status.sql checks them
  seed/seed.sql   reference data generated from the IAT and Traceability workbooks (for psql)
  seed/parts/     the same data in 19 parts small enough for the Supabase SQL editor
  seed/operational/ one-time working records: the 2026 IAT baseline, the Vault register, the EOC structure
  admin/          time-boxed developer access script
  email/          Supabase Auth email templates
  tests/          SQL rule and security suite (plus a local-only Supabase stub)
scripts/          seed generators, SOP registry, manual splitter, basemap builder, test runners
reference/        source workbooks and legal PDFs; reference/moo/ holds manual drafts loaded into the Library
tests/integration supabase-js → PostgREST → Postgres tests
e2e/              Playwright journeys, accounts, public pages, accessibility (axe), tooltips, Vault and offline tests
docs/             system design, design system, public pages, architecture decision records
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the build on port 4173 |
| `npm test` | Unit tests (203), including the scoring parity test against SQL |
| `npm run test:db` | Rebuild a local Postgres database from the migrations and run the 260 rule and security checks. Needs `PGHOST`, `PGPORT` and `PGUSER` for a local superuser |
| `npm run test:it` | Integration tests through real PostgREST. Needs the same plus `POSTGREST_BIN` (PostgREST 12) |
| `npm run test:e2e` | Playwright on phone and desktop sizes against the production build, PostgREST and a fresh local database with every migration: sign-up and approval, journeys, public pages, axe and offline checks. Needs the same as `test:it` |
| `python3 scripts/brand_assets.py` | Rebuild the circular seals, banner copies and app icons from the originals in `public/` |
| `npm run seed:generate` | Regenerate `supabase/seed/seed.sql`, `supabase/seed/parts/` and `src/data/reference.json` from `reference/*.xlsx` and the manual drafts in `reference/moo/` |
| `python3 scripts/split_manual_docx.py <chapter.docx> --slug chN --prefix MOO_ChN` | Turn a drafted chapter into Library sources in `reference/moo/` and compressed figures in `public/library/<slug>/`. Use a new `--prefix` for each version (the script replaces that prefix's annexes). Then add the chapter to `CHAPTERS` and `LIBRARY_DRAFTS` in `generate_seed.py`, and its SOPs to `scripts/sop_registry.py` |
| `npm run seed:operational` | Regenerate the one-time `supabase/seed/operational/` files (IAT baseline, Document Vault register) from the IAT workbook |
| `bash scripts/build_basemap.sh` | Extract the Ormoc basemap and upload it to the `basemap` bucket (needs `SUPABASE_URL` and `SERVICE_ROLE_KEY`; run on a City workstation) |
| `npm run check` | Typecheck, unit tests and build |

## Changing reference data

The generator reads two workbooks in `reference/`:

- `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v*.xlsx`: sheets `A_CDRRMO`, `B_EOC`, `C_Interface` and `Crosswalk`. Exactly one IAT workbook may be in the folder; the generator stops if it finds none or two.
- `Ormoc_CDRRMO_EOC_Master_Requirements_Traceability_and_140_Indicator_Data_Dictionary_v1.1.xlsx`: sheets `Master_Requirements`, `Domain_Traceability` and `Indicator_Data_Dictionary`. Keep the corrected copy, which reads 85 barangays in A3.7, A7.3 and B3.2. Older copies still say 110.

When the IAT or the traceability matrix changes:

1. Replace the workbook in `reference/` (delete the old IAT version).
2. Run `npm run seed:generate`.
3. Run `npm run test:db` and `npm test`. The parity test confirms that the TypeScript and SQL scoring still agree.
4. Raise `REFERENCE_VERSION` in `src/lib/bootstrap.ts` so devices reload the bundled copy.

Never copy scores, priorities, owners, target dates or action-plan statuses into the Manual or the code by hand. Take them from the current workbook or the Assess module, and say which version they came from.

## Repository status (8 November 2026)

`package.json` says 1.10.0 and the unit tests pass (203 of 203). Four parts of the 1.10.0 release are not yet on `main`:

- [ ] **Apply `DELETE.txt`.** The unused shadcn kit (`src/components/ui/`, `src/components/theme-provider.tsx`) is still present, so `npm run typecheck` reports 140 errors and `npm run build` stops. `public/library/chp2v12/` must also be renamed to `public/library/ch2v12/`: Chapter 2 v1.2 links to the second name, so its 25 figures do not load until then.
- [ ] **Add IAT workbook v1-6** to `reference/`. No IAT workbook is there, so `npm run seed:generate` stops.
- [ ] **Add `.github/workflows/ci.yml` and `uptime.yml`** with `git push`. The GitHub upload page drops the `.github/` folder.
- [ ] **Add `docs/runbook-backup-restore.md`**, which DEPLOY.md section 11 cites.

The City actions from the release notes still stand: approve the policies, confirm the support and DPO mailboxes, settle the HR-05 and HR-06 owners, name the continuity executive, re-add `Ormoc_CDRRMO_Logo.png` (truncated at 2 MiB) and run `build_basemap.sh`.

## Documents

- [System design](docs/system-design.md): modules, data model, offline sync, security, traceability to MR-01 to MR-18, open items
- [Design system](docs/design-system.md): tokens, type, primitives, the status band, writing rules
- [Public pages, accessibility and PWA](docs/public-pages-accessibility-pwa.md)
- [Architecture decision records](docs/adr/README.md) (ADR-001 to ADR-020)
- [Deployment and handover](DEPLOY.md)
- [Security policy and vulnerability reporting](SECURITY.md)
- [Release notes for 1.10.0](release_1.10.0_2026-11-08.md)

## Ownership

The City Government of Ormoc owns this code and its data. It was prepared under the Manual of Operations for the CDRRMO and EOC engagement by Alvin M. Silva (Cognitio Plus).
