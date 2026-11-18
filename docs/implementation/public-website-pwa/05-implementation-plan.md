# Implementation Plan — MODE Public Website and PWA Experience

## Release objective

Deliver a coherent public-facing MODE experience that explains the platform's role and boundaries, provides accurate access and support information, and improves mobile/PWA usability while preserving the current authenticated workspace architecture.

## Recommended implementation sequence

### Phase 0 — Baseline and content verification

1. Create a dedicated branch from the verified current `main` commit; do not modify `main` directly.
2. Inspect `package.json`, `App.tsx`, `Brand.tsx`, `site.ts`, `CommandPalette.tsx`, manifest, service worker, `vercel.json`, `netlify.toml`, static assets and User Guide build inclusion.
3. Map every public feature claim to an implemented component, route, schema and permission.
4. Confirm City support email monitoring, DPO contact, policy owner, policy effective date, City address and policy approval status.
5. Verify exact CDP and LDRRMP source references and obtain clearance for any official quote or City branding treatment.

**Gate:** no implementation of unsupported claims or unverified policy contacts.

### Phase 1 — Public copy and page structure

1. Update Home, About, FAQ and Support content in the existing `PublicPages.tsx` architecture.
2. Preserve public route structure and page metadata handling.
3. Rework the Home narrative around institutional foundations, Manual support, assessment, operational workflows and learning.
4. Make the authoritative Manual and authority boundaries explicit.
5. Keep Support contact details data-driven and separate technical support from DPO contact.
6. Ensure the Manual review/validation CTA links only to an implemented, access-controlled destination; otherwise use an approved contact route.

**Gate:** CDRRMO content owner review; City communications/legal/privacy review for the relevant claims.

### Phase 2 — Header, navigation and brand

1. Refactor the existing public `Frame` header, retaining semantic landmarks and skip link.
2. Implement separate City logo, CDRRMO logo and MODE wordmark destinations using verified assets.
3. Add the visible User Guide action and verify the static asset is in the production build.
4. Improve mobile menu and language control.
5. Keep authenticated `AppShell` navigation unchanged unless a separate approved change is made.

**Gate:** responsive review at narrow widths, desktop, tablet and installed mode.

### Phase 3 — Language architecture

1. Design migration from `en`/`ceb` to `en`/`fil`/`orm` without falsely relabelling existing Cebuano strings.
2. Create glossary and terminology review workflow.
3. Translate public chrome and the most-used operational prompts/screens.
4. Add key parity tests and language persistence tests.
5. Complete local Ormocanon review before enabling it as a selectable production language.

**Gate:** no language is exposed as complete until reviewed strings cover the promised scope.

### Phase 4 — Search and discoverability

1. Decide whether public search is needed now; if so, limit it to a maintained public corpus.
2. Improve authenticated CommandPalette only within the user's permission scope.
3. Add keyboard accessibility, accessible result announcements and offline search over authorised cached data only.
4. Add metadata/SEO improvements while preserving `noindex` for authenticated routes.

**Gate:** security tests demonstrate no restricted metadata or record-existence leakage.

### Phase 5 — PWA, accessibility and release

1. Preserve accepted manifest and install-prompt behaviour.
2. Verify safe service-worker updates and offline state messaging.
3. Complete automated and manual accessibility checks.
4. Run route, auth, typecheck, test and production build checks.
5. Capture screenshots at mobile/tablet/desktop and document any known limitations.
6. Open a PR with source mapping, test evidence, migration notes and unresolved City decisions.

**Gate:** no production deployment until blockers are resolved and the PR is reviewed/approved.

## Suggested work breakdown

| Workstream | Main files / areas | Key risk |
|---|---|---|
| Public copy | `src/features/public/PublicPages.tsx` | Claims exceed deployed capability |
| Site configuration | `src/lib/site.ts` and build env | Incorrect support/privacy contact or policy status |
| Brand/header | `src/components/Brand.tsx`, public `Frame` | Wrong logo link, duplicated/altered seal |
| i18n | `src/lib/i18n.tsx`, tests and string dictionaries | Cebuano mislabelled as Ormocanon; incomplete operational translation |
| Search | `src/components/CommandPalette.tsx`, scoped server queries | RLS bypass or metadata leakage |
| PWA/SEO | manifest, service worker, robots/sitemap, host config | Offline data loss or private route indexing |
| Accessibility | shared controls/styles/public shell | Conformance claimed without audit |

## Proposed PR title

`feat(public): refine MODE public website and PWA experience`

## PR must state

- Base commit and dedicated branch.
- Public routes preserved and tested.
- Files changed and rationale.
- Copy claims verified against implementation.
- Language status and any untranslated strings.
- Support/DPO/policy publication blockers.
- SEO and robots verification.
- Offline/PWA test evidence.
- Accessibility test evidence and known limitations.
- Explicit statement that no legal authority or approval workflow was changed.
