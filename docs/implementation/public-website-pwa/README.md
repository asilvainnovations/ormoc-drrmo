# MODE 1.23.0 — Public Website and PWA Experience Handover

**Status:** Design and content handover for implementation review  
**Prepared:** 18 November 2026  
**Repository:** `asilvainnovations/ormoc-drrmo`  
**Target branch (proposed):** `feature/mode-1.23.0-public-experience`

## Purpose

Refine the existing public-facing MODE experience so it clearly communicates the platform's institutional purpose, its relationship to the approved CDRRMO and EOC Manuals, the City's resilience direction, and the boundaries of digital decision support. Improve navigation, accessibility, mobile/PWA usability and public information architecture without disturbing the authenticated `/today` workspace.

This is a **handover specification and copy package**, not an implemented code change. It has not been committed, pushed, deployed, or tested against a live environment.

## Source files reviewed

The current repository snapshot was inspected through the supplied source files:

- `src/features/public/PublicPages.tsx` — public Home, About, FAQ, Support and policy pages.
- `src/components/AppShell.tsx` — authenticated workspace shell, status band, command palette and mobile tab navigation.
- `src/lib/i18n.tsx` — current English/Cebuano app translation dictionary and local persistence.
- `020-public-site-and-today-route.md` — accepted ADR-020 defining public routes and `/today` workspace route.
- `public-pages-accessibility-pwa.md` — existing accessibility/PWA integration notes and publication blockers.

The handover deliberately preserves ADR-020's public routes and separation between public pages and authenticated workspace.

## Package contents

1. `01-public-web-copy.md` — replacement editorial copy for Home, About, FAQ and Support.
2. `02-implementation-spec.md` — source-aware UX, navigation, language, search, branding and PWA implementation requirements.
3. `03-decisions-and-conflicts.md` — existing architecture to preserve, conflicts to reconcile and claims requiring validation.
4. `04-acceptance-and-qa.md` — functional, accessibility, SEO, security, offline and content acceptance criteria.
5. `05-implementation-plan.md` — recommended sequence, dependencies and release gates.

## Non-negotiable institutional safeguards

- The approved Manual of Operations and EOC Manual remain the authoritative documents. MODE is their digital operational companion, not a substitute.
- MODE must not be represented as an official warning source, evacuation-order issuer, declaration authority, field command system or automatic legal/financial decision-maker.
- EOC coordination does not displace the Incident Commander, IMT or established ICS command relationships.
- Public pages must not expose authenticated records, restricted metadata, private document titles or role-restricted search results.
- Do not publish privacy, security, accessibility-conformance, hosting, retention or legal-approval claims unless they are verified against the deployed system and approved by the accountable City offices.
- No unverified quotation, endorsement or implied Mayor approval of MODE is to be published.

## How to use this package

Review the copy with CDRRMO leadership and designated City communications/legal/privacy reviewers. Confirm the source facts and publication blockers in `03-decisions-and-conflicts.md`. Implement in a dedicated branch, preserving `main`, then run the acceptance gates in `04-acceptance-and-qa.md` before proposing a pull request.
