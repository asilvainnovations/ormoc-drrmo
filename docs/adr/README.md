# Architecture decision records

Each record states a decision, why it was made, and what it costs. Change a decision by adding a new record that supersedes the old one; do not edit an accepted record's decision.

| No. | Decision | Status |
|---|---|---|
| [001](001-stack.md) | Vite + React + TypeScript PWA on Supabase | Accepted |
| [002](002-hosting-and-privacy.md) | City-owned Supabase project in Singapore; portable to self-hosting | Accepted |
| [003](003-local-first-sync.md) | Local-first: IndexedDB, outbox, versioned rows, deterministic ids | Accepted |
| [004](004-rbac-and-rls.md) | Ten City roles enforced by Postgres row-level security and triggers | Accepted |
| [005](005-single-source-scoring.md) | IAT scoring rules live in SQL; the client mirrors them under a parity test | Accepted |
| [006](006-online-only-authority-actions.md) | Actions that carry legal authority require a live connection | Accepted |
| [007](007-design-system.md) | Token-based design system; status band; reserved level colours | Accepted (colour and type amended by 008) |
| [008](008-city-identity.md) | City identity: seals, banner, light blue, gray and orange; Montserrat, Poppins, Roboto Condensed; tooltips everywhere | Accepted |
| [009](009-open-signup-and-live-data.md) | Open sign-up with administrator approval; live data only, no demo mode | Accepted (amends 003 and 004) |
| [010](010-oauth-provider-read-only-clients.md) | "Sign in with Ormoc DRRM" (OAuth 2.1 / OIDC provider); consent screen in the app; other apps read-only; JWKS checks | Accepted |
| [011](011-readiness-tools.md) | ICS simulator, PSCP workbench and Gawad KALASAG readiness as app screens; hazard services linked, not embedded | Accepted |
| [012](012-single-manual.md) | One Manual of Operations: five Parts, ten functional areas; old chapter codes kept as aliases | Accepted |
| [013](013-record-integrity-guards.md) | Approval authority, draft protocols and deletes enforced in the database; guards that test the caller run as the caller | Accepted (amends 004) |
| [014](014-shared-device-sign-out.md) | Sign-out keeps other accounts' unsent changes; one stuck item backs off alone | Accepted (amends 003 and 009) |
