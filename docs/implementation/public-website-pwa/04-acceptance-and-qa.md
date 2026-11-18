# Acceptance Criteria and QA Gates

## 1. Routing and authentication

- [ ] `/`, `/about`, `/faq`, `/support` and approved policy routes render without login.
- [ ] Public routes do not initialise private reference data or authenticated sync.
- [ ] `/today` remains authenticated and opens the existing Today workspace.
- [ ] Sign-in, OAuth callback, `safeNext`, deep links, logout and unknown-route behaviour remain correct.
- [ ] Public header shows Sign in or Open workspace based on actual auth state.
- [ ] No public link routes a user to an unfinished governance/validation workspace.

## 2. Header, brand and guide

- [ ] City Government logo opens `https://ormoc.gov.ph/` in a new tab with safe rel attributes.
- [ ] CDRRMO logo and MODE wordmark route to `/`.
- [ ] User Guide opens `/mode-user-guide.html` and the built file exists in production output.
- [ ] Official seals are unmodified, correctly labelled and have meaningful accessible names.
- [ ] Header remains usable at 320 CSS px width, 200% zoom and installed PWA mode.
- [ ] Public and authenticated navigation remain visually and functionally distinct.

## 3. Content truth and institutional safeguards

- [ ] Every described feature is present, permissioned and tested in the target build.
- [ ] Planned, demo, seeded or incomplete features are not described as live production capability.
- [ ] Approved Manual vs platform distinction is clear on Home and About.
- [ ] MODE is not described as official warning service, dispatch channel, declaration authority or incident command system.
- [ ] EOC activation and legal declarations are not conflated.
- [ ] Review/validation is not described as formal approval.
- [ ] No unverified Mayor quote, endorsement or institutional approval claim appears.
- [ ] CDP and Ten-Year LDRRM Plan titles, quotations and periods are checked against controlled sources.

## 4. Language

- [ ] Language options are labelled truthfully and match completed translations.
- [ ] Cebuano is not labelled Ormocanon without local-speaker confirmation and translation review.
- [ ] English, Filipino and Ormocanon key parity tests pass if all three are included in the release.
- [ ] Most-used public interface strings and operational prompts are translated and reviewed before claiming three-language coverage.
- [ ] Controlled Manual/legal source text remains intact; translations are clearly identified as explanatory translations.
- [ ] Language selection persists and remains visible on mobile and desktop.

## 5. Search and permissions

- [ ] Public search, if included, indexes public content only.
- [ ] Authenticated search is enforced by RLS/scoped server-side queries, not UI filtering alone.
- [ ] Restricted record titles, snippets, counts and existence cannot be inferred by unauthorised users.
- [ ] Offline search is limited to authorised content already cached on the device.
- [ ] Search keyboard interactions and screen-reader announcements work.
- [ ] No full private corpus download is required for search.

## 6. SEO and privacy

- [ ] Unique title and description for each public page.
- [ ] Canonical URL points to the approved official domain.
- [ ] Public sitemap contains only intended public routes.
- [ ] Authenticated/private routes have `noindex, nofollow` and `X-Robots-Tag` response headers.
- [ ] robots/sitemap route lists remain in parity under automated tests.
- [ ] No private data or restricted content appears in page source, metadata, JSON-LD, previews or social cards.
- [ ] No third-party analytics/tracker is added without approval and privacy review.

## 7. PWA and offline

- [ ] Manifest `start_url` and scope match the accepted architecture.
- [ ] Install prompt is shown only in intended contexts and is dismissible.
- [ ] Offline claims on public pages match actual tested behaviour.
- [ ] Offline launch and authorised cached content work on supported devices.
- [ ] Pending entries survive reload and service-worker update; conflicts are surfaced.
- [ ] Sync status is understandable and does not imply server receipt before successful sync.
- [ ] No push-notification feature is advertised unless implemented end-to-end with opt-in and revocation.

## 8. Accessibility and responsive QA

- [ ] Keyboard-only navigation, visible focus and logical focus order.
- [ ] Correct headings, landmarks, labels and accessible names.
- [ ] Accordions announce expanded/collapsed state.
- [ ] Forms expose clear validation and error messages.
- [ ] Text remains usable at 200% zoom and on narrow screens.
- [ ] Contrast is tested; status is not communicated by colour alone.
- [ ] Reduced-motion preferences are respected.
- [ ] Manual screen-reader checks with NVDA/Firefox, VoiceOver/Safari and TalkBack/Chrome.
- [ ] Automated axe checks pass or have documented, approved exceptions.
- [ ] Do not claim WCAG 2.2 AA conformance until an appropriate audit has been completed.

## 9. Required automated checks

Run the repository's actual scripts, not assumed script names. At minimum, inspect `package.json` and run the applicable equivalents of:

- TypeScript typecheck
- Unit and integration tests
- Production build
- Route/meta/robots/sitemap parity tests
- i18n key parity tests
- Accessibility automated checks
- E2E route/auth tests

Record command, environment, commit SHA, result and known failures in the PR. Also complete manual mobile/PWA/offline testing on representative Android and iOS devices/browsers.
