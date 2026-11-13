# Deployment and handover

This guide takes the platform from this repository to a running service owned by the City Government of Ormoc. The City's ICT office does each step under City accounts. The consultant may assist, but holds no production account or key after turnover.

Time needed: about half a day, plus the time to invite staff.

## 0. Before you start

- [ ] A City email account to **own** the Supabase, Netlify and GitHub accounts (for example, `drrm-platform@ormoc.gov.ph`). This is about who owns and pays for the service. It does not limit who can sign in to the app: any email address can, including personal and consultant addresses (sections 2 and 4).
- [ ] A password manager or vault for the database password and keys.
- [ ] The DPO has reviewed the privacy notice text (Settings → About) and the cross-border transfer to Japan ([ADR-002](docs/adr/002-hosting-and-privacy.md), [ADR-021](docs/adr/021-production-region-tokyo.md)).
- [ ] A workstation with Node 22+, Git and `psql` (PostgreSQL 15+ client).

## 1. Create the Supabase project (City-owned)

1. Sign up at supabase.com with the City email. Create an **organisation** named "City Government of Ormoc".
2. Create a project:
   - **Name:** `ormoc-drrm`
   - **Region:** the City's project `jmctsspadywjcbbqwweh` is in Northeast Asia (Tokyo), `ap-northeast-1` (ADR-021). A training or replacement project should use the same region
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

- **Site URL:** the app address (`https://www.mode-cddrmo-ormoc.online`; add `https://www.mode-cddrmo-ormoc.online/**` to Redirect URLs).
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

### 2a. Sign in with MODE (OAuth 2.1 server), optional

Turn this on when another City system should sign people in with their MODE account. The design is in [ADR-010](docs/adr/010-oauth-provider-read-only-clients.md). Apps signed in this way can read what the person's role allows, and cannot change anything (migration 0010).

1. **Signing keys first.** Project Settings → JWT Keys: create an asymmetric key (ECC P-256 or RSA), and make it the current key once it has been on standby for a while. This is needed for OpenID Connect ID tokens, and lets the app check sessions on the device. Legacy shared-secret keys still work, but nothing is checked on the device.
2. Authentication → OAuth Server: **enable** the OAuth 2.1 server. Set **Authorization Path** to `/oauth/consent`. Leave **dynamic client registration off**.
3. The Site URL (section 2) plus the path must be the app's address, for example `https://www.mode-cddrmo-ormoc.online/oauth/consent`.
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

The SQL editor rejects long scripts, so the reference data comes in parts in `supabase/seed/parts/` (eighteen at present). Each part is under 400 lines; long manual text is written on a single line.

1. **Migrations.** In SQL Editor → New query, paste and run each file in `supabase/migrations/` in name order, one at a time (`…000100_core.sql` first, `20261106001900_geo_cop.sql` last). Wait for "Success" before the next. Run each migration once only.
2. **Reference data.** Paste and run `supabase/seed/parts/01_seed.sql`, then `02_seed.sql`, and so on to the last part. Use the parts, not `supabase/seed/seed.sql`, which is the same data in one file for `psql`.
3. The last part ends with a check query. It should return **140 | 18 | 935 | 71 | 14 | 94 | 29 | 10 | 140 | 29** (protocols and workflows, their steps, AA items, functional areas, indicators with an area, forms).
4. **Operational data (once).** Paste and run, in order, these files in `supabase/seed/operational/`:
   - `01_iat_baseline_responses.sql`, `02_iat_baseline_evidence.sql`, `02b_iat_baseline_evidence.sql`, `03_iat_baseline_scores_actions.sql`: the October 2026 IAT baseline (workbook v1-7, 11 Nov 2026) as the cycle **2026 Baseline (IAT v1.7)**, with 140 provisional responses, their evidence notes and the action plan. Part 3 ends with the cycle results.
   - `04_vault_register.sql`: Document Vault entries for the engagement's source documents and City issuances. Attach the files in the app afterwards.
   - `06_eoc_structure.sql`: response clusters, contingency plans, EOC positions, barangay clusters and the EOC reference point.

   These are working records the City then edits in the app. Running them again never overwrites anything, and never changes a score someone has set. The scores equal the workbook: the evidence rule (Methodology 5.2) is already applied in workbook v1-6 to 15 items, each noted at the start of its Gap / Remarks. The cycle results match the workbook Dashboard: IMI 1.98, mandatory compliance 32.9%, 30 high-priority gaps.

Each part runs as a single transaction, so a part that fails changes nothing. During setup a part can be run again on its own, and it only replaces its own rows. If a part fails or you lose your place, run that part again and carry on from there. Re-running the parts is safe after go-live: manual versions are only ever added, never rewritten, and the approval status of manual sections and protocols is kept.

### Option B: `psql` from a workstation

Use the **Session pooler** connection string from Project Settings → Database (it works over IPv4). Run, in order:

```bash
export DB_URL='postgresql://postgres.<project-ref>:<password>@<pooler host from Connect, e.g. aws-0-ap-northeast-1.pooler.supabase.com>:5432/postgres'

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
       (select count(*) from protocol_templates)  as protocols,     -- 14 (10 protocols, 4 workflows)
       (select count(*) from form_templates)      as forms,         -- 29
       (select count(*) from aa_action_templates) as aa_actions,    -- 29
       (select count(*) from storage.buckets where id in ('evidence', 'vault', 'geo', 'basemap')) as buckets;  -- 4
```

Then, in the dashboard:

- **Advisors → Security.** It should report no tables without RLS.
- **Database → Publications → `supabase_realtime`.** It should list the EOC tables.

### Updating an existing database

**Moving to the new API keys (Supabase deprecates `anon` and `service_role` by the end of 2026).** The app and scripts already accept the new keys; only settings change. In Supabase → Project Settings → API Keys → *Publishable and secret API keys*, create the keys, then:
1. **App (Vercel/Netlify):** set `VITE_SUPABASE_PUBLISHABLE_KEY` to the `sb_publishable_…` key, remove `VITE_SUPABASE_ANON_KEY`, and redeploy. Sign-in and RLS behave the same. The app refuses a secret key at build time.
2. **GitHub → Settings → Secrets and variables → Actions:** secret `SERVICE_ROLE_KEY` = the `sb_secret_…` key (basemap uploads; `scripts/build_basemap.sh` sends it on the `apikey` header); variable `SUPABASE_PUBLISHABLE_KEY` = the publishable key (uptime check).
3. Not affected: `SUPABASE_DB_URL_*` (a database password, not an API key) and users' own sign-in tokens.
4. When the site, the uptime check and a basemap run all work on the new keys, turn the legacy keys off on the same page (reversible).

**Supabase's Migrations page (Database → Migrations)** lists only what is recorded in `supabase_migrations.schema_migrations`. Migrations applied in the SQL editor are not recorded there, so the page can look empty while every migration is in place (check with `migration_status.sql`). `scripts/apply_db.sh` and the "Load reference data" workflow record them on every run that is not check-only.

**One-click loading (1.19.0+, ADR-034).** Instead of pasting the seed files, use GitHub → **Actions → Load reference data → Run workflow**. It checks that every migration is applied, runs the cleanup scripts, every part in `supabase/seed/parts/` in order (including the DDRiVE `26a`–`26d` parts and `37_raci.sql`) and the IAT update, then verifies that every reference row is in the database and shows a table of the results. It stops at the first error; running it again is always safe.
- **Set up once:** add two repository secrets (Settings → Secrets and variables → Actions): `SUPABASE_DB_URL_PRODUCTION` and `SUPABASE_DB_URL_TRAINING`, each the **Session pooler** connection string from Supabase Dashboard → Connect, with the database password filled in. The pooler works over IPv4 and is free; no add-on is needed. Only the City's repository administrators should hold these.
- **Each release:** apply the release's migration first (the loader refuses to run until every migration shows "applied"). Run the workflow on **training**, check it, then on **production**: production runs only from `main` and only when you type `production` in the confirm box. Tick **Check only** to see what is missing without changing anything.
- **From a terminal instead** (Windows, macOS or Linux with `psql`; not Bolt, which cannot run native programs): `export SUPABASE_DB_URL='<Session pooler string>'` (or put a `SUPABASE_DB_URL=` line in `.env`, which git ignores), then `scripts/apply_db.sh`. It applies only the missing migrations (applied ones are never re-run), records them in Supabase's migration history, then loads and verifies the reference data. `--check-only` changes nothing; `--operational` adds the one-time operational seeds for a **new** database. It refuses the transaction pooler (port 6543).
- The workflow applies missing migrations only when **Also apply missing migrations** is ticked (off by default, in case the Supabase GitHub integration applies them on merge). The one-time operational files are never part of the workflow. The steps below remain the manual fallback through the SQL editor.

- **To 1.1** (database created before 16 October 2026): run `supabase/migrations/20261016000800_document_vault.sql` once. It adds the Document Vault table and its private `vault` bucket.
- **To 1.2:** run `supabase/migrations/20261016000900_accounts_and_integrity.sql` once, **before** turning sign-up on (section 2). It makes accounts without a role read nothing, adds the administrator's account list, and locks finalised and approved records.
- **To 1.3** (31 October 2026): no migration. Run the reference parts `01_seed.sql` to `07_seed.sql` again (delete any old `08`–`10` part files first). They add the Chapter 1 v0.9 draft (a new version of MOO Ch.1), eight new Library documents (Annexes 1-0 to 1-G, including SOP GOV-04 and SOP GOV-05), the new protocol PR-SOC-DECLARE, and revised steps for PR-SOID-REQUEST, PR-EOC-ACTIVATE and PR-LIFT-REPORT. Then run `supabase/seed/operational/` once if the baseline has not been entered by hand.
- **To 1.4** (31 October 2026): run `supabase/migrations/20261031001000_oauth_clients_read_only.sql` once. It makes tokens issued to other apps read-only. Run it even if section 2a stays off; it is safe to run again. No seed changes.
- **To 1.5** (31 October 2026): no migration. Delete the old part files, upload the new ones, and run every part in `supabase/seed/parts/` again (nine parts). They add Chapter 2 as a new version of MOO Ch.2 and 23 new Library documents (Annexes 2-A to 2-W, SOPs HR-01 to HR-08, forms HR-F01 to HR-F08). Run `supabase/seed/operational/04_vault_register.sql` again to add the Chapter 2 Vault entry. Chapter figures deploy with the app (since 1.5.1 they are in `public/library/chp2/`; see 1.6).
- **To 1.5.1** (31 October 2026): run `supabase/migrations/20261031001100_resource_request_lock.sql` once. It locks resource requests once they are decided and removes the delete grant on them. It is safe to run again. No seed changes. Then republish the app: a refused evidence upload now stays on the phone (Settings → Sync → Retry upload, Save a copy, or Discard).
- **To 1.6** (2 November 2026), one manual: 
  1. Run `supabase/migrations/20261102001200_single_manual.sql` once (safe to run again). It adds the five Parts and ten functional areas, gives Library documents an area and aliases, records each indicator's functional area, and fixes the Chapter 2 figure links in unapproved versions.
  2. Delete the old files in `supabase/seed/parts/`, upload the new ones, and run all **13** parts in order. They add the ten area outlines; rename MOO Ch.1 to Ch.3 to Chapters 1 to 3 and the annexes to "Annex 1-A" and so on (old codes stay as aliases); mark the other 15 shells and the JD annex as merged; load Chapter 1 v1.0 with Annexes 1-A to 1-H (1-H is new; 1-0 is merged into Chapter 1); load Chapter 3 with Annexes 3-A to 3-M; and point protocols at the new homes. Approved text and approval status are never changed. The last part's check should return **… | 10 | 140**.
  3. Run `supabase/seed/operational/04_vault_register.sql` again. It adds Vault entries for Chapter 1 v1.0 and Chapter 3 and leaves existing entries alone.
  4. Republish the app. Phones update their Library on the next open. Figures: `public/library/ch1/` (two flowcharts in SOPs GOV-04 and GOV-05), `public/library/chp2/` (unchanged) and `public/library/ch3/`.
- **To 1.6.1** (5 November 2026): no database change. Upload the files and redeploy. Repairs the Tools page (the 4 November edit stopped the build) and keeps its new service list.
- **To 1.6.2** (5 November 2026): run `supabase/migrations/20261105001300_barangay_report_counts.sql` once (safe to run again), then redeploy. A blank evacuation count is now stored as "not reported" instead of 0; an evacuating barangay needs both counts; persons cannot be fewer than families. The EOC board, the barangay list and "Fill from barangay reports" on a SitRep count only the current event (a past typhoon no longer adds to today's totals). Run the migration **before** redeploying: the new app sends blank counts as empty, which the old columns refuse.
- **To 1.7.0** (5 November 2026), record integrity:
  1. Run `supabase/migrations/20261105001400_record_integrity_2.sql` once (safe to run again). Only the CDRRMO Head now approves, retires or reopens protocols and Library documents; approved protocols are fixed; a draft protocol runs as a drill unless the EOC Manager or Head starts it; the IRR checklist is the Head's; the PDRA behind a requested declaration is fixed; nothing legal, financial or operational can be deleted (ADR-013).
  2. Check the grants in the SQL editor: `select has_table_privilege('authenticated', 'public.declarations', 'DELETE');` must return **false**, and so must the same query with `'TRUNCATE'`.
  3. Redeploy the app.
- **To 1.7.1** (5 November 2026): no database change. Upload the files and redeploy. One stuck change no longer holds up the others (it retries on its own, with the server's reason on the Sync screen), and signing out on a shared phone no longer deletes another person's unsent entries or photos (ADR-014).
- **To 1.8.0** (5 November 2026), crash screen, error reports, backups and CI:
  1. Run `supabase/migrations/20261105001500_client_errors.sql` once (safe to run again). It adds the `client_errors` table that receives crash reports (administrator only; Settings → Error reports).
  2. Delete `e2e/demo.spec.ts` (a pre-1.2 copy of the journeys that no longer matches the app and breaks the test order).
  3. **Push with git**, or create the two files `.github/workflows/ci.yml` and `.github/workflows/uptime.yml` in the GitHub website editor (Add file → Create new file). The upload page drops the `.github/` folder.
  4. In GitHub, Settings → Secrets and variables → Actions → **Variables**: add `APP_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the uptime check.
  5. Run `supabase/migrations/migration_status.sql` in the SQL editor: every migration should say `applied` and every grant `ok`. Keep the result.
  6. Redeploy the app. Then follow section 11 for the first backup.
- **To 1.8.1** (5 November 2026), the platform's name is **MODE** (*Manual of Operations for the DRRMO and EOC*; formally the Ormoc City DRRMO & EOC Manual of Operations Development Platform). No database change.
  1. Delete `public/brand/App_Banner.png`. It duplicates `public/App_Banner.png` and is too large for the offline cache, which **stopped the production build**. The app uses the resized copies `public/brand/app-banner-{800,1600}.{webp,jpg}`, which this release regenerates from the new banner.
  2. Upload the files and redeploy. Installed phones show the new name after the update prompt; on some phones the home-screen label changes only after reinstalling.
  3. Supabase Dashboard → Authentication → Emails: paste the six templates in `supabase/email/` again (the header and footer now say MODE).
  4. To change the banner later: replace `public/App_Banner.png` only, then run `python3 scripts/brand_assets.py` (or ask the developer) and upload the four `public/brand/app-banner-*` files.
- **To 1.8.2** (6 November 2026), Document Vault and IAT supplementary desk review. No migration, no reference-seed change, no redeploy needed.
  1. Run `supabase/seed/operational/04_vault_register.sql` again. It adds 23 Vault entries (LCCAP 2019-2030; CDP 2024-2030 Parts 1 and 2; CDRRMC Res. 01-08 s.2025 and 09-10 s.2024; EO 2024-032A, 2023-0085, 2023-0042, 2023-0041 (marked superseded), 2023-0025, 2023-0026; SP Res. 2023-112, 2023-347, 2024-088 and 2024-102) with their Drive links, and leaves existing entries alone. The check should return at least **40**. Attach the PDFs in the app (Vault → document → Attach file) if the City wants copies held in the `vault` bucket.
  2. `reference/Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-3.xlsx` now carries the 6 Nov 2026 review (15 scores changed; evidence, gaps and actions revised on 53 indicators). The baseline files `01`–`03` were regenerated from it, but they never overwrite a response that already exists. On a database that already holds the "2026 Baseline" cycle, enter the changes in the app (Assess → 2026 Baseline), attaching the Vault document as evidence for each changed score; the evidence gate needs it for any score of 3.
- **To 1.9.0** (6 November 2026), DRRM module, step forms, EOC structure and clustering, Geo-COP, Vault access, connected apps (ADR-015 to ADR-018). For the 1–4 December validation workshop.
  1. **Migrations**, once each, in this order (each is safe to run again): `20261106001600_vault_access_and_connected_apps.sql`, `20261106001700_step_forms.sql`, `20261106001800_eoc_structure_and_clusters.sql`, `20261106001900_geo_cop.sql`. They add Vault access levels and the City register of connected apps; forms and the form on every step; response clusters, contingency plans, EOC positions and designations, barangay clusters; reference points, map layers and the `geo` and `basemap` buckets.
  2. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all **18** parts in order. Parts 12 to 14 carry Chapters 1 and 2 v1.2 in pieces (the chapters are too long for one part); run them in order. The last part's check should return **140 | 18 | 935 | 71 | 14 | 94 | 29 | 10 | 140 | 29** (protocols and workflows, steps, AA items, areas, indicators with an area, forms). Approved text and approval status are never changed; the 14 templates and 29 forms load as drafts for the Head to approve.
  3. **Operational files**, in this order:
     - `04_vault_register.sql` again: adds the IAT v1.5 workbook, the EOC placemark (KML), 48 City issuances with their Drive links, and three **restricted** entries (organisational chart and two staff papers: CDRRMO Head, assessors and validators only). It leaves existing entries alone. It needs migration 1600.
     - `05_iat_v1_5_update.sql` (removed in 1.14.0; use `07_iat_v1_7_update.sql` instead): brought the "2026 Baseline" cycle from workbook v1-3 to v1-5 (71 indicators; 84 evidence notes; 27 score changes). It never changes a validated response, and changes a score only where it still equals the v1-3 import.
     - `06_eoc_structure.sql`: 10 response clusters, 7 contingency plans with their activation sets, the EOC positions, barangay clusters D1–D6 (pilots D1 and D3) and the EOC reference point (pending field validation).
     On a **new** database run `01`, `02`, `02b`, `03`, `04`, `06` instead (`02` is now in two files; `05` is not needed because `01`–`03` already carry v1-5).
  4. Run `supabase/migrations/migration_status.sql`: the four new migrations should say `applied` and every grant `ok`.
  5. **Hosting.** The CSP in `netlify.toml` and `vercel.json` now names the City project (`jmctsspadywjcbbqwweh.supabase.co`) instead of every Supabase project, and allows the map's worker. If the app talks to another project (a training copy), add its host there. Optional: `VITE_BASEMAP_URL` if the basemap is served from a City web server instead of the `basemap` bucket.
  6. **Basemap.** On a workstation with internet access: `SUPABASE_URL=… SERVICE_ROLE_KEY=… bash scripts/build_basemap.sh`. It extracts Ormoc from a Protomaps OpenStreetMap build, adds the fonts and icons, and uploads them to the `basemap` bucket. Until then EOC → Map says "Basemap not available" and still shows points and layers.
  7. Upload the files and redeploy (push with git: `.github/` must survive). Old `/protocols` links open the DRRM module.
  8. **In the app, before the workshop:** the CDRRMO Head approves the forms (DRRM → Forms) and the workflows and protocols to be exercised; the EOC Manager proposes designations (EOC → Roster) for the Head to approve; after a site check, the Head or EOC Manager records the field verification of the EOC point (EOC → Map). For the clustering exercise: raise the EOC to Blue, then EOC → Plans and clusters → CP-FLOOD-LUNOP → Activate plan.
  9. **Connected apps.** An app now reads nothing until the City approves it: create the client in Supabase (Authentication → OAuth Apps), then Settings → Connected apps → Register an app, and the administrator or CDRRMO Head approves it.
- **To 1.10.0** (8 November 2026), public pages and SEO, SOP registry, Chapter 3 in the platform, IAT v1.6 workbook, CI (ADR-019, ADR-020).
  1. **Migration**, once (safe to run again): `20261108002000_sop_registry.sql`. It adds kind, controlling SOP, process owner, policy references and IAT indicators to every protocol and workflow, plus four Chapter 3 categories and the view `v_indicator_sops`.
  2. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all **19** parts in order. The last part's check should return **140 | 18 | 935 | 71 | 23 | 161 | 29 | 10 | 140 | 40**: 23 protocols and workflows (8 protocols and 15 workflows, including the nine Chapter 3 workflows WF-SOP3-01 to 09), 161 steps and 40 forms (Forms 3-01 to 3-11 added). Chapter 3 v1.0 and Annexes 3-A to 3-N load in the Library as drafts. Approved text is never changed.
  3. **No operational file to run.** `reference/…_v1-6.xlsx` replaces `…_v1-5.xlsx`. It adds an "Evidence Validation Status" column (all *Pending validation*), the Dashboard summary tiles and a "Technical person" row in Profile. Scores, evidence and gaps are unchanged, so the baseline cycle needs no update.
  4. **Environment variables** (Netlify or Vercel, Production). All are optional and appear on public pages; none is secret:
     - `VITE_SITE_URL`: canonical address. It defaults to `https://www.mode-cddrmo-ormoc.online` (the City domain since 8 Nov 2026); set it only for another host, such as a training copy.
     - `VITE_SUPPORT_EMAIL` (default `mode-support@asilvainnovations.com`), `VITE_DPO_EMAIL` (default `cdrrmo.ormoccity@gmail.com`) and `VITE_BUSINESS_ADDRESS`.
     - `VITE_NPC_REGISTRATION`: only if the City's NPC registration covers this system.
     - `VITE_POLICY_EFFECTIVE` and `VITE_POLICY_OWNER`: set both **after** the City Legal Office and the DPO approve the policies. Until then the policies say "Draft, not yet approved".
  5. **Push with git.** This release adds `.github/workflows/ci.yml` (typecheck, unit tests, build and the SQL suite on every push). The GitHub upload page drops it.
  6. Upload the files and redeploy. Then check:
     - `/` shows the public home page and `/today` the workspace.
     - `/robots.txt` lists the public pages, and `/sitemap.xml` exists when `VITE_SITE_URL` is set.
     - A workspace address answers with the `x-robots-tag: noindex, nofollow` header.
     - An installed phone opens at Today (reinstall if it still opens the home page).
  7. Old bookmarks to `/` now open the public home page. Signed-in people get "Open workspace" there. Tell staff the new Today address.
- **To 1.12.0** (10 November 2026), operational clarity. No migration, no seed change.
  1. **Workflow flow diagrams** (DRRM → Workflows, open any workflow): the Steps tab now draws the sequence
     as a vertical flow — numbered nodes on a spine, critical steps in red, due targets and note requirements
     as badges, and each step's form as a connector chip that opens the form in DRRM → Forms.
  2. **Workflow ↔ Form linking both ways.** The Forms page "Used by" list now links each entry back to the
     owning workflow or protocol at the right step in its flow diagram; field options (select/multiselect
     dropdowns) show as option chips with counts, and field detail states ranges and length limits.
  3. **Library reorganization.** The Manuals tab now follows the Manual's own structure: five Parts with
     their summaries, ten functional areas as sub-groups (each linking to the Manual's area introduction),
     chapters/SOPs/forms/annex kind chips, and the legacy EOC Manual in its own section (ADR-012).
  4. Upload the files and redeploy. Then check: open WF-SOP3-06 (or any workflow) and confirm the flow
     diagram renders and the form chip opens the form; open a form used by several steps and confirm each
     "Used by" row opens its workflow; open Library → Manuals and confirm Part/Area grouping and search
     still find "EOC Ch.2" and "area 4".

- **To 1.12.1** (10 November 2026), DDRiVE risk-intelligence base layer (ADR-024). The QRE desk
  assessment is renamed DDRiVE — Data-Driven Risk and Vulnerability Estimation — and ingested
  read-only; QRE remains only in historical file names.
  1. **Migration** (safe to run again): `supabase/migrations/20261110002100_ddrive_base.sql`. Nine
     `ddrive_*` reference tables plus `v_ddrive_city_risk`, which computes each desk score's band
     from the 25-band matrix (bands are never stored). RLS: any active user reads; only admin writes.
  2. **Reference data.** Run seed part `supabase/seed/parts/26_ddrive.sql` (from 1.12.2: parts `26a`-`26d`) after parts 1-25 (it is
     generated by `scripts/ddrive_seed.py` from the DDRiVE workbook; the two 9-digit PSGC typos in
     sheet 04 are resolved to the 10-digit codes during generation). Its check must return
     **85 | 85 | 85 | 85 | 85 | 85 | 10 | 25 | 31**. Parts 1-25 stay unchanged. Devices pick the
     new tables up on the next sync (Dexie v5); no action on devices beyond updating the app.
  3. **Push with git** (never the web upload): new/changed files only — the migration, seed part 26,
     `scripts/ddrive_seed.py`, `src/domain/ddrive.ts` (+ parity test), `src/features/eoc/RiskPage.tsx`,
     `src/features/eoc/{labels,routes}.tsx`, `src/components/CommandPalette.tsx`, `src/types.ts`,
     `src/lib/{db,tables}.ts`, `docs/adr/024-*`, `docs/system-design.md`, the SQL suite, `DEPLOY.md`.
  4. Upload the files and redeploy. Then check:
     - EOC → Risk opens with the ten-hazard city picture (Riverine & flash flood at H · High);
     - the barangay filter by hazard narrows the list, and a profile sheet shows flood, hazards,
       vulnerability and priority with "—" for fields not yet assessed;
     - the SQL suite (`npm run test:db`) passes its new DDRiVE checks.

- **To 1.19.0** (13 November 2026), interactive RACI board (ADR-033). One migration (0029), one new seed part.
  Apply 1.18.0 first.
  1. **Migration.** Run `supabase/migrations/20261113002900_raci_board.sql`. It adds `raci_matrices`,
     `raci_activities` and `raci_assignments` (reads for every active user; writes only for the CDRRMO Head and
     admin) and the `v_raci_board` view. Then run `supabase/migrations/migration_status.sql`: expect 29 rows, all applied.
  2. **Reference data.** Run the new part `supabase/seed/parts/37_raci.sql` after part 36 (the `26a–26d` DDRiVE
     parts stay where they are). It seeds every RACI matrix of the consolidated Manual Draft 1.0 verbatim —
     Annex 1-F matrices 6.1–6.5, the chapter matrices of Chapters 1–10 (Ch.1 §8.3/§8.4; Ch.2 §16, Table 2.5 and
     §22.1; Ch.3 §18; Ch.4 Table 4.34 and Annex 4-B; Ch.5 Table 5.33 and Annex 5-B; Ch.6 Table 6.36; Ch.7
     Table 7.34; Ch.8 Table 8.28; Ch.9 Table 9.25; Ch.10 Table 10.20) and the manual document review matrix
     (DOC): 21 matrices, 228 activities, 1,445 assignments, 60 activities linked to their protocol or workflow.
     Re-running it is safe: it updates matrix titles only, adds activities new to the Manual,
     and seeds assignments only for an activity that has none, so the CDRRMO Head's edits and removals stay as
     they are. (Exception: if the Head removes **every** assignment of an activity, a re-run seeds that
     activity's Manual assignments again.)
     If the pre-review copy of the migration was already run, run the migration again: it adds `app.guard_raci`,
     and `migration_status.sql` shows `raci_board` as missing until it is there.
  3. **App.** Push with git and redeploy.
     - **Today** shows a RACI board card (activities mapped, Accountable checks outstanding) and a quick action.
     - **/raci** is the board: search by activity, actor, protocol code or SOP; duties are colour-coded
       (R navy blue, A dark green, C gold, I white); activities without exactly one Accountable carry a warning —
       the seeded zero- or multi-Accountable rows warn by design, faithful to the Manual's draft matrices
       (Annex 1-F and the chapter drafts), for the CDRRMO to resolve at the validation workshop.
     - **Protocol detail → SOP control** links to the protocol's RACI; **Library → document** shows its review and
       approval RACI and links to the board.
     - The **CDRRMO Head** (or admin) adds, edits and removes assignments on the board; these are authority actions
       and need a connection (ADR-006).
  4. Check: `/raci` opens with twenty-one matrices (Annex 1-F, Chapters 1-10, DOC); searching `PR-PDRA` shows "Convene PDRA" with CDRRMO A/R; a viewer
     sees no Add or edit controls; the Head's edit appears after redeploy only when online.

- **To 1.18.0** (12 November 2026), Chapters 5–8 published (ADR-032). No migration; one cleanup script before the
  seed. Apply 1.17.0 first.
  1. **Cleanup.** Run `supabase/cleanup/1.18.0_renumber.sql` in the SQL editor. It removes what the renumber
     abandons: the legacy `MOO Ch.9` partnerships outline doc (its code now carries drafted Chapter 8), its skeleton
     version and links, and the renamed financing templates `WF-SOP5-03/06/08/09/10` with their steps. Everything else
     renumbers **in place by deterministic id** — doc rows keep their ids under new codes, and the old Chapter 5
     financing v1.0 version id is reused for the Recovery v1.0 text (the financing v1.0 is superseded by Chapter 6
     v1.1 per its revision record; recover it from git at tag `v1.17.0` if ever needed).
  2. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all **40** parts in
     order. The last part's check changes (protocols/workflows and their steps grow with the new chapters):
     **140 | 18 | 935 | 71 | 54 | 329 | 29 | 10 | 140 | 59**.
     - **Chapter 5 "Recovery, Rehabilitation and Build Back Better" (v1.0)** enters the Library with Annexes 5-A to
       5-E (traceability, recovery RACI, pre-disaster recovery framework outline, REC-F06 monitoring matrix fields,
       minimum recovery baseline data). Proposed templates: `WF-REC-FRAMEWORK` (SOP 5-01), `PR-PDNA` (SOP 5-02).
     - **Chapter 6 "DRRM Financing, Resource Management and Accountability" (v1.1)** replaces the Chapter 5 financing
       draft (v1.0 was seeded 12 Nov under working number 5; renumbered per the chapter's own revision record). SOPs
       are 6-01 to 6-12; templates renumbered `WF-SOP5-xx` → `WF-SOP6-xx` (protocol codes `PR-QRF-USE`, `PR-AA-FUNDS`,
       `PR-EMERGENCY-PROCURE` unchanged; their SOP references are 6-04/6-05/6-07). SOP 6-11 runs on `WF-BUDGET-CYCLE`
       (with SOP 6-01); **SOP 6-12 is new** (`WF-SOP6-12`). Annexes 6-A to 6-D.
     - **Chapter 7 "Monitoring, Evaluation, Knowledge Management and Continuous Improvement" (v1.0)** with Annexes 7-A
       to 7-E. Proposed templates: `WF-SOP7-01`, `PR-AAR` (7-04), `WF-SOP7-05`, `WF-SOP7-07`, `WF-SOP7-08`, `WF-SOP7-09`;
       SOPs 7-02/7-03 run on the MODE Assess module, 7-06 on `PR-LIFT-REPORT`.
     - **Chapter 8 "Stakeholder Engagement and Institutional Partnerships" (v1.0)** with Annexes 8-A to 8-D. Proposed
       templates: `WF-SOP8-01/02/04/05/06/07/08`, `PR-MUTUAL-AID`, `PR-AUGMENT-REQUEST`.
     - **Introduction v1.1** (the drafting team's official draft, `00_Introduction_v1.1.docx`): purpose, city and
       risk context, legal and policy basis, structure, the assessment-informed method and systems diagnosis
       (§5 — §§5.1–5.3 baseline with the 32.9% Mandatory-compliance figure and §5.4–5.5 the shifting-the-burden
       diagnosis and MR leverage points, the sections Chapters 6 and 7 cite) and §7 systems thinking/TQM.
       Seeded without its document-control/approval machinery per the City: the Introduction is front matter,
       not a chapter — code `Introduction`, `chapter_no` NULL (doc id unchanged; Library sorts it first).
       All versions load as drafts; the CDRRMO Head approves.
  3. **App.** Push with git and redeploy. UI change beyond the new Library content and templates: the Library
     chapter sort treats `code = 'Introduction'` (chapter_no NULL) as front matter that sorts before Chapter 1.
  4. **Deferred with this release** (recorded in ADR-032): the workbook "Feeds Manual Chapter" column still shows the
     pre-compilation numbers (a full 140-row renumber sweep belongs to a workbook revision; the seed remaps the four
     affected chapter codes at build time); template-code **aliases** (`WF-SOP5-xx` → `WF-SOP6-xx`) are not yet stored
     (no aliases column on `protocol_templates` — platform is pre-go-live so no run data references the old codes; a
     registry migration can add alias support later); the Chapter 6 platform note's **resources-table fields** (holder
     type, commitment reference, reorder point, expiry) and Chapter 7's **event/loss tables** need schema migrations and
     are not built in 1.18; the **18 Manual forms** that Chapters 5–8 name on steps but have no template yet
     (`LOG-F03`, `ME-F01..F05/F07..F09`, `PTN-F01..F07`, `REC-F01`, `REC-F03`) — those 22 steps close on
     `STEP-RECORD` until each form is built (`npm run seed:generate` lists them). The step text still names the form.
  5. **Pre-check before step 1 (live database).** The cleanup deletes five templates, and `protocol_runs.template_id`
     has no cascade: if any drill or run was started on `WF-SOP5-03/06/08/09/10`, the cleanup stops and rolls back as a
     whole. Check first: `select t.code, count(*) from protocol_runs r join protocol_templates t on t.id = r.template_id
     where t.code like 'WF-SOP5-%' group by 1;` — no rows means it is safe to run.

- **To 1.17.0** (12 November 2026), platform coherence: Cebuano UI, pillar-colored Library, Pareto dashboard on
  Today, Introduction chapter with the manual cover, citation corrections (ADR-031). **No migration.** Apply 1.16.0 first.
  1. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all parts in order
     (`01` to `27`, with `26a` to `26d` after `26_seed.sql`). The last part's check is unchanged:
     **140 | 18 | 935 | 71 | 36 | 250 | 29 | 10 | 140 | 59**.
     - **Chapter 0 "Introduction" (v1.0)** enters the Library: purpose, organization (ten-chapter roadmap, five Parts,
       ten functional areas, four DRRM pillars), and the assessment method stated once, with the manual cover. Chapter 4
       is retitled **"Early Warning, EOC Activation, Incident Management and Emergency Response"** (ADR-031).
     - Citation corrections in the reference data: **NDRRMC Memorandum No. 131, s. 2018** (the issuance is a Memorandum,
       not "MC 131" or a Memorandum Circular) in the B1.1/B1.2 indicator bases and the Chapter 1 drafts; the B1.2 basis
       now names the National Disaster Response Plan and RDRRMC VIII Res. No. 12-006, s. 2023 alongside Memorandum 131.
     - Existing manual versions are not rewritten by a re-seed (the Library workflow owns them once loaded); new
       installs get the corrected texts. Indicator bases and document titles do update.
  2. **App.** Push with git and redeploy.
     - **Today** opens with a dashboard: the Pareto priority set (Tiers 1–3, 23 indicators) with live met counts from
       the current IAT cycle; tapping a gap opens the indicator in Assess. Manual readiness now counts the Introduction.
     - **Settings → This device → Language** offers Cebuano (Bisaya) for the navigation and dashboard chrome; the
       manual, legal texts and tooltips stay in English so citations remain exact.
     - **Library** blocks carry the four DRRM pillar colors and chips (prevention / preparedness / response / recovery)
       as visual separators for chapters and functional-area files.
     - Tools → Gawad KALASAG uses the **CY 2026** tiers (Gold ≥ 2.50, Silver 2.00–2.49, Bronze 1.50–1.99, per OCD
       Memorandum No. 763, s. 2026 applying NDRRMC MC No. 3, s. 2025).
  3. **Asset.** `public/moo-cover.webp` serves the manual cover at `/moo-cover.webp` (the Introduction renders it).

- **To 1.16.0** (12 November 2026), ECHO and Hazard maps in Assess (ADR-030). One migration (0028). Apply 1.15.0 first.
  1. **Migration.** Run `supabase/migrations/20261112002800_echo_camp_management.sql`. It extends `evacuation_centers` into the
     City's evacuation-centre inventory and adds `camp_reports` (aggregate, append-only) and `camp_feedback`. Then run
     `supabase/migrations/migration_status.sql`: expect 28 rows, all applied. No seed change.
  2. **App.** Assess → **Hazard maps** (moved from the EOC; old links redirect): the map is full width with a Full screen
     button; layers and instructions are under the map. Tools → **ECHO**: Simulator, Evacuation intelligence, Camp
     management and EOC dashboard. The EOC board shows an "Evacuation centres (ECHO)" card; the SitRep editor has
     "Add ECHO camp figures".
  3. **Inventory.** EOC staff add each evacuation centre in Tools → ECHO → Camp management (capacity, covered area, WASH
     counts, location, RA 12076 items). The CDRRMO Head or the EOC Manager records the field verification. Training sites
     stay in exercises.
  4. Push with git, redeploy, then check: `/eoc/hazard-maps` opens Assess → Hazard maps; Tools → ECHO opens on
     "Simulation: training only"; a duty officer cannot choose "Opening" in a camp report.

- **To 1.15.0** (12 November 2026), validation workshop kit and Chapter 5 (ADR-029). One migration (0027). Apply 1.14.0 first.
  1. **Migration.** Run `supabase/migrations/20261112002700_validation_workshop.sql`. It adds four columns to IAT responses
     (who last scored, the validation decision, the reason, the submitted score) and the view `v_validation_progress`.
     From now on the server refuses a validation by the person who last scored the indicator, refuses a changed score
     without a reason, and refuses entering a score straight as validated. The 140 baseline responses keep their scores
     and stay "For validation". Then run `supabase/migrations/migration_status.sql`: expect 27 rows, all applied.
  2. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all parts in order
     (`01` to `27`, with `26a` to `26d` after `26_seed.sql`). The last part's check should return
     **140 | 18 | 935 | 71 | 36 | 250 | 29 | 10 | 140 | 59**:
     - Chapter 5 v1.0 (DRRM Financing, Procurement and Resource Accountability) with Annexes 5-A to 5-C in the Library.
       An earlier load had marked the old "MOO Ch.5" shell superseded; the seed now returns a superseded shell to draft
       when it has become a written chapter (Chapters 4 and 5). Draft, review and approval states are not touched.
     - 36 workflows and protocols (8 new: WF-SOP5-03, PR-QRF-USE, PR-AA-FUNDS, WF-SOP5-06, PR-EMERGENCY-PROCURE,
       WF-SOP5-08, WF-SOP5-09, WF-SOP5-10). WF-BUDGET-CYCLE now carries SOPs 5-01 and 5-02 (10 steps).
     - 59 forms (nine new: FIN-F01 and FIN-F04 to FIN-F11; FIN-F02 and FIN-F03 are BUD-F01 and BUD-F02).
  3. **Validators.** Give the validator role (Settings → Users and roles) to each CDRRMO position the Head designates
     for the workshop. The lead assessor does not validate baseline items (Methodology v1.1 §6.1 rule 7).
  4. **App.** Assess → cycle → **Validation workshop**: progress by part and domain, agreement rate, a queue; **Validation
     sheets** prints one domain per page; **Results board** for the room screen. On an indicator, a validator sees
     "Validate as scored" or, after changing the score, "Validate with this change" with a reason field.
  5. Push with git, redeploy, then check: Library → Chapter 5 opens to its 9 workflows and protocols (SOPs 5-01 to 5-10); Assess → Validation workshop shows
     0 of 140 validated; a scorer trying to validate their own score sees the refusal message.

- **To 1.14.0** (12 November 2026), one baseline figure, Hazard maps, Library by chapter and DRRM thematic areas.
  One migration (0026) and one update script. Apply 1.13.0 first (migration 0025).
  1. **Baseline: one figure everywhere.** IAT workbook v1-7 (11 Nov 2026) is the only baseline: the
     evidence rule (Methodology 5.2) is applied in the workbook to 15 items (11 FGD-only items capped at 2;
     4 items without a test set from 4 to 3). Of the 27 items first counted as FGD-only, 24 still rest on FGD
     alone, and all 24 are at 2 or lower. **IMI 1.98 (Developing)**, Part A 2.06, Part B 1.85, mandatory compliance
     32.9%, 30 high-priority gaps, Interface Index 1.41. Chapters 1 and 2 and Figure 1.1 now quote these figures.
  2. **Assess: no reset, update in place to IAT v1.7.** Run migration `20261112002600_revoke_anon_execute.sql`,
     then `supabase/seed/operational/07_iat_v1_7_update.sql` (generated by `scripts/iat_update_sql.py`). It renames the
     cycle "2026 Baseline (IAT v1.1)" to **"2026 Baseline (IAT v1.7)"** and updates 15 notes and 2 evidence texts and
     retracts 1 evidence note (A8.5's re-attributed site observation; its score of 3 rests on three approved
     documents). A value changes only where it still equals the earlier import; validated responses and anything
     entered in the app are left alone. No score changes: the 140 scores already equal workbook v1-7. Its last query
     lists any score the evidence does not support: expect no rows. Safe to run again. Tested: a database loaded with
     the earlier seed and then this script is identical to a fresh v1.7 load.
     The workbook is now **v1-7** (`reference/..._v1-7.xlsx`): the 11 Nov update of v1-6, renamed so the version is
     not confused with the original v1-6.
  3. **Reference data.** Re-run all seed parts in order (Chapters 1 and 2 changed). Devices reload on their next sync.
  4. **App.** EOC → **Hazard maps** (ADR-028): eight official hazard sheets fitted to their grids, the OCHA COD-AB
     barangay boundaries, DDRiVE colouring, identify (with the nearest EOC places), GeoAnalyticsPH embedded for barangay-level assessment,
     distance and area, coordinates in WGS 84 and UTM 51N, and PNG export. The sheets and boundaries are static files
     in `public/geo/`, cached on first use. **Library** lists the written chapters, each opening to its SOPs, forms
     and annexes. **Workflows and Protocols** are grouped by the four DRRM thematic areas. One status colour code
     throughout: Draft (ochre), For validation (blue), Approved (green).
  5. **Emails.** After the deploy is live (the images load from the City domain), paste the six templates in
     `supabase/email/` into Supabase → Authentication → Emails. Each now carries the CDRRMO seal, the MODE banner and
     a "MODE ·" title; the footer links to www.mode-cddrmo-ormoc.online. Suggested subjects: "MODE: Confirm your email
     address", "MODE: You are invited", "MODE: Your sign-in link", "MODE: Confirm your new email address", "MODE: Reset
     your password", "MODE: Verification code". The images are PNG and JPG (`public/brand/cdrrmo-seal-128.png`,
     `app-banner-800.jpg`) because Outlook does not show WebP.
  6. **Security (C11).** Migration `20261112002600_revoke_anon_execute.sql` (step 2). Headers: `geolocation` is allowed
     for the app and for GeoAnalyticsPH, and `frame-src` allows only GeoAnalyticsPH. Dependencies updated (React
     Router 6.30.6, DOMPurify 3.4.17; Vite 5.4.21, Vitest 2.1.9 and PostCSS 8.5.32 for development).
  7. **Hosting.** One Vercel project (`ormoc-drrmo-eoc`). The uptime check runs by default every six hours; set the
     repository variable `UPTIME_ENABLED` to `false` to pause it. The basemap workflow skips without its secrets.
  8. Push with git, redeploy, then check: Assess shows "2026 Baseline (IAT v1.7)" with IMI 1.98; EOC → Hazard maps opens with the
     flood sheet; clicking in San Juan reads "about Very high" for flood; Library → Chapter 2 opens to 8 SOPs.

- **To 1.13.0** (11 November 2026), scoring band fix, the evidence validation status and the RA 12287 IRR
  alignment. Three migrations and three seed re-runs. Apply 1.12.2 first if it is not applied.
  1. **Migrations** (safe to run again), in order:
     - `supabase/migrations/20261111002300_band_unrounded.sql`: `v_domain_results` and `v_cycle_results`
       now band the unrounded maturity index, as the workbook does (an index of 2.495 is Developing,
       although it displays as 2.50). The index shown is unchanged. No 2026 baseline figure changes.
     - `supabase/migrations/20261111002400_evidence_check.sql`: adds the IAT v1-6 **Evidence Validation
       Status** to each response (`evidence_check`: Pending validation, Verified, Partially verified,
       Unverified, Missing evidence; every existing response starts Pending, as in the workbook).
       Only assessors, validators and the CDRRMO Head record it; a lead-office focal cannot verify its
       own Part C evidence. Who and when are stamped by the server. The check never changes the score.
     - `supabase/migrations/20261111002500_ra12287_alignment.sql` (ADR-025): the anticipatory action
       rules now follow the certified IRR of RA 12287. Lead time is counted in **days**: a declaration
       needs at least three (3) days, extendable to five (5) (Sec. 6(b); IRR Rule II Sec. 3), and the
       lead time is checked again when the Mayor signs. Tranches (≤30% beyond 3 days, ≤70% within) apply
       to hydrometeorological and geological hazards only (IRR Rule V Sec. 2); drought waits for the
       NDRRMC operational guidelines; agency, donor and ODA funds are not split. AA spending is checked
       against the year's allocation (≤10% of the 70% LDRRMF). Lifting: automatic when the hazard
       occurs (Sec. 7; record when), or by the Mayor on RDRRMC recommendation when impacts are not met
       (record the reference). The 45-day OCD report runs from the lifting. Each hazard gets a family
       (`hazards.aa_family`).
  2. **Seed re-runs** (all idempotent), after the migrations:
     - `supabase/seed/parts/04_seed.sql`: hazards with their family (the migration already sets
       the families and the `aa_rules` day keys; this keeps the seed and the database the same).
     - `supabase/seed/parts/26a_ddrive.sql`: restores the former barangay names of South (Districts 1-8,
       12, 13, 15, 17, 23, 27) and West (14, 19-22, 24, 26). Its check still returns 85 | … | 31.
     - `supabase/seed/operational/04_vault_register.sql` (item 7 below).
     Parts `01`, `02` and `02b` of `seed/operational` were regenerated from IAT v1-6 (A3.6 and A7.4
     evidence text; the A8.5 site evidence removed) but do not re-run them on production: 1.14.0's
     `07_iat_v1_7_update.sql` applies these changes safely, including the A8.5 retraction.
  3. **Vault files.** CDRRMO and EOC staff attach the 81 files of the 9 Nov 2026 issuance bundle in the app,
     with `docs/vault-attach-checklist.md` (one line per file, grouped by year; no keys or scripts). An attached
     file is never replaced. The bulk script was removed in 1.14.0: it needed the service-role key.
  4. **App.** Assess → an indicator → Evidence has an "Evidence check" control; the cycle overview
     shows the five counts (as on the workbook Dashboard) and the CSV export has an "Evidence check"
     column. Devices pick up the new fields on their next sync; no Dexie schema change.
  5. **CI** runs the SQL suite on Postgres 17, the version the City's project runs (17.11).
     Push `.github/workflows/ci.yml` with git; the web upload drops `.github/`.
  6. Push with git, redeploy, then check: `migration_status.sql` lists the three migrations as applied;
     open EOC → Anticipatory action and check that the PDRA shows the lead time in days;
     open any indicator as an assessor, set "Evidence check" to Verified and save; the overview's
     Verified count goes up by one and the score is unchanged.
  7. **Vault register.** Re-run `supabase/seed/operational/04_vault_register.sql` (idempotent). It adds three
     documents that were in the 9 Nov 2026 issuance bundle but not in the register: **EO No. 151, s. 2021**
     (reorganizing the CDRRMC; signed but undated, received by the CDRRMO 19 Mar 2021, number partly
     handwritten), **CDRRMC Res. No. 13, s. 2021** (adopting Proclamation No. 1267, Typhoon Odette) and
     **CDRRMC Res. No. 08, s. 2023** (PHP 4,307,225.13 supplemental appropriation). The "Executive orders for
     2021 — NOT OBTAINED" record is kept and marked superseded by EO No. 151. The register now holds 127 distinct documents (the generator also stops writing 16 documents twice; the database never held them twice).
  8. **`migration_status.sql`** now prints the migration list last, so the SQL editor (which shows only the
     last result) shows it.
  9. **Never run `supabase/tests/*.sql` on a Supabase project.** They build a fake platform (roles, `auth`
     schema, test users) for CI and local testing only; Supabase refuses the stub at `auth.users`.

- **To 1.12.2** (11 November 2026), production readiness audit fixes. One migration, no seed change,
  no app screen change.
  1. **Migration** (safe to run again): `supabase/migrations/20261111002200_ddrive_grants.sql`. It makes
     `v_ddrive_city_risk` a `security_invoker` view like every other MODE view, gives active users
     read-only access to the nine `ddrive_*` tables, and removes every privilege for signed-out
     visitors. The DDRiVE layer was readable through the view without signing in, and writable by
     any signed-in account at the grant level (RLS still refused the rows).
  2. **Remove the duplicate workbook**: delete `reference/Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1.5.xlsx`
     (keep it in Drive). `npm run seed:generate` needs exactly one IAT workbook and now regenerates the
     committed parts 01-25 unchanged.
  3. **Seed pipeline.** Part 26 (DDRiVE) was 240 KB, too large for the Supabase SQL editor
     ("request entity too large"). It is now four parts, each under 90 KB like parts 1-25:
     `26a_ddrive.sql`, `26b_ddrive.sql`, `26c_ddrive.sql`, `26d_ddrive.sql` (delete `26_ddrive.sql`).
     Run them in order after parts 1-25; they load exactly the same rows, and re-running is safe.
     The last one ends with the check **85 | 85 | 85 | 85 | 85 | 85 | 10 | 25 | 31**.
     `scripts/ddrive_seed.py` now writes the parts this way. `scripts/generate_seed.py` no longer
     deletes them, and `scripts/db_test_reset.sh` loads them after `seed.sql`, so the CI SQL suite
     passes (272 checks; it failed on 1.12.1).
  4. **`.env.example`** is back. It lists every `VITE_` setting the app reads, with placeholders only.
  5. **Live database check (read-only).** `supabase/admin/live_audit.sql` reports reference and DDRiVE
     counts, RLS coverage, anon policies, delete grants on legal records, definer functions without a
     fixed `search_path`, storage buckets, account and role counts (no names), the IAT results per
     cycle, crash reports and extensions. Run `migration_status.sql` and then this file in the SQL
     editor, or from a City ICT computer with psql:
     `export DATABASE_URL='<session pooler string>'; export PGPASSWORD='…'; bash scripts/live_audit.sh`.
     The script forces a read-only session and refuses the transaction pooler.
     **Which connection string:** the app itself needs none (it uses the project URL and publishable
     key through the API). For psql, pg_dump and this audit use the **session pooler**
     (`aws-0-ap-northeast-1.pooler.supabase.com:5432`, user `postgres.<project-ref>`): it works on
     IPv4. The direct connection needs IPv6; the transaction pooler (port 6543) is for serverless
     functions, which MODE does not use (ADR-001). Never put the database password or the secret key
     in the repository, in a `VITE_` variable, or in Vercel's browser environment.
  6. Push with git, redeploy, then check: `migration_status.sql` lists
     `20261111002200_ddrive_grants | applied`; EOC → Risk still opens for a signed-in viewer.

- **To 1.11.1** (10 November 2026), build and governance fixes on 1.11.0: restores the missing `src/lib` modules and
  fixes the restored component kit so `main` builds clean; rebuilds `supabase/seed/seed.sql` from the 25 parts (the 1.11.0
  parts were never assembled); updates the stale SQL-suite expectation (13 protocols, 15 workflows); removes the stale
  `src/lib/DocumentPage.tsx`/`LibraryPage.tsx` duplicates; restores `.env.example`; removes the duplicate IAT workbook,
  the duplicated `reference/` root files and `DELETE.txt`; approves the public policies (City Legal Office and DPO,
  snapshot 10 Nov 2026); adds `docs/runbook-backup-restore.md`, `docs/ict-asset-register.md`,
  `docs/security-assessments.md`; adds CI (`.github/workflows/ci.yml`), the basemap build workflow and the uptime check;
  extends the Vault register with the 9 Nov 2026 issuance bundle (CDRRMC 2016-2025, EOs 2016-2024) and explicit
  NOT OBTAINED records (CDRRMC 2017-2018; EOs 2018, 2020, 2021, 2025, 2026; SP 2025). No migration. Re-run
  `supabase/seed/operational/04_vault_register.sql` (idempotent) to load the new Vault entries.

- **To 1.11.0** (8 November 2026), Chapter 4 in the platform, owners aligned with Chapter 2, Chapter 3 v1.1, the component kit and appearance, search, Error reports, Tokyo region, City domain (ADR-021, ADR-022, ADR-023). If 1.10.0 was never applied, do its steps 1, 3, 4 and 5 first, then use this release's seed parts instead of its 19.
  1. **No new migration** beyond `20261108002000_sop_registry.sql` (1.10.0).
  2. **Reference data.** Delete every file in `supabase/seed/parts/`, upload the new ones, and run all **25** parts in order. The last part's check should return **140 | 18 | 935 | 71 | 28 | 197 | 29 | 10 | 140 | 50**:
     - 28 protocols and workflows: 13 protocols and 15 workflows. The five new protocols are PR-WARNING-RECEIPT, PR-ICS-INTERFACE, PR-EVACUATION, PR-RESOURCE-REQUEST and PR-EOC-DEACTIVATE, carrying SOPs 4-01, 4-05, 4-06, 4-07 and 4-09.
     - 197 steps and 50 forms (ten Chapter 4 forms).
     - The Library adds Chapter 4 v1.1 with Annexes 4-A to 4-D, Chapter 3 v1.1, and the proposed SOP 6-GIS-01 under Area 6.
     - HR-05 and HR-06 now name the owners Chapter 2 names.
     - Approved text is never changed.
  3. **Supabase Auth** (Authentication → URL Configuration): Site URL `https://www.mode-cddrmo-ormoc.online`; add `https://www.mode-cddrmo-ormoc.online/**` to the Redirect URLs. Keep the old address there until the domain is live.
  4. **Hosting:** add the domain `www.mode-cddrmo-ormoc.online` (section 6). `VITE_SITE_URL` now defaults to it.
  5. **Push with git**, because the GitHub upload page truncates large files. This release restores two originals: `public/Ormoc_CDRRMO_Logo.png`, which was cut off at exactly 2 MiB on `main`, and `public/App_Banner.png`, which was missing. It also adds `.github/workflows/basemap.yml`. A unit test now fails if a brand original is incomplete.
  6. **Basemap.** Add the repository secrets `SUPABASE_URL` and `SERVICE_ROLE_KEY` (Settings → Secrets and variables → Actions). Then go to Actions → *Build City basemap* → Run workflow. It builds on GitHub's servers and uploads to the `basemap` bucket. If the file is over 50 MB, raise the project's global file size limit (Storage → Settings) or run the workflow with zoom 14.
  7. **Upload the files and redeploy.** Then check:
     - the appearance switch (rail, Today, Settings and public pages) changes light and dark;
     - Ctrl+K opens search;
     - Settings → Error reports lists reports for an administrator;
     - Settings → Interface components shows every component.
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
5. **Domain:** Domain management → Add a domain (`www.mode-cddrmo-ormoc.online`). Add the CNAME record Netlify shows at the City's DNS host. HTTPS is issued automatically.
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
   - optional public-page values: `VITE_SITE_URL`, `VITE_SUPPORT_EMAIL`, `VITE_DPO_EMAIL`, `VITE_BUSINESS_ADDRESS`, `VITE_NPC_REGISTRATION`, `VITE_POLICY_EFFECTIVE`, `VITE_POLICY_OWNER` (section 3, "To 1.10.0")
3. Deploy. `vercel.json` sets the single-page fallback, caching and security headers, including a Content-Security-Policy that allows only this site and the City's own Supabase project (edit the project host there if it changes).
4. Add the City domain (`www.mode-cddrmo-ormoc.online`) and update the Site URL in step 2.

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
- [ ] Resource request: record one, approve it as the EOC Manager, then try to change its quantity. The app must refuse with "An approved request cannot be changed".
- [ ] A new, unapproved account: confirm it sees only the waiting page, on a phone and a computer.
- [ ] Password reset: request one and set a new password through the emailed link.
- [ ] Backups: the first database dump and bucket copy are done, and one restore test into the training project has passed (section 11).
- [ ] `supabase/migrations/migration_status.sql` on production: all `applied`, all `ok`.
- [ ] CI is green on `main`, and the uptime check has run at least once.
- [ ] If section 2a is on: a test app reads nothing until it is approved in Settings → Connected apps; once approved it can sign in through the consent screen, cannot write, and loses access when it is withdrawn or suspended.
- [ ] EOC → Map shows the City basemap (section 3, "To 1.9.0", step 6), and a restricted Vault document is not visible to a duty officer.
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

- **Schema changes.** Never edit a migration that has been applied. Add a new file `supabase/migrations/<timestamp>_<name>.sql`. Run `npm run test:db`, `npm run test:it` and `npm run test:e2e` locally (GitHub Actions runs them on every push: `.github/workflows/ci.yml`, since 1.8.0), apply it to production with `psql`, then deploy the app.
- **Uploading through the GitHub website** drops file permissions and can drop hidden files (`.github/`, `.env.example`, `.gitignore`). Prefer `git push`; if you upload, check that those files are still there.
- **Reference data (IAT or traceability workbooks).** Follow the steps in the README.
- **National guidance pending under the RA 12287 IRR.** When the NDRRMC guidelines on triggers and the DBM–COA rules on AA fund use and liquidation are issued:
  - Update `aa_rules` (admin, SQL editor). Changes are audited.
  - Revise the AA checklist templates.
  - Re-validate protocols PR-PDRA and PR-LIFT-REPORT.

```sql
update public.aa_rules set value = 0.10, source_ref = 'IRR Rule V Sec. __; JMC No. __' where key = 'aa_share_of_ldrrmf_70';
```

## 11. Backup, restore and monitoring

Supabase's daily backups cover the database only. The evidence and Vault **files are not in them**. Follow `docs/runbook-backup-restore.md`:

- every week: check the daily backup, take a `pg_dump`, copy the `evidence` and `vault` buckets with rclone, delete error reports older than 90 days;
- every quarter (and before go-live): restore into the **training** project and run the checklist;
- before and after every update: run `supabase/migrations/migration_status.sql` and keep the result;
- monitoring: the uptime workflow (section 10), Settings → Error reports, and the Supabase usage alerts.

