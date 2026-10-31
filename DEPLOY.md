# Deployment and handover

This guide takes the platform from this repository to a running service owned by the City Government of Ormoc. The City's ICT office does each step under City accounts. The consultant may assist, but holds no production account or key after turnover.

Time needed: about half a day, plus the time to invite staff.

## 0. Before you start

- [ ] A City email account to **own** the Supabase, Netlify and GitHub accounts (for example, `drrm-platform@ormoc.gov.ph`). This is about who owns and pays for the service. It does not limit who can sign in to the app: any email address can, including personal and consultant addresses (sections 2 and 4).
- [ ] A password manager or vault for the database password and keys.
- [ ] The DPO has reviewed the privacy notice text (Settings → About) and the cross-border transfer to Singapore ([ADR-002](docs/adr/002-hosting-and-privacy.md)).
- [ ] A workstation with Node 22+, Git and `psql` (PostgreSQL 15+ client).

## 1. Create the Supabase project (City-owned)

1. Sign up at supabase.com with the City email. Create an **organisation** named "City Government of Ormoc".
2. Create a project:
   - **Name:** `ormoc-drrm`
   - **Region:** Southeast Asia (Singapore), `ap-southeast-1`
   - **Database password:** generate a long one and store it in the vault
3. Choose a **paid plan** for production:
   - Free projects pause after a period of inactivity, which is unacceptable for an EOC.
   - The paid plan includes daily backups. Add Point-in-Time Recovery if the budget allows.
4. Under Project Settings → API, note:
   - the **Project URL**
   - the **publishable key** (`sb_publishable_…`; older projects show an anon key instead). It is safe in the browser; RLS protects the data
   - the **service_role / secret key** (never put it in the app or in Git; keep it in the vault)

## 2. Configure sign-in

People create their own accounts; an administrator approves each one by granting a role (Settings → Users and roles). Until then the account sees nothing: the database returns no rows to an account without a role (migration 0009). Staff can also still be invited.

Authentication → Sign In / Providers → Email:

- **Allow new users to sign up: on.**
- **Confirm email: on.** An administrator cannot grant a role to an unconfirmed address.
- **Minimum password length: 10**, with letters and digits. Turn on **leaked password protection** if the plan offers it.

Authentication → URL Configuration:

- **Site URL:** the app address (for example, `https://drrm.ormoc.gov.ph`).
- **Redirect URLs:** add `https://<each app address>/**`: the custom domain AND the `netlify.app` address, plus `https://deploy-preview-*--<name>.netlify.app/**` if previews use this project. The app sends people back to the exact address they used; one that is not listed falls back to the Site URL and the link fails.

Authentication → Emails → Templates. Change the link in these four templates so that every link works on any device, including an iPhone home-screen app (which does not share storage with Safari):

| Template | Link |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Magic Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

With the default templates links still work, but only when opened in the same browser where they were requested.

Authentication → SMTP: **required** once sign-up is open. Set the City's mail server or a transactional mail service. The built-in sender is limited to a few emails an hour and is not meant for production.

Authentication → Rate Limits: keep the defaults or lower them. Consider **Attack Protection → CAPTCHA** (hCaptcha or Turnstile) if the sign-up form attracts spam; tell the developer, because the app must then send the CAPTCHA token.

### 2a. Sign in with Ormoc DRRM (OAuth 2.1 server), optional

Turn this on when another City system should sign people in with their Ormoc DRRM account. The design is in [ADR-010](docs/adr/010-oauth-provider-read-only-clients.md). Apps signed in this way can read what the person's role allows, and cannot change anything (migration 0010).

1. **Signing keys first.** Project Settings → JWT Keys: create an asymmetric key (ECC P-256 or RSA), and make it the current key once it has been on standby for a while. This is needed for OpenID Connect ID tokens, and lets the app check sessions on the device. Legacy shared-secret keys still work, but nothing is checked on the device.
2. Authentication → OAuth Server: **enable** the OAuth 2.1 server. Set **Authorization Path** to `/oauth/consent`. Leave **dynamic client registration off**.
3. The Site URL (section 2) plus the path must be the app's address, for example `https://drrm.ormoc.gov.ph/oauth/consent`.
4. Authentication → OAuth Apps: register each app with its name, website and **exact** redirect URI (https only). Give its developer the client ID, and the client secret only for server-side apps. Public apps (mobile, single-page) use PKCE without a secret.
5. Give the developer the endpoints. They are also listed in the app under Settings → Connected apps (administrators only):

   | | Production project |
   |---|---|
   | Authorization | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/authorize` |
   | Token | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/token` |
   | JWKS | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/jwks.json` |
   | OIDC discovery | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/openid-configuration` |

6. Test it: start a sign-in from the other app, sign in, check that the consent screen names the right app and return address, then Allow. Try a write with the app's token: it must fail with "Apps signed in with Ormoc DRRM can read records but cannot change them". Then withdraw access under Settings → Connected apps.

## 3. Create the database

There are two ways to do this. Both give the same result.

### Option A: Supabase SQL editor (no tools to install)

The SQL editor rejects long scripts, so the reference data comes in seven parts in `supabase/seed/parts/`. Each part is under 400 lines; long manual text is written on a single line.

1. **Migrations.** In SQL Editor → New query, paste and run each file in `supabase/migrations/` in name order, one at a time (`…000100_core.sql` first, `20261016000900_accounts_and_integrity.sql` last). Wait for "Success" before the next. Run each migration once only.
2. **Reference data.** Paste and run `supabase/seed/parts/01_seed.sql`, then `02_seed.sql`, and so on to `07_seed.sql`. Use the parts, not `supabase/seed/seed.sql`, which is the same data in one file for `psql`.
3. Part 7 ends with a check query. It should return **140 | 18 | 935 | 71 | 10 | 66 | 29**.
4. **Operational data (once).** Paste and run, in order, the four files in `supabase/seed/operational/`:
   - `01_iat_baseline_responses.sql`, `02_iat_baseline_evidence.sql`, `03_iat_baseline_scores_actions.sql`: the October 2026 IAT baseline as the cycle **2026 Baseline (IAT v1.1)**, with 140 provisional responses, their evidence notes and the action plan. Part 3 ends with the cycle results.
   - `04_vault_register.sql`: Document Vault entries for the engagement's source documents. Attach the files in the app afterwards.

   These are working records the City then edits in the app. Running them again never overwrites anything, and never changes a score someone has set. 27 baseline scores are loaded below the workbook score, because the evidence on record does not support them (see the note at the top of each response's Gap / Remarks).

Each part runs as a single transaction, so a part that fails changes nothing. During setup a part can be run again on its own, and it only replaces its own rows. If a part fails or you lose your place, run that part again and carry on from there. Re-running the parts is safe after go-live: manual versions are only ever added, never rewritten, and the approval status of manual sections and protocols is kept.

### Option B: `psql` from a workstation

Use the **Session pooler** connection string from Project Settings → Database (it works over IPv4). Run, in order:

```bash
export DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

for f in supabase/migrations/*.sql; do
  echo "== $f"; psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" || break
done
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed/seed.sql
# once, on a new database:
for f in supabase/seed/operational/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" || break; done
```

`psql` has no length limit, so it takes the whole seed in one file.

### Either way

Do **not** run anything in `supabase/tests/`. The stub there imitates Supabase for local testing only.

The migrations can also be applied with the Supabase CLI (`supabase link`, then `supabase db push`) if the City prefers. However they are applied, apply them in file order, once.

When the workbooks change, `npm run seed:generate` rewrites both `seed.sql` and the parts (the number of parts can change). Load all of the new parts again, in order, rather than mixing old and new ones.

Check the result:

```sql
select (select count(*) from iat_indicators)      as indicators,    -- 140
       (select count(*) from master_requirements) as requirements,  -- 18
       (select count(*) from protocol_templates)  as protocols,     -- 10
       (select count(*) from aa_action_templates) as aa_actions,    -- 29
       (select count(*) from storage.buckets where id in ('evidence', 'vault')) as buckets;  -- 2
```

Then, in the dashboard:

- **Advisors → Security.** It should report no tables without RLS.
- **Database → Publications → `supabase_realtime`.** It should list the EOC tables.

### Updating an existing database

- **To 1.1** (database created before 16 October 2026): run `supabase/migrations/20261016000800_document_vault.sql` once. It adds the Document Vault table and its private `vault` bucket.
- **To 1.2:** run `supabase/migrations/20261016000900_accounts_and_integrity.sql` once, **before** turning sign-up on (section 2). It makes accounts without a role read nothing, adds the administrator's account list, and locks finalised and approved records.
- **To 1.3** (31 October 2026): no migration. Run the reference parts `01_seed.sql` to `07_seed.sql` again (delete any old `08`–`10` part files first). They add the Chapter 1 v0.9 draft (a new version of MOO Ch.1), eight new Library documents (Annexes 1-0 to 1-G, including SOP GOV-04 and SOP GOV-05), the new protocol PR-SOC-DECLARE, and revised steps for PR-SOID-REQUEST, PR-EOC-ACTIVATE and PR-LIFT-REPORT. Then run `supabase/seed/operational/` once if the baseline has not been entered by hand.
- **To 1.4** (31 October 2026): run `supabase/migrations/20261031001000_oauth_clients_read_only.sql` once. It makes tokens issued to other apps read-only. Run it even if section 2a stays off; it is safe to run again. No seed changes.
- **85 barangays:** if the seed was loaded before the 85-barangay correction, run parts `01_seed.sql` and `06_seed.sql` once more, but only if no manual version has been approved yet. Otherwise ask the developer for a one-off update of the three indicator texts (A3.7, A7.3, B3.2).

## 4. First administrator and the CDRRMO Head

1. The City ICT administrator and the CDRRMO Head create their accounts in the app (Create an account) and confirm their email. (Authentication → Users → **Invite user** also works.)
2. In the SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'ict.admin@ormoc.gov.ph';
insert into public.user_roles (user_id, role)
select id, r::public.app_role from auth.users, unnest(array['cdrrmo_head','validator','eoc_manager']) r
where email = 'cdrrmo.head@ormoc.gov.ph';
update public.profiles set full_name = 'Full Name', position = 'CDRRM Officer' where id = (select id from auth.users where email = 'cdrrmo.head@ormoc.gov.ph');
```

From here staff create their own accounts, and the administrator approves them in the app (Settings → Users and roles): accounts waiting for approval are listed first, with the email they confirmed. Check who the person is (for example with their office) before granting a role. Declining is deactivating. A person waiting for approval sees only a waiting page.

### Platform developer access

The platform developer (Alvin M. Silva, `alvin.silva@cognitioplus.com`) needs to sign in to set up and support the platform. The access is given by the City and is time-boxed:

1. The developer creates an account in the app with `alvin.silva@cognitioplus.com` and confirms it (or the City invites that address from Authentication → Users).
2. In the SQL editor, open and run block 1 of [`supabase/admin/developer_access.sql`](supabase/admin/developer_access.sql). It sets the profile and grants `admin` for the setup period. The script stops with a clear message if the address has not been invited yet.
3. When setup ends, run block 2. It removes `admin` and keeps `author`, `assessor` and `viewer` for drafting, testing and support.
4. At turnover, run block 3. It removes every role and deactivates the account. Past entries and the audit trail stay.

The `admin` role passes every role check, including approving SOP versions and recording declaration steps. Those acts belong to City officials, so the developer does not perform them, and the City should move to block 2 as soon as setup is complete. Every change the developer makes is in the audit log.

Personal data note for the DPO: the developer's name and email are held like any staff account's (section 9).

| Role | Give to |
|---|---|
| `cdrrmo_head` | CDRRM Officer |
| `eoc_manager` | EOC Manager / Operations Section Chief and alternates |
| `eoc_staff` | EOC section staff |
| `duty_officer` | 24/7 operations centre duty officers |
| `assessor` / `validator` | Assessment team / validation panel (keep them separate people) |
| `lead_office_focal` | Focal persons of CSWDO, CHO, CEO, CPDO and other Part C lead offices (set their office in the profile) |
| `author` | Manual drafters |
| `viewer` | CDRRMC members and oversight |
| `admin` | City ICT (two people at most) |

## 5. Barangays

Sign in as admin and go to Settings → Barangays → Import CSV. Load Ormoc’s 85 barangays from the PSA PSGC masterlist, one per line. Since the PSA 4th quarter 2022 update, the former numbered Poblacion barangays are South, East and West (28 merged under City Ordinance No. 052, s. 2021, ratified on 8 October 2022), and Barangay 29 is North:

```
psgc,name,classification,population,lat,lng
083738001,Airport,urban;coastal,1234,11.05,124.56
```

Classification takes one or more of `urban`, `coastal`, `riverine` and `upland`, separated by `;`. The importer checks PSGC codes before saving.

## 6. Publish the app

### Option A: Netlify (City-owned team)

`netlify.toml` in the repository root already sets the build command (`npm run build`), the output folder (`dist`), Node 22, the single-page fallback, caching rules and the security headers. Nothing needs to be typed in the build settings.

1. Sign in to Netlify with the City email and create a team named "City Government of Ormoc".
2. **Add new site → Import an existing project → GitHub**. Authorise Netlify for the repository only (not the whole GitHub account) and pick the repository.
3. On the build screen, leave the detected settings as they are. Under **Environment variables**, add:
   - `VITE_SUPABASE_URL` = Project URL, for example `https://jmctsspadywjcbbqwweh.supabase.co` (no slash at the end)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key (`sb_publishable_…`)

   The app also accepts the older name `VITE_SUPABASE_ANON_KEY`, for projects that still use an anon key. If both are set, the publishable key is used. Never add the service_role key: the build stops if it sees a secret key. These values are built into the app, so a change needs a new deploy (Deploys → Trigger deploy → Deploy site). A deploy with a missing or mistyped value fails with a message saying which one.
4. Deploy. The site opens at `https://<name>.netlify.app`. Rename it under Site configuration → Change site name (for example, `ormoc-drrm`).
5. **Domain:** Domain management → Add a domain (for example, `drrm.ormoc.gov.ph`). Add the CNAME record Netlify shows at the City's DNS host. HTTPS is issued automatically.
6. **Supabase:** put the final address in Authentication → URL Configuration (Site URL and Redirect URLs, step 2). Sign-in links and invites fail until this matches.
7. **Previews (optional):** pull requests get deploy previews. Add their address pattern (`https://deploy-preview-*--<name>.netlify.app`) to the Supabase Redirect URLs, or point previews at a separate test Supabase project by setting different values for the "Deploy Previews" context.

Check after the first deploy:

- Open a deep link such as `/eoc/log` directly. It should load the app, not a Netlify 404.
- Look at the response headers of the home page (browser dev tools → Network). `content-security-policy` should be present.
- Create a test account from the sign-in page: the confirmation email should arrive, its link should open the app at the waiting page, and the account should appear under Settings → Users and roles for the administrator. Deactivate the test account afterwards.

### Option B: Vercel (City-owned team)

1. Create a Vercel team under the City email and import the Git repository.
2. Add environment variables for Production and Preview:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key (or `VITE_SUPABASE_ANON_KEY` on older projects)
3. Deploy. `vercel.json` sets the single-page fallback, caching and security headers, including a Content-Security-Policy that allows only this site and `*.supabase.co`.
4. Add the City domain (for example, `drrm.ormoc.gov.ph`) and update the Site URL in step 2.

### Option C: a City web server

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... npm ci && npm run build   # output in dist/
```

Serve `dist/` over HTTPS. Send unknown paths to `/index.html`. Serve `sw.js` with `Cache-Control: no-cache`. Copy the headers from `netlify.toml`. Example for nginx:

```nginx
location / { try_files $uri /index.html; }
location = /sw.js { add_header Cache-Control "no-cache"; }
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

## 7. Go-live checklist

- [ ] Sign in on an Android phone and an iPhone. Install to the home screen ("Add to Home screen").
- [ ] Turn on airplane mode, add a logbook entry, turn it off, and confirm the entry reaches the server (Settings → Sync shows nothing waiting).
- [ ] Raise the EOC to Blue and back to White on a test day. Confirm the logbook recorded both.
- [ ] Viewer account: confirm it cannot create or change records.
- [ ] A new, unapproved account: confirm it sees only the waiting page, on a phone and a computer.
- [ ] Password reset: request one and set a new password through the emailed link.
- [ ] If section 2a is on: a test app can sign in through the consent screen, cannot write, and loses access when it is withdrawn.
- [ ] Back up: confirm a daily backup exists (Database → Backups).
- [ ] Record who holds admin, the database password and the service key, in the City's ICT asset register.

## 8. Keys, access and turnover

- The anon key is public by design; RLS enforces access. The service_role key and the database password are secrets.
- **At turnover:**
  - Run block 3 of `supabase/admin/developer_access.sql` to remove the developer's app access.
  - Remove the consultant from the Supabase organisation, the Netlify or Vercel team and the GitHub repository.
  - Rotate the database password.
  - If any secret was ever shared, rotate the API keys too (Project Settings → API). Then update the two environment variables and redeploy.
- Review the roles list each quarter, and the accounts waiting for approval each week (decline ones nobody recognises). Deactivate leavers in Settings → Users and roles; their records and audit trail remain.

## 9. Data protection notes for the DPO

- **Data held.** The platform holds staff identity (name, email, position, office, roles) and institutional records. It has no fields for affected persons, evacuees, beneficiaries or informants. Free-text fields remind users of this, but mistakes are possible. Include them in the redaction procedure.
- **Audit log.** `audit_log` records every change, with who and when. Agree a retention period (for example, the same as the paper logbook under the City's records disposition schedule).
- **Evidence files.** These are private and are opened through five-minute links. Delete files no longer needed after a cycle is archived.
- **Devices.** Signing out erases the copy on a device. Lost devices: deactivate the user, then rotate their password.

## 10. Updating the platform

- **Schema changes.** Never edit a migration that has been applied. Add a new file `supabase/migrations/<timestamp>_<name>.sql`. Run `npm run test:db`, `npm run test:it` and `npm run test:e2e` locally (GitHub Actions runs them on every push), apply it to production with `psql`, then deploy the app.
- **Uploading through the GitHub website** drops file permissions and can drop hidden files (`.github/`, `.env.example`, `.gitignore`). Prefer `git push`; if you upload, check that those files are still there.
- **Reference data (IAT or traceability workbooks).** Follow the steps in the README.
- **National guidance pending under the RA 12287 IRR.** When the NDRRMC guidelines on triggers and the DBM–COA rules on AA fund use and liquidation are issued:
  - Update `aa_rules` (admin, SQL editor). Changes are audited.
  - Revise the AA checklist templates.
  - Re-validate protocols PR-PDRA and PR-LIFT-REPORT.

```sql
update public.aa_rules set value = 0.10, source_ref = 'IRR Rule V Sec. __; JMC No. __' where key = 'aa_share_of_ldrrmf_70';
```
