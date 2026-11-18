# Decisions, Existing Architecture and Reconciliation Items

## A. Existing decisions to preserve

| Area | Existing source finding | Handover decision |
|---|---|---|
| Public routes | ADR-020: `/`, `/about`, `/faq`, `/support`, four policy routes | Preserve. Refine existing pages; do not create duplicate public routes. |
| Workspace | Authenticated Today moved to `/today` | Preserve route and auth boundaries. |
| Public boot | Public pages do not load reference data or start sync | Preserve. Public shell must remain lightweight and isolated. |
| Metadata | `setPageMeta` controls title, description, robots and canonical | Reuse and test. |
| Auth shell | `AppShell` has status band, CommandPalette, desktop rail and mobile tabs | Preserve as separate authenticated experience. |
| Accessibility | Existing notes call for global accessibility tools and WCAG 2.2 AA target | Keep target; do not claim conformance without audit. |
| PWA | Manifest start URL `/today`, scope `/`; public install prompt | Preserve unless tested product decision changes it. |
| Policies | Existing policy text says draft pending City confirmations | Retain draft gating until factual and approval blockers close. |

## B. Language conflict — material product decision

The current `src/lib/i18n.tsx` supports `en` and `ceb`, with explicit Cebuano (Bisaya) labels and comments. The agreed product direction is English, Filipino and Ormocanon from the outset, with locally reviewed translations for the most-used operational screens.

**Do not relabel the current Cebuano strings as Ormocanon.** Ormocanon must be confirmed and translated/reviewed by local speakers. Product owner must decide whether Cebuano remains as a fourth language or is retired after a migration plan. Until the translations are ready, retain the current language selector accurately labelled rather than misrepresenting language coverage.

## C. Public header branding — verify assets and destinations

The source currently uses `Seals` from `@/components/Brand` as one combined lockup. User's requested brand behaviour is more specific:

- City Government logo → `https://ormoc.gov.ph/` (external, new tab, safe rel attributes).
- CDRRMO logo → MODE homepage `/`.
- MODE wordmark → MODE homepage `/`.
- User Guide action → `/mode-user-guide.html`.

Inspect `Brand.tsx`, asset variants and actual deployed asset filenames before implementation. Do not assume a particular seal filename or add duplicate marks without checking the brand component.

## D. Support and privacy contact conflict

Confirmed project-provided support addresses:

- `cdrrmo.ormoccity@gmail.com`
- `alvin.silva@asilvainnovations.com`

Existing `PublicPages.tsx` reads `SITE.supportEmail` and `SITE.dpoEmail` for technical support and privacy requests. The public DPO contact must not be inferred from the project developer address. Confirm the City's designated DPO, monitored address, privacy-request procedure and escalation path. Confirm the CDRRMO email is monitored for public technical support. Keep values in `src/lib/site.ts`/environment configuration rather than hard-coding them in page content.

## E. Claims in existing copy requiring feature verification

The current source contains claims including:

- 140 assessment indicators and evidence-gated scores;
- Manual chapters/SOPs/forms and approval by the CDRRMO Head;
- each SOP runs step-by-step and every step closes on a form with who/when;
- EOC level, logbook, SitReps, resource requests, contingency plans and response clusters;
- anticipatory action and RA 12287 workflow support;
- Geo-COP map, City basemap and validated layers;
- offline operation and server-required authority actions.

Before publishing the replacement copy, map each claim to an existing route, component, database schema, permission and tested workflow in the current branch. Rephrase or remove any claim that is only planned, partially implemented, seeded with demo data or not available to the relevant user role. Do not use marketing copy to turn a roadmap item into a live feature.

## F. Legal and institutional boundaries

Keep these distinctions explicit:

- Approved Manual vs platform copy/version.
- EOC activation vs State of Calamity vs State of Imminent Disaster.
- EOC coordination vs field command/ICS Incident Commander/IMT.
- Evidence uploaded vs evidence validated.
- Assessment score vs legal compliance or operational readiness.
- Risk information vs forecast/official warning.
- Stakeholder review/recommendation vs formal approval.

Any formal legal interpretation, policy statement or public declaration of authority should be checked through the City's established process. Do not make the City Legal Office a blanket approval gate for routine copy; involve the appropriate office for the specific legal issue.

## G. Development and resilience-plan references

The City development vision and Ten-Year LDRRM Plan should be used as strategic context, not as claims that MODE is an approved PPA or has been formally endorsed by the Mayor. Verify the exact adopted CDP vision text, controlled LDRRM Plan title and period, approval/adoption details and source citation before placing them on the public site.

Do not publish a Mayor quotation or imply personal endorsement of MODE based only on a screenshot or secondary transcription. If a quote is eventually used, reproduce it exactly from the controlled plan/message, cite its context and obtain communications clearance.

## H. Privacy, hosting, retention and policy claims

ADR-020 says the existing policy text was checked against the deployed code on 8 Nov 2026 and records Tokyo hosting, no cookies, device storage, controller/processor roles and other implementation-specific claims. These are time-sensitive facts. Re-verify against the live Supabase project, service worker, storage, network requests, providers, contracts and current deployed build before republishing or changing the policy. Do not carry forward old facts by assumption.

Outstanding policy blockers in the existing accessibility/PWA notes include: support/DPO contacts, business address, NPC registration reference if applicable, policy effective/approval dates, policy owner, support monitoring, hosting/backup/subprocessor locations, third-party requests, cookie/storage/IndexedDB/service-worker behaviour, retention schedule, controller/processor roles and breach escalation duties.

## I. Dashboard and public website separation

The Institutional Intelligence Dashboard is an authenticated decision-support view. Do not embed it into the public Home page. Public copy may explain the existence and purpose of institutional assessment but must not reveal live or restricted scores, evidence, action owners, EOC activity or sensitive operational records.
