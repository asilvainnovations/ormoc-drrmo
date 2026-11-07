# MODE public pages, accessibility and PWA implementation notes

## Routes
- `/` public SEO landing page; signed-in workspace route moved to `/today`.
- `/about`, `/faq`, `/support`.
- `/policies/privacy`, `/policies/terms`, `/policies/accessibility`, `/policies/cookies`.

## Integration
1. Add `import './public-accessibility.css';` to `src/styles/index.css`.
2. Add supplied components at `src/components/AccessibilityTools.tsx`, `src/components/InstallPrompt.tsx`.
3. Add `src/features/public/PublicPages.tsx`.
4. Replace `src/App.tsx` using supplied route patch.
5. Update internal links/bookmarks previously using `/` for the Today workspace to `/today`.
6. Add sitemap, robots.txt, canonical URLs, and `noindex` for authenticated routes. SEO-index only public content.
7. Confirm `manifest.start_url` remains appropriate for the public root and test install/standalone behaviour.

## Publication blockers
Replace TO_CONFIRM placeholders: general support email, DPO email, business address, NPC registration reference (only if applicable), policy effective/approval dates and accountable policy owner. Confirm real monitored support channels. Verify Supabase hosting/backup/subprocessor/support locations, production third-party network requests, cookies/storage/IndexedDB/service worker behaviour, retention schedules, controller/processor roles and breach escalation duties.

## Acceptance
Run `npm run typecheck`, `npm test`, `npm run build`. Test root public access, `/today` authentication, OAuth consent and deep routes. Test keyboard-only navigation, focus order, headings, landmarks, 200% zoom, form labels/errors, screen reader announcements and axe. Manually test NVDA/Firefox, VoiceOver/Safari and TalkBack/Chrome. Test PWA install support, iOS manual installation directions, installed detection, offline launch and safe update prompts.

WCAG 2.2 AA is a target, not a conformance claim. Obtain an accessibility audit before publishing any compliance statement.

No push notifications are implemented by this patch. Web Push needs a defined purpose, explicit opt-in, service worker push handler, subscription lifecycle, server sender, revocation and separate privacy notice. Do not request notification permission on page load.

MODE is not an official warning authority or incident command system. It must not be represented as issuing official alerts, evacuation orders, declarations or field commands.
