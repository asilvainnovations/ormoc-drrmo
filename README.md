# Ormoc DRRM Operations Platform

A mobile-first, offline-capable web app (PWA) for the City Disaster Risk Reduction and Management Office (CDRRMO) and the Emergency Operations Center (EOC) of the City Government of Ormoc. It supports the CDRRMO Manual of Operations and the EOC Manual. The platform has five modules:

- **Assessment.** Runs the Institutional Assessment Tool v1.1 (140 indicators). Scoring is gated by evidence, results are shown by domain and maturity, and gaps feed a prioritised action plan.
- **Library.** Holds the manual sections with version control and approval by the CDRRMO Head. Each section traces to the indicators and master requirements MR-01 to MR-18, and to the UNDRR Scorecard and RA 12287 IRR crosswalk.
- **Protocols.** Turns the manuals into checklists the CDRRMO can run, live or as drills, with an audit trail. Nine protocols are drafted for validation.
- **EOC.** Covers the White / Blue / Red alert level, an append-only logbook, SitReps, barangay status (counts only), and resource requests.
- **Anticipatory action (RA 12287 and IRR).** Records the PDRA and the declaration timeline with its legal deadlines. It holds the 29-item AA checklist and enforces the fund cap (10% of the 70% LDRRMF) and the 30% / 70% tranche limits.

- **Document Vault.** One register of the laws, guidelines, City issuances, plans and records gathered for Document Review. Each document is linked to the indicators it evidences. The vault includes a Document Review checklist and a catalogue of the cited references, each explained in plain language. It is open to assessors, validators, administrators and CDRRMO staff.

Every button, tab, card, link and field has a tooltip. Every cited law or guideline (for example "RA 10121 Sec. 21") opens a short note when tapped.

It works with no signal. Entries are saved on the device and sent when a connection returns.

## Try it in demo mode

```bash
npm ci
npm run dev        # http://localhost:5173
```

With no Supabase settings in `.env`, the app runs in **demo mode**:

- Everything stays in the browser.
- Server actions are simulated.
- Under Settings you can switch roles to see what each one can do.

Demo mode is what to use in validation workshops and training.

## Connect to the City's Supabase project

Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY` on older projects). See [DEPLOY.md](DEPLOY.md) for creating the City-owned project, applying the database, inviting staff and publishing the app.

## Project layout

```
src/
  components/     shared UI primitives, app shell, sheet, toast
  domain/         rules mirrored from SQL: scoring, anticipatory action, EOC, protocols
  features/       screens per module (iat, library, protocols, eoc, eoc/aa, settings, home)
  lib/            local database, outbox store, sync engine, auth, time (Asia/Manila), ids
  styles/         design tokens and base CSS
supabase/
  migrations/     schema, RLS, triggers, RPCs, views (apply in order)
  seed/seed.sql   reference data generated from the IAT v1.1 and Traceability v1.1 workbooks (for psql)
  seed/parts/     the same data in parts small enough for the Supabase SQL editor
  tests/          SQL rule and security suite (plus a local-only Supabase stub)
scripts/          seed generator, test runners
reference/        the source workbooks
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
| `npm run test:db` | Rebuild a local Postgres database from the migrations and run the 128 rule and security checks. Needs `PGHOST`, `PGPORT` and `PGUSER` for a local superuser |
| `npm run test:it` | Integration tests through real PostgREST. Needs the same plus `POSTGREST_BIN` (PostgREST 12) |
| `npm run test:e2e` | Playwright on phone and desktop sizes, with axe and offline checks. Runs against `npm run preview` |
| `python3 scripts/brand_assets.py` | Rebuild the circular seals, banner copies and app icons from the originals in `public/` |
| `npm run seed:generate` | Regenerate `supabase/seed/seed.sql`, `supabase/seed/parts/` and `src/data/reference.json` from `reference/*.xlsx` |
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

## Ownership

The City Government of Ormoc owns this code and its data. It was prepared under the CDRRMO Manual of Operations and EOC Manual engagement by Alvin M. Silva (Cognitio Plus).
