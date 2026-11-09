# ADR-020: Public pages at "/", the workspace at "/today"; only public content is indexed (v1.10.0)

Status: Accepted, 8 Nov 2026. Region facts corrected by ADR-021 (the live project is in Tokyo).

## Context
The City supplied draft public pages: a landing page, About, FAQ, Support and four policies. It asked that "/" become the public landing page for search engines, that the signed-in workspace move to "/today", and that the policies use real contact details. The draft text had problems:
- it gave the hosting region without checking it against the project (the region it named, Northeast Asia, turned out to be right: ADR-021);
- it described AI features that MODE does not have;
- it made claims about cookies that the app does not set;
- it hard-coded contact details and showed today's date as the policy date.

## Decision
1. **Routes:**
   - `/`, `/about`, `/faq`, `/support` and `/policies/{privacy,terms,accessibility,cookies}` open without an account. They do not load the reference data or start sync.
   - Every workspace route sits under `Boot` and `RequireAuth`. The Today screen moves to `/today`.
   - Unknown addresses show a public "Page not found" page.
   - The sign-in fallback (`safeNext`), the auth callback, the Today tab, the crash screen and the OAuth consent page now point to `/today`.
2. **Content is typed data** in `src/features/public/PublicPages.tsx`. The policies describe the deployed code, checked on 8 Nov 2026:
   - the City is the controller, and the developer is the processor;
   - the data is hosted in Tokyo, Japan (`ap-northeast-1`, ADR-021);
   - the app sets no cookies;
   - the policies list the device storage MODE actually uses;
   - the policies say where the City must still confirm something.
3. **Contact details and policy status come from `src/lib/site.ts`** and the build environment: `VITE_SITE_URL`, `VITE_SUPPORT_EMAIL`, `VITE_DPO_EMAIL`, `VITE_BUSINESS_ADDRESS`, `VITE_NPC_REGISTRATION`, `VITE_POLICY_EFFECTIVE` and `VITE_POLICY_OWNER`. Until the effective date and the approving officer are both set, each policy shows a "Draft, not yet approved" notice. "Last reviewed" is a fixed date, never today's date.
4. **Search engines:**
   - `setPageMeta` sets the title, the description, the robots tag and the canonical URL for each public page.
   - Workspace routes get `noindex, nofollow` from the page and from an `X-Robots-Tag` header (`vercel.json`, `netlify.toml`).
   - The build writes `robots.txt` from the same path list, and writes `sitemap.xml` when `VITE_SITE_URL` is set. A unit test keeps the two path lists in step.
5. **Installed app:**
   - The manifest's `start_url` is `/today` and its scope is `/`.
   - The install reminder appears on public pages only, in the page flow. A dismissal is remembered for 30 days.
   - The Accessibility settings (text size, contrast, font and motion) are on every screen and are stored on the device.

## Consequences
- Old bookmarks to `/` open the public home page. Signed-in people see "Open workspace" there.
- Supabase Auth "Site URL" and redirect allow-lists do not change, because sign-in returns to `/auth/confirm`.
- A canonical host needs `VITE_SITE_URL`. Without it, pages use their own origin and no sitemap is written.
- The policies are drafts until the City Legal Office and the DPO approve them.
