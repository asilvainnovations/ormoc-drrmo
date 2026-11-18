# ADR-045: Public site refinement, contact roles and the NPC registration

**Status:** Accepted, 18 November 2026 (decisions by the lead assessor, Alvin M. Silva)
**Builds on:** ADR-020 (public pages at `/`, workspace at `/today`), ADR-021 (Tokyo hosting).
**Source:** `docs/implementation/public-website-pwa/` (handover and review notes).

## Decisions

1. **Contact roles.**
   - `mode-support@asilvainnovations.com` is **technical support** for the platform. The platform is being developed and validated by its contracted technical lead.
   - `cdrrmo.ormoccity@gmail.com` is the CDRRMO's **only mailbox**. It is the Data Protection Officer's address and the office's contact.
   - No personal address is published. Both values stay in `src/lib/site.ts` and the build environment, never in page text.
2. **NPC registration is not enforced.** MODE is a development initiative with no payment from the City. `SITE.npcRegistration` stays null and nothing is shown for it. The City may set `VITE_NPC_REGISTRATION` later if its registration applies.
3. **Policy status is unchanged.** The four policies stay as the approved snapshot of 10 Nov 2026 (City Legal Office and DPO). The handover's "draft" wording and the `TO_CONFIRM` blockers in `docs/public-pages-accessibility-pwa.md` were out of date and are corrected.
4. **Public copy** follows the handover's editorial copy (Home, About, FAQ, Support). Facts that the code and the policies already verify (offline behaviour, no names of affected people, how to install) are kept.
5. **Header:** the City seal opens the City website (`SITE.cityWebsite`, default `https://ormoc.gov.ph/`) in a new tab; the CDRRMO seal and the MODE wordmark open `/`; a User Guide action is always visible (`USER_GUIDE_URL`, precached by the service worker).
6. **Language: not changed in this release.** `en` and `ceb` stay, labelled as they are. A public language control is not added, because the public pages are English only and a switch that changed nothing would mislead. The move to `en`/`fil`/`orm` needs local-speaker review first; Cebuano is never relabelled Ormocanon.

## Not changed

- Routes, auth boundary, `setPageMeta`, robots and sitemap generation, manifest (`start_url` `/today`, scope `/`), install prompt.
- No public search, no new analytics or trackers, no live scores or operational data on public pages.

## Consequences

- Technical problems and accessibility barriers go to the developer's mailbox. Privacy requests and general CDRRMO contact go to the CDRRMO mailbox. The auth email templates in `supabase/email/` still print the CDRRMO mailbox as "Support"; they are unchanged because they are pasted into the Supabase dashboard by hand.
- The privacy policy banner "Compliant with the Data Privacy Act of 2012" (added 17 Nov 2026) is a conformance statement that has not been audited. It is kept, with a stray full stop removed, until the City decides whether to keep it.
