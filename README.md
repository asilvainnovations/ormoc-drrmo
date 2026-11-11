# MODE: Ormoc City DRRMO & EOC Manual of Operations Development Platform

**MODE** stands for *Manual of Operations for the DRRMO and EOC*.

A mobile-first, offline-capable web app (PWA) for the City Disaster Risk Reduction and Management Office (CDRRMO) and the Emergency Operations Center (EOC) of the City Government of Ormoc. It supports the single Manual of Operations for the CDRRMO and the EOC (five Parts, ten functional areas; ADR-012). The platform has five modules:

- **Assessment.** Runs the Institutional Assessment Tool v1.1 (140 indicators). Scoring is gated by evidence, results are shown by domain and maturity, and gaps feed a prioritised action plan. The assessment team records whether each indicator's evidence was checked against its source (the workbook v1-6 Evidence Validation Status); the check never changes the score.
- **Library.** Holds the Manual of Operations by Part and functional area: area outlines, drafted chapters and their annexes, SOPs and forms, with version control and approval by the CDRRMO Head. Old chapter codes (MOO Ch.4, EOC Ch.2) still find their new home. Each section traces to the indicators and master requirements MR-01 to MR-18, and to the UNDRR Scorecard and RA 12287 IRR crosswalk.
- **DRRM: workflows, protocols and forms** (`/drrm`). Turns the Manual's SOPs into steps the CDRRMO can run, live or as drills, with an audit trail. Every step closes on a form. An **SOP** is the controlled Manual text. A **protocol** is a point-of-action checklist for an event or duty shift. A **workflow** is a multi-office management cycle. Every template names its controlling SOP, process owner, policy basis and IAT indicators (ADR-019). 28 templates are drafted for validation: 13 protocols and 15 workflows, including the nine Chapter 3 risk-information and planning workflows and the nine Chapter 4 SOPs (early warning, activation, incident coordination, evacuation, resources, SitReps, deactivation).
- **EOC.** Covers the White / Blue / Red alert level, an append-only logbook, SitReps, barangay status (counts only), resource requests, and the EOC's location with map links and a KML placemark.
- **Anticipatory action (RA 12287 and IRR).** Records the PDRA and the declaration timeline with its legal deadlines. It holds the 29-item AA checklist and enforces the fund cap (10% of the 70% LDRRMF) and the 30% / 70% tranche limits.

- **Tools.** Readiness tools and hazard information in one place:
  - an ICS exercise simulator (individual drills, facilitated tabletops and position drills on six Ormoc scenarios, scored against Philippine ICS doctrine, with a printable after-action review);
  - a Public Service Continuity Plan workbench (essential functions and business impact analysis, risks, alternate sites, succession, vital records, activation, printable plan);
  - a Gawad KALASAG Seal readiness self-check (six criteria rated 0 to 3, weighted mean and rating, suggestions from the IAT);
  - links to HazardHunterPH, GeoAnalyticsPH, Zoom Earth (centered on Ormoc) and DDRiVE-M.

- **Document Vault.** One register of the laws, guidelines, City issuances, plans and records gathered for Document Review. Each document is linked to the indicators it evidences. The vault includes a Document Review checklist and a catalogue of the cited references, each explained in plain language. It is open to assessors, validators, administrators and CDRRMO staff.

Public pages (`/`, About, FAQ, Support and the privacy, terms, accessibility and cookie policies) open without an account; the workspace starts at `/today` (ADR-020). Every button, tab, card, link and field has a tooltip. Ctrl+K (⌘K) searches screens, manual sections, procedures and forms, offline too; the appearance follows the device or a chosen Light or Dark theme. The interface uses the in-house primitives and a Radix/shadcn component kit mapped to the City tokens (ADR-023; Settings → Interface components shows each one live). Every cited law or guideline (for example "RA 10121 Sec. 21") opens a short note when tapped.

It works with no signal. Entries are saved on the device and sent when a connection returns.

## Accounts

Anyone can create an account with an email address and a password. The account sees nothing until a system administrator approves it by granting a role (Settings → Users and roles). Invited staff, sign-in links by email and password reset all work too. See [ADR-009](docs/adr/009-open-signup-and-live-data.md).

Other City systems can offer **Sign in with MODE**: the platform is the consent screen for the project's OAuth 2.1 / OpenID Connect server (`/oauth/consent`). People see and withdraw the apps they allowed under Settings → Connected apps. Tokens issued to other apps are read-only in the database. See [ADR-010](docs/adr/010-oauth-provider-read-only-clients.md) and DEPLOY.md section 2a.

## Run it

The app always works against a Supabase project; there is no demo mode. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY` on older projects), then:

```bash
npm ci
npm run dev        # http://localhost:5173
```

For training and validation workshops, use a separate training Supabase project with test accounts, never the production one. A production build without valid settings stops with a message. See [DEPLOY.md](DEPLOY.md) for creating the City-owned project, applying the database, opening sign-up and publishing the app.

## Project layout

```
src/
  components/     shared UI primitives, app shell, sheet, toast
  domain/         rules mirrored from SQL: scoring, anticipatory action, EOC, protocols
  features/       screens per module (public, iat, library, protocols = DRRM module, eoc, eoc/aa, vault, tools, settings, home)
  lib/            local database, outbox store, sync engine, auth, time (Asia/Manila), ids
  styles/         design tokens and base CSS
supabase/
  migrations/     schema, RLS, triggers, RPCs, views (apply in order)
  seed/seed.sql   reference data generated from the IAT v1.1 and Traceability v1.1 workbooks (for psql)
  seed/parts/     the same data in parts small enough for the Supabase SQL editor
  seed/operational/ one-time working records: the October 2026 IAT baseline and the Vault register
  tests/          SQL rule and security suite (plus a local-only Supabase stub)
scripts/          seed generator, test runners
reference/        the source workbooks; reference/moo/ holds manual drafts loaded into the Library
tests/integration supabase-js → PostgREST → Postgres tests
e2e/              Playwright journeys, accessibility (axe) and offline tests
docs/             system design, design system, architecture decision records
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the build on port 4173 |
| `npm test` | Unit tests, including the scoring parity test against SQL |
| `npm run test:db` | Rebuild a local Postgres database from the migrations and run the 284 rule and security checks. Needs `PGHOST`, `PGPORT` and `PGUSER` for a local superuser |
| `npm run test:it` | Integration tests through real PostgREST. Needs the same plus `POSTGREST_BIN` (PostgREST 12) |
| `npm run test:e2e` | Playwright on phone and desktop sizes against the production build, PostgREST and a fresh local database with every migration: sign-up and approval, journeys, axe and offline checks. Needs the same as `test:it` |
| `python3 scripts/brand_assets.py` | Rebuild the circular seals, banner copies and app icons from the originals in `public/` |
| `npm run seed:generate` | Regenerate `supabase/seed/seed.sql`, `supabase/seed/parts/` and `src/data/reference.json` from `reference/*.xlsx` and the manual drafts in `reference/moo/` |
| `python3 scripts/split_manual_docx.py <chapter.docx> --slug chN --prefix MOO_ChN` | Turn a drafted chapter into Library sources in `reference/moo/` and compressed figures in `public/library/chN/` (Chapter 2's figures are in `chp2/`). Use a new `--prefix` for each version (the script replaces that prefix's annexes). Then add the chapter to `CHAPTERS` and `LIBRARY_DRAFTS` in `generate_seed.py`, and its SOPs to `scripts/sop_registry.py` |
| `npm run seed:operational` | Regenerate the one-time `supabase/seed/operational/` files (IAT baseline, Document Vault register) from the IAT workbook |
| `npm run check` | Typecheck, unit tests and build |

## Changing reference data

When the IAT or the traceability matrix changes:

1. Update the workbook in `reference/`.
2. Run `npm run seed:generate`.
3. Run `npm run test:db` and `npm test`. The parity test confirms that the TypeScript and SQL scoring still agree.

Raise `REFERENCE_VERSION` in `src/lib/bootstrap.ts` so devices reload the bundled copy.

## Documents

- [System design](docs/system-design.md): modules, data model, offline sync, security, traceability to MR-01 to MR-18, open items
- [Design system](docs/design-system.md): tokens, type, primitives, the status band, writing rules
- [Architecture decision records](docs/adr/README.md)
- [Deployment and handover](DEPLOY.md)
- [Security policy and vulnerability reporting](SECURITY.md)

## Ownership

The City Government of Ormoc owns this code and its data. It was prepared under the Manual of Operations for the CDRRMO and EOC engagement by Alvin M. Silva (Cognitio Plus).
