# Implementation Specification — Public Website and PWA

## 1. Architecture to preserve

The existing accepted ADR-020 establishes:

- Public routes: `/`, `/about`, `/faq`, `/support`, `/policies/privacy`, `/policies/terms`, `/policies/accessibility`, `/policies/cookies`.
- Authenticated workspace begins at `/today`; preserve the current auth/boot separation.
- Public pages must not boot the private reference-data store or start authenticated sync.
- Public page metadata and canonical URLs are managed by `setPageMeta`.
- Authenticated routes must remain `noindex, nofollow` at page and response-header levels.
- `AppShell` remains the authenticated shell, including `StatusBand`, `CommandPalette`, desktop rail and mobile bottom navigation.

Do not move workspace navigation into the public header or change the meaning of `/today`.

## 2. Public header and footer

Refine `Frame` in `src/features/public/PublicPages.tsx` rather than creating a second public shell.

### Header requirements

- **City Government seal/logo:** link to `https://ormoc.gov.ph/`, open in a new tab with `rel="noopener noreferrer"`; provide an accessible name identifying the City Government of Ormoc.
- **CDRRMO seal/logo:** link to MODE home (`/`), with an accessible name identifying Ormoc City CDRRMO.
- **MODE wordmark:** link to `/`.
- **User Guide:** prominent, always visible action linking to `/mode-user-guide.html` (verify the exact file and route in the current build before shipping).
- **Public navigation:** Home, About, FAQ and Support; compact responsive drawer/menu on small screens.
- **Sign-in/workspace action:** show Sign in when unauthenticated and Open workspace to `/today` when authenticated, retaining the existing auth-state logic.
- **Language control:** visible and keyboard accessible; do not hide language selection in a low-discoverability settings screen.
- **Theme control:** retain existing `ThemeToggle` where it works at mobile and desktop widths.
- Add a skip link and semantic `header`, `nav`, `main` and `footer` landmarks.

### Footer requirements

- Clearly identify the City/office responsible for MODE without implying that the software developer is the data controller.
- Provide About, FAQ, Support, User Guide and policy links.
- Show a public support address only after confirming that it is monitored.
- Do not display placeholder DPO details, unapproved policy effective dates or unverified City addresses.

## 3. Brand and visual system

Use existing brand assets from `public/brand/` and current `Brand` components where possible. Avoid duplicating or redrawing official seals. Preserve the distinction between official City/CDRRMO marks and the MODE product identity.

Recommended signature surfaces:

- Sky wash: `#EAF5FF`
- Sky highlight: `#D8ECFF`
- Selected/secondary sky: `#B9DEFA`
- Primary MODE blue: `#2F86C8`
- Deep navy text: `#13283D`
- White for dense content surfaces

These are proposed semantic tokens, not a mandate to replace all existing theme variables. Reconcile them with the current Tailwind/theme token system and verify WCAG contrast. Keep status semantics distinct: blue must not mean safe, warning, alert or approval. Use text and icons in addition to colour.

Typography should use the fonts already loaded and configured in the project. Do not add external font requests without checking performance and privacy impact.

## 4. Public page information architecture

### Home

1. Hero and platform positioning.
2. Why institutional capability matters.
3. What MODE supports (Manual, assessment, workflows, EOC records, risk information, offline access).
4. The assess → review/validate → operationalise → learn/improve cycle.
5. Institutional roles and authority boundary.
6. Manual review/validation participation CTA.
7. Emergency/official-information limitation statement.

Avoid oversized dashboard screenshots or simulated live operational figures on the public page. If images are used, use authentic, approved screenshots with redacted data and descriptive alt text.

### About

Explain purpose, relationship to the official Manual, City development/resilience context, institutional roles, users and design principles. Keep official plan titles, quoted vision and plan periods tied to approved source documents.

### FAQ

Use accessible accordions grouped under clear topics: About MODE; authority and emergency operations; accounts and access; offline/sync; assessment and validation; risk information; privacy and support. Keep answers plain-language and consistent with the deployed feature set.

### Support

Separate technical support, project coordination, account access, Manual validation, privacy and accessibility. Emergency disclaimer must be prominent. Do not represent the project developer's email as the DPO contact.

## 5. Language strategy

The current `src/lib/i18n.tsx` defines only `en` and `ceb`; its comments and labels explicitly call `ceb` Cebuano (Bisaya). This does **not** establish that the translation is Ormocanon.

Target direction agreed for the platform:

- English
- Filipino
- Ormocanon (locally validated language variety)

Implementation requirements:

1. Introduce language identifiers deliberately (suggested: `en`, `fil`, `orm`) and do not relabel the existing `ceb` strings as Ormocanon.
2. Retain Cebuano as a separate option only if product owners choose to support it; otherwise migrate/retire it transparently after review.
3. Translate public navigation, common interface controls, accessibility prompts, error states and most-used operational screens as a staged but coherent release.
4. Preserve controlled Manual text, legal citations, approved protocols and source titles in their authoritative language. Where translations are supplied, label them as translations for explanation and never let them supersede the approved source.
5. Maintain key parity tests across all supported languages and a glossary for DRRM/EOC terminology.
6. Require review by competent local Ormocanon speakers. Machine translation alone is not sufficient for publication of operational instructions.
7. Test language persistence on shared devices and make the current language visible. Consider a user-facing language selector without forcing translation of common technical terms such as EOC, ICS, Dashboard or Tools where natural usage retains them.

## 6. Search strategy

The existing `CommandPalette` in `AppShell` is an authenticated workspace utility, not a public universal search. Do not expose its private result sources in public routes.

A public-facing search affordance should only be added if it has a useful, maintained public corpus. Suggested initial scope:

- Public pages and FAQ entries.
- Public User Guide sections.
- Publicly approved policy documents and published Manual overview material only.

For authenticated universal search, build on the existing CommandPalette and scope results to the user's permissions. Search categories may include Manual chapters/sections, SOPs/protocols, forms/tools, approved guidance and governance records. Requirements:

- Database-level permission enforcement (RLS or scoped server-side RPC/views), not client-side filtering alone.
- No leakage of restricted document titles, snippets, counts, identifiers or existence through autocomplete, error messages or timing.
- Offline search only over content already cached and authorised for that device/user.
- Online search over scoped server results.
- Results should show title, content type, reference (chapter/section/SOP), approved/current status, version/source and last-updated date when those fields are available and authorised.
- Keyboard support: Ctrl+K/Cmd+K to open, Escape to close, arrow navigation and Enter to open; visible focus and screen-reader announcements.
- Search history, if implemented, remains local, clearable and free of sensitive query content where feasible.
- Do not download the entire Manual, Vault or database solely to support search.

## 7. User Guide

- Keep the visible header action linked to `/mode-user-guide.html` only after confirming the generated/static file is present in the production build.
- Provide a clear “last updated” and version label sourced from the controlled User Guide metadata.
- The guide should distinguish public orientation from authenticated operational instructions.
- Ensure guide navigation works offline if the file is intentionally precached; do not assume a static file is cached without checking service-worker rules.

## 8. PWA and mobile behaviour

Preserve ADR-020's PWA behaviour unless a deliberate, tested change is approved:

- Manifest `start_url` `/today`, scope `/`.
- Install reminder appears on public pages only, in page flow, with a clear dismissal.
- Accessibility settings remain available across screens and persist locally.
- Authenticated bottom navigation remains within `AppShell`.

Enhancements:

- On mobile, compact public header with clear logo/wordmark, language control, menu and sign-in/workspace action.
- Respect safe-area insets in installed mode.
- Maintain 44×44 CSS px minimum touch targets where practicable.
- Avoid sticky UI obscuring content or the install prompt.
- Clearly communicate offline, syncing, pending and conflict states in authenticated workspace; public site should not imply that all functions are offline-capable.
- Use safe update prompts and preserve unsynchronised local work during service-worker updates.
- Do not request notification permission on page load. Push notifications are not to be claimed unless a separate, complete implementation exists.

## 9. SEO and analytics

- Retain `setPageMeta` and canonical URL generation.
- Index only public routes and approved public content.
- Keep workspace and sensitive routes `noindex, nofollow` and enforce `X-Robots-Tag` headers.
- Keep `robots.txt` and sitemap path lists generated from one source and tested for parity.
- Use unique page titles/descriptions; avoid keyword stuffing.
- Add Open Graph/social metadata only with approved brand assets and canonical URL.
- Do not add third-party analytics or trackers without City approval, privacy review and an accurate privacy notice.

## 10. Data and institutional claims

- Assessment numbers shown publicly must identify cycle, denominator, source date and validation status; avoid publishing live institutional readiness scores on the public website by default.
- Do not show synthetic sparkline or trend data as actual historical change.
- Do not show private EOC activity, incident details, resource requests or barangay records on public pages.
- Risk maps/profiles must display source, date, geographic coverage, limitations and validation status.
- Do not imply that the software automatically determines hazard, risk, evacuation, activation, declaration, resource allocation or legal compliance.
