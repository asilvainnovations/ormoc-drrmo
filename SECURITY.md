# Security policy

MODE (Manual of Operations for the DRRMO and EOC) belongs to the **City Government of Ormoc**. The City is the personal information controller for the records in it. ASilva Innovations (Cognitio Plus) develops and supports the platform for the City. This page explains how to report a security problem and how the platform is protected. Everything below was checked against the code on 8 November 2026 (version 1.10.0). Items marked **City to confirm** need a decision or a record from the City.

## Reporting a vulnerability

- **Email:** mode-support@asilvainnovations.com. If personal data may be involved, copy the CDRRMO data protection contact, cdrrmo.ormoccity@gmail.com.
- **Include:** the page or address, the steps to reproduce, what you expected, what happened, and the version shown in Settings → About.
- **Do not include:** passwords, one-time codes, API keys, or personal data of any person. A screenshot with the sensitive parts covered is enough.
- **Do not** test against the City's production project, read or change other people's records, or try to deny service. Use a local copy (`npm run test:db`, `scripts/e2e_test.sh`) or ask for access to the training project.
- **Response:** the support mailbox is monitored (confirmed 8 November 2026). Support acknowledges a report within 2 working days and sends an assessment within 10 working days. The mailbox owner after turnover and the developer access end-date are recorded in `docs/ict-asset-register.md` (**City to name the owner and the end-date at turnover**).
- Please do not publish the problem until a fix is deployed or 90 days have passed, whichever comes first.

Report emergencies to the City emergency hotline, not to this address. The support channel is not monitored around the clock.

## Supported versions

Only the version deployed from `main` is supported. Fixes are made on `main` and deployed to production. There are no maintained older branches.

## How the platform is protected

### Where data lives

- **One City-owned Supabase project**, `jmctsspadywjcbbqwweh`, in Northeast Asia (Tokyo, `ap-northeast-1`), holds the database, sign-in and file storage (ADR-002, ADR-021). There is no other application server and no edge function. **City to confirm** the backup plan and support-access settings, and record the Supabase subprocessor list and the transfer to Japan in the City's processing records.
- **The web app** is static files on Netlify or Vercel under a City-owned team. **City to confirm** which host is live and its region.
- **The browser talks only to the City's own Supabase project.** The Content Security Policy in `vercel.json` sets `connect-src` to that one project, with no `*.supabase.co` wildcard. Fonts are self-hosted. There are no analytics, advertising or tracking scripts. Device storage is first-party and listed item by item in the Cookies and Device Storage policy (`/policies/cookies`). Links to hazard services (PAGASA, PHIVOLCS and others) open in a new tab with `rel="noopener noreferrer"`. They are never embedded.
- **Other headers:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS for two years, `nosniff`, a strict referrer policy, and a permissions policy that allows only the camera (to photograph evidence). Workspace addresses send `X-Robots-Tag: noindex`.

### Who can see and change what

- **Every rule is enforced in Postgres:** row-level security on every table, plus guard triggers (ADR-004, ADR-013). The screens only mirror the rules. Calling the API directly gives the same answers.
- **Accounts:** anyone can create an account. It reads nothing until an administrator approves it and gives it at least one of the ten City roles (`app.is_active_user()`, ADR-009). Deactivated accounts read nothing.
- **Approvals:** only the CDRRMO Head approves or retires manual versions, protocols and workflows. Approved versions, validated assessment answers, approved SitReps and resource requests, closed protocol runs, requested declarations and the PDRA behind them, lifted declarations, and disbursements are locked by triggers. Records with legal or financial weight cannot be deleted (`revoke delete`). The logbook takes corrections as new entries.
- **Authority actions need a live connection** (ADR-006): EOC level changes, approvals, declaration steps, disbursements and role grants. They are never queued on a device.
- **Server stamps:** who and when are set by the database from the signed-in account and the server clock. They are not taken from the device. Stale edits are refused (version check, SQLSTATE `PT409`).
- **Audit:** every change to a tracked table is written to `audit_log` with who, what and when.
- **Other apps** ("Sign in with MODE", OAuth 2.1): their tokens are read-only on every table (ADR-010). They read nothing until the City approves the app in Settings → Connected apps (ADR-018).
- **Files:** the `evidence`, `vault` and `geo` buckets are private. Their files open through signed links that expire after 5 minutes. File types and sizes are limited by the bucket: 15 MB, 25 MB and 50 MB. The `basemap` bucket is public because it holds only OpenStreetMap-derived map tiles. Only an administrator can upload to it.

### Data minimisation

- The schema has **no fields for the names of affected persons, evacuees, patients or informants**. Barangay reports are counts. Every free-text field reminds users of this (RA 10173).
- **Crash reports** (`client_errors`) hold the app version, the page, the error type, the browser, and the error text and stack trace. Email addresses and phone numbers are removed from the error text before it is sent. Only administrators can read crash reports. They are deleted by hand after 90 days (DEPLOY §11). **City to confirm** this period with the DPO.

### On the device

- **What is stored:**
  - the sign-in session (local storage);
  - the records the role can read, entries waiting to send, and files waiting to upload (IndexedDB `ormoc-drrm-ops`);
  - the app files (service-worker precache). API responses are never cached by the service worker (`runtimeCaching: []`). Manual figures and map tiles are not precached;
  - the appearance choice (light, dark or device), accessibility preferences, the install-reminder dismissal, and each account's ICS, PSCP and Gawad KALASAG workspaces (local storage).
- **Signing out** erases the account's records from the device. Unsent entries that belong to other accounts on a shared phone are kept (ADR-014).
- **A lost device:** deactivate the account in Settings → Users and roles, then reset its password. The device cannot read anything after its session ends.

### Keys and access

- The publishable (anon) key is public by design. Row-level security protects the data.
- The `service_role` key and the database password are secrets. They are never in the app, the repository or the hosting environment variables.
- The developer's access to the app, the Supabase organisation, the hosting team and the repository is time-boxed. It is removed at turnover (DEPLOY §8, `supabase/admin/developer_access.sql`).

### Testing

Every change runs:

- the unit tests;
- the SQL rules and security suite. `supabase/tests/10_rules_and_security.sql` signs in as each role and checks what is allowed, what is refused with which error, and the locks after approval;
- integration tests through PostgREST;
- Playwright end-to-end tests, including axe accessibility checks and offline use.

From 1.10.0, CI (`.github/workflows/ci.yml`) runs the typecheck, the unit tests, the build and the SQL suite on every push and pull request. The workflow file was not in the repository before 1.10.0, although DEPLOY.md described it. Push it with git, because the GitHub web upload drops dot-folders.

## Personal data breaches

1. Anyone who suspects a breach reports it **immediately**. Tell the CDRRMO and mode-support@asilvainnovations.com, and say what was seen and when.
2. **Contain the breach.** Support and the administrator act together to stop it. They deactivate the affected accounts, rotate keys if any secret may have been exposed, and suspend any affected connected app. They keep the audit log and the logs from the host and from Supabase.
3. **The City, as controller, decides on notification.** The DPO assesses the breach against NPC Circular 16-03. That Circular sets 72 hours from knowledge for notifying the National Privacy Commission and the affected persons, when notification is required. **City to confirm** the DPO's current procedure and any later NPC issuances. Support provides the facts the DPO needs, including the records involved, the time window and the cause.
4. **Afterwards:** write a short incident report, fix the cause, add a test that would have caught it, and record the change in the release notes.

## Known limits

- No formal penetration test or accessibility audit has been done yet.
- Backups of the file buckets are a weekly manual task (DEPLOY §11). Supabase's own backups cover the database only.
- `src/styles/index.css` contains rules, added with an uploaded template, that hide "badge" elements by broad selectors. These rules do not affect security, but they can hide legitimate content. Review them before adding any element whose class or id contains `badge`, `powered-by` or `attribution`.
