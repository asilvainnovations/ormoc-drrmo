# Deployment and handover

This guide takes the platform from this repository to a running service owned by the City Government of Ormoc. The City's ICT office does each step under City accounts. The consultant may assist, but holds no production account or key after turnover.

Time needed: about half a day, plus the time to invite staff.

## 0. Before you start

- [ ] A City email account for the platform owner (for example, `drrm-platform@ormoc.gov.ph`), not a personal address.
- [ ] A password manager or vault for the database password and keys.
- [ ] The DPO has reviewed the privacy notice text (Settings → About) and the cross-border transfer to Singapore ([ADR-002](docs/adr/002-hosting-and-privacy.md)).
- [ ] A workstation with Node 20+, Git and `psql` (PostgreSQL 15+ client).

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
   - the **anon / publishable key** (safe in the browser; RLS protects data)
   - the **service_role / secret key** (never put it in the app or in Git; keep it in the vault)

## 2. Configure sign-in

Authentication → Providers → Email:

- **Allow new users to sign up: off.** Staff are invited, never self-registered.
- Confirm email: on. Minimum password length: 10.

Authentication → URL Configuration:

- **Site URL:** the app address (for example, `https://drrm.ormoc.gov.ph`)
- **Redirect URLs:** the same address, plus any preview address you use

Authentication → SMTP: set the City's mail server or a transactional mail service. The built-in sender is rate-limited and is not meant for production invites.

## 3. Create the database

Use the **Session pooler** connection string from Project Settings → Database (it works over IPv4). Run, in order:

```bash
export DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

for f in supabase/migrations/*.sql; do
  echo "== $f"; psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" || break
done
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed/seed.sql
```

Do **not** run anything in `supabase/tests/`. The stub there imitates Supabase for local testing only.

The migrations can also be applied with the Supabase CLI (`supabase link`, then `supabase db push`) if the City prefers. Either way, apply them in file order, once.

Check the result:

```sql
select (select count(*) from iat_indicators)      as indicators,    -- 140
       (select count(*) from master_requirements) as requirements,  -- 18
       (select count(*) from protocol_templates)  as protocols,     -- 9
       (select count(*) from aa_action_templates) as aa_actions,    -- 29
       (select count(*) from storage.buckets where id = 'evidence') as bucket;  -- 1
```

Then, in the dashboard:

- **Advisors → Security.** It should report no tables without RLS.
- **Database → Publications → `supabase_realtime`.** It should list the EOC tables.

## 4. First administrator and the CDRRMO Head

1. Authentication → Users → **Invite user** for the City ICT administrator and for the CDRRMO Head.
2. In the SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'ict.admin@ormoc.gov.ph';
insert into public.user_roles (user_id, role)
select id, r::public.app_role from auth.users, unnest(array['cdrrmo_head','validator','eoc_manager']) r
where email = 'cdrrmo.head@ormoc.gov.ph';
update public.profiles set full_name = 'Full Name', position = 'CDRRM Officer' where id = (select id from auth.users where email = 'cdrrmo.head@ormoc.gov.ph');
```

From here the administrator invites other staff in the dashboard and assigns roles in the app (Settings → Users and roles).

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

Sign in as admin and go to Settings → Barangays → Import CSV. Load the 110 Ormoc barangays from the PSA PSGC file, one per line:

```
psgc,name,classification,population,lat,lng
083738001,Airport,urban;coastal,1234,11.05,124.56
```

Classification takes one or more of `urban`, `coastal`, `riverine` and `upland`, separated by `;`. The importer checks PSGC codes before saving.

## 6. Publish the app

### Option A: Vercel (City-owned team)

1. Create a Vercel team under the City email and import the Git repository.
2. Add environment variables for Production and Preview:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
3. Deploy. `vercel.json` sets the single-page fallback, caching and security headers, including a Content-Security-Policy that allows only this site and `*.supabase.co`.
4. Add the City domain (for example, `drrm.ormoc.gov.ph`) and update the Site URL in step 2.

### Option B: a City web server

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm ci && npm run build   # output in dist/
```

Serve `dist/` over HTTPS. Send unknown paths to `/index.html`. Serve `sw.js` with `Cache-Control: no-cache`. Copy the headers from `vercel.json`. Example for nginx:

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
- [ ] Back up: confirm a daily backup exists (Database → Backups).
- [ ] Record who holds admin, the database password and the service key, in the City's ICT asset register.

## 8. Keys, access and turnover

- The anon key is public by design; RLS enforces access. The service_role key and the database password are secrets.
- **At turnover:**
  - Remove the consultant from the Supabase organisation and the Vercel team.
  - Rotate the database password.
  - If any secret was ever shared, rotate the API keys too (Project Settings → API). Then update the two environment variables and redeploy.
- Review the roles list each quarter. Deactivate leavers in Settings → Users and roles; their records and audit trail remain.

## 9. Data protection notes for the DPO

- **Data held.** The platform holds staff identity (name, email, position, office, roles) and institutional records. It has no fields for affected persons, evacuees, beneficiaries or informants. Free-text fields remind users of this, but mistakes are possible. Include them in the redaction procedure.
- **Audit log.** `audit_log` records every change, with who and when. Agree a retention period (for example, the same as the paper logbook under the City's records disposition schedule).
- **Evidence files.** These are private and are opened through five-minute links. Delete files no longer needed after a cycle is archived.
- **Devices.** Signing out erases the copy on a device. Lost devices: deactivate the user, then rotate their password.

## 10. Updating the platform

- **Schema changes.** Never edit a migration that has been applied. Add a new file `supabase/migrations/<timestamp>_<name>.sql`. Run `npm run test:db` and `npm run test:it` locally, apply it to production with `psql`, then deploy the app.
- **Reference data (IAT or traceability workbooks).** Follow the steps in the README.
- **National guidance pending under the RA 12287 IRR.** When the NDRRMC guidelines on triggers and the DBM–COA rules on AA fund use and liquidation are issued:
  - Update `aa_rules` (admin, SQL editor). Changes are audited.
  - Revise the AA checklist templates.
  - Re-validate protocols PR-PDRA and PR-LIFT-REPORT.

```sql
update public.aa_rules set value = 0.10, source_ref = 'IRR Rule V Sec. __; JMC No. __' where key = 'aa_share_of_ldrrmf_70';
```
