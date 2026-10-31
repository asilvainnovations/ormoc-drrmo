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
