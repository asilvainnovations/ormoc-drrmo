# Architecture decision records

Each record states a decision, why it was made, and what it costs. Change a decision by adding a new record that supersedes the old one; do not edit an accepted record's decision.

| No. | Decision | Status |
|---|---|---|
| [001](001-stack.md) | Vite + React + TypeScript PWA on Supabase | Accepted |
| [002](002-hosting-and-privacy.md) | City-owned Supabase project; portable to self-hosting (planned region Singapore) | Accepted (region amended by 021) |
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
| [015 (location)](015-eoc-location.md) | The EOC's location ships with the app; maps open outside it. Two records share number 015; both are cited as ADR-015 in code | Accepted |
| [015](015-geo-cop-city-basemap-and-vault-access.md) | Geo-COP on a City-hosted PMTiles basemap; reference points and layers with validation status; Vault access by role | Accepted (narrows the CSP of 011; extends 004) |
| [016](016-step-forms-and-drrm-module.md) | Every workflow and protocol step is recorded on a form, snapshotted per run; the DRRM module | Accepted (extends 013) |
| [017](017-eoc-structure-and-cp-clustering.md) | EOC positions and three-deep designations; contingency plans activate response clusters; barangay clusters | Accepted |
| [018](018-connected-app-approval.md) | Other apps read City data only after the City approves them | Accepted (amends 010) |
| [019](019-sop-registry-and-chapter3.md) | One SOP registry (kind, SOP, process owner, policy basis, indicators) on every protocol and workflow; Chapter 3 as forms and workflows | Accepted (extends 016) |
| [020](020-public-site-and-today-route.md) | Public pages at /, workspace at /today; policies from typed data and env; only public content indexed | Accepted |
| [021](021-production-region-tokyo.md) | The production project runs in `ap-northeast-1` (Tokyo), as the live dashboard shows; transfer to Japan in the privacy notice | Accepted (amends 002) |
| [022](022-chapter4-and-owner-alignment.md) | Chapter 4 SOPs 4-01 to 4-09 run as protocols; every template cites written text; HR-05/HR-06 owners follow Chapter 2 | Accepted (extends 019) |
| [023](023-component-kit-and-appearance.md) | Radix/shadcn component kit kept and mapped to City tokens; Light/Dark/device appearance; search palette; component gallery | Accepted (amends 007, 008) |
| [024](024-ddrive-risk-intelligence.md) | DDRiVE desk assessment as read-only reference; bands computed; decision support only; no API writes | Accepted (amended by 1.12.2 and 1.13.0) |
| [025](025-ra12287-irr-alignment.md) | AA rules follow RA 12287 and the IRR: three-day lead time (extendable to five), checked again at declaration; graduation only for hydromet and geological hazards; automatic lifting on occurrence | Accepted (amends 006; legal readings to confirm with the City Legal Office and OCD VIII) |
| [026](026-free-tier-hosting-during-development.md) | Vercel Hobby and Supabase Free during development; one Vercel project; app-only builds | Accepted (narrows 002 and 021 for development) |
| [027](027-bolt-workspace.md) | Bolt.new is the working space (terminal, preview); changes reach `main` only through pull requests | Accepted |
| [028](028-hazard-map-layers.md) | Official hazard sheets as georeferenced image overlays over the COD-AB barangays, with QGIS-style tools (layers, identify, measure, export) and GeoAnalyticsPH embedded | Accepted |
| [029](029-validation-workshop-and-chapter5.md) | Validation workshop controls in SQL (scorer cannot validate; revision needs a reason); Chapter 5 as a written chapter | Proposed |
| [030](030-echo-and-hazard-maps-in-assess.md) | ECHO: simulator, evacuation intelligence, camp management records (aggregates only) and EOC dashboard; standards kept distinct; Hazard maps moved to Assess | Proposed |
| [031](031-platform-coherence-language-pillars-pareto-introduction.md) | Cebuano UI chrome, pillar-colored Library, Pareto dashboard on Today, Introduction as Chapter 0 with cover; citation corrections (Memorandum 131; GK CY 2026 tiers) | Proposed |
| [032](032-chapters-5-to-8-and-renumbering.md) | Chapters 5–8 published; financing renumbered Ch.5→Ch.6 by deterministic id with a cleanup script; 17 proposed SOP templates; Introduction v1.1 = the drafting team’s official draft (assessment-informed method, baseline, systems diagnosis, TQM) seeded as front matter — code "Introduction", not Chapter 0, no approval machinery; workbook crosswalk, template aliases and resource/event schemas deferred | Accepted |
