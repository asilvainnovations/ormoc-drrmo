# Review notes: Public Website and PWA handover

**Reviewed:** 18 November 2026, against `main` at `2d77d7a` (package version 1.22.0).
**Scope of this review:** the handover's statements about the current code, checked in the repository. The handover text itself is unchanged. This is a specification and copy package; no code is changed here.

## 1. Repository README was overwritten (fixed in this PR)

Commit `494819a` ("Add files via upload", 18 Nov 2026) replaced the project `README.md` at the repository root with this handover's README (123 lines became 45). The handover is now stored here, in its own folder, and the project README is restored to its text from before that commit.

## 2. Statements that check out

| Handover statement | Finding in the code |
|---|---|
| Public routes and `/today` per ADR-020 | Accepted ADR-020 says the same; public pages do not load reference data or start sync |
| `setPageMeta` sets title, description, robots, canonical | `src/lib/site.ts` |
| Manifest `start_url` `/today`, scope `/` | `vite.config.ts` lines 63–64 |
| Workspace routes `noindex, nofollow` in headers | `X-Robots-Tag` in `vercel.json` and `netlify.toml` |
| robots and sitemap kept in parity by a test | ADR-020 §4; generated in `vite.config.ts`; `site.test.ts` |
| Language is `en` and `ceb` only, with `ceb` labelled Cebuano/Sinugboanon (Bisaya) | `src/lib/i18n.tsx` (`Lang = 'en' \| 'ceb'`) |
| Header uses one combined seal lockup | `Seals` in `src/components/Brand.tsx`. `Seal` is also exported singly, so separate City and CDRRMO links need no new assets (`/brand/ormoc-city-seal-*.webp`, `/brand/cdrrmo-seal-*.webp`) |
| User Guide file exists | `public/mode-user-guide.html` |
| `CommandPalette` is an authenticated utility | `AppShell` only; not used by public pages |

## 3. Statements the code contradicts or has moved past

### 3.1 Support and privacy contacts (decision needed)

The handover's Support copy names `cdrrmo.ormoccity@gmail.com` as technical support and `alvin.silva@asilvainnovations.com` as project coordination, and says no data-protection address is to be published until the City confirms one.

The code says otherwise:

- `src/lib/site.ts`: `supportEmail` defaults to `mode-support@asilvainnovations.com` ("confirmed monitored on 8 Nov 2026"); `dpoEmail` defaults to `cdrrmo.ormoccity@gmail.com` ("data protection contact for the City's records"). `site.test.ts` asserts the support address.
- `PublicPages.tsx`, the privacy policy and `SECURITY.md` print those two values.
- The six auth email templates in `supabase/email/` list `cdrrmo.ormoccity@gmail.com` as **Support**, so the repository already disagrees with itself.

Implemented as written, Support would show a different technical-support address from the one in the policies and in `SECURITY.md`, and privacy requests would have no address on the Support page. The handover's own editorial note 1 also says addresses must come from `site.ts`, yet its Support copy hard-codes them.

**Decide, then record in `site.ts`:** which mailbox is public technical support, which is the data-protection contact, and whether `alvin.silva@asilvainnovations.com` appears publicly at all. Then align `SECURITY.md`, `DEPLOY.md` and the email templates in the same change.

### 3.2 Policy status is no longer "draft"

The handover (§A, §H) says the policy pages are draft pending City confirmations, and `docs/public-pages-accessibility-pwa.md` lists `TO_CONFIRM` placeholders as blockers. In the code, `POLICY` records an approved snapshot of 10 Nov 2026 (effective 9 Nov 2026; owner City Legal Office and City Data Protection Officer), `policyApproved()` is true and the "Draft, not yet approved" notice no longer shows. The blocker list in `docs/public-pages-accessibility-pwa.md` is out of date.

Still open per the code: `npcRegistration` is null (NPC registration), and the hosting, storage and service-worker facts need re-checking before any policy edit, as the handover says.

### 3.3 Release number

"1.23.0" is now claimed three times: the governance workspace (ADR-043, migration `20261117003400`), the dashboard (ADR-044) and this handover. `package.json` is still 1.22.0. Choose one sequence before any branch is cut.

## 4. Things to do differently when implementing

- Use `USER_GUIDE_URL` from `src/lib/userGuide.ts` for the User Guide link instead of a literal path. Its tooltip says the guide "works offline once loaded"; test that against the service-worker cache before keeping the claim.
- The City-seal link to `https://ormoc.gov.ph/` is new (no such link exists today). Confirm the official domain with the City before shipping.
- The "Participate in strengthening the Manual" call to action should keep pointing to Support. A governance workspace now exists (`/governance`, authenticated, Slice 1), but it is not a public destination and its status vocabulary is not yet confirmed.
- Each factual claim in the replacement copy still needs to be mapped to a built, permissioned route (handover §E). That mapping has not been done in this review.

## 5. Not done here

No code, copy or configuration was changed. The language migration (`en`/`fil`/`orm`) needs its own ADR and local-speaker review before any string is labelled Ormocanon.
