# Runbook — backup and restore (DEPLOY.md §11)

Owner: CDRRMO IT focal (after turnover) with the City IT Division. Frequency: weekly, quarterly restore test.
Scope: the City-owned Supabase project `jmctsspadywjcbbqwweh` (Tokyo, `ap-northeast-1`, ADR-021) — database, and the private Storage buckets `evidence`, `vault`, `geo`. The public `basemap` bucket is rebuilt by the basemap workflow and does not need backup.

Supabase daily backups cover the **database only**. The evidence and Vault **files are not in them** — this runbook is the only copy of record for files.

## 0. Prerequisites

- The `service_role` key is kept **off this repo and out of chat**: it lives in the City's password vault, workstation-only (SECURITY.md).
- `pg_dump`/`psql` (Postgres 15+), `rclone` with a remote named `ormoc-backup` pointing at City-owned storage (City action to provision), and `supabase` CLI are installed on the operator workstation.
- The training Supabase project (separate project, never production) is available for the quarterly restore test.

## 1. Weekly (every Monday, or first working day)

1. **Check the daily backup:** Supabase dashboard → Database → Backups: last daily backup succeeded and is restorable. Note the date in the log.
2. **Database dump:**
   ```bash
   pg_dump "postgresql://postgres:<service-password>@db.jmctsspadywjcbbqwweh.supabase.co:5432/postgres" \
     --no-owner --no-privileges --clean --if-exists \
     -f "mode-$(date +%F).sql"
   ```
   Move the file into the `ormoc-backup` remote under `weekly/<year>/`. Keep 8 weekly dumps, then archive one per month.
3. **Storage buckets:** copy the three private buckets:
   ```bash
   for b in evidence vault geo; do
     rclone copy ":s3,provider=supabase,access_key_id=$SUPABASE_ACCESS_KEY,secret_access_key=$SUPABASE_SECRET_KEY,endpoint=https://jmctsspadywjcbbqwweh.supabase.co/storage/v1/s3:$b" "ormoc-backup:mode-storage/$b"
   done
   ```
   (Storage S3 credentials come from Supabase dashboard → Storage → S3 connection. The buckets are private; signed URLs do not substitute for this copy.)
4. **Error reports:** Settings → Error reports in the app; export and delete reports older than 90 days (they carry device details that are no longer needed).
5. **Log the run** in the Vault operations log: date, operator, backup sizes, anomalies. Any anomaly → open an entry in Settings → Error reports and tell the CDRRMO Head.

## 2. Quarterly restore test (and always before go-live or a major release)

1. Into the **training** project (never production):
   ```bash
   psql "postgresql://postgres:<training-password>@db.<training-ref>.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 -f mode-<latest-dump>.sql
   ```
2. **Checklist after restore** (all must pass before sign-off):
   - [ ] `select count(*) from iat_indicators;` = 140; `master_requirements` = 18; `protocol_templates` = 28 (13 protocols, 15 workflows).
   - [ ] Run `supabase/tests/10_rules_and_security.sql` against the restored schema: **260 checks pass**.
   - [ ] Sign in with a training account; open the Library (chapter text present), one protocol run, the Vault register.
   - [ ] Copy one file back from `ormoc-backup:mode-storage/vault` and open it.
3. Record the test (date, dump used, checks result, operator) in the Vault operations log. A failed restore test is a P0 incident for the CDRRMO Head.

## 3. Before and after every update

1. Run `supabase/migrations/migration_status.sql` against the project; save the result with the release tag.
2. Apply the release per DEPLOY.md §3 (ordered steps).
3. Run `migration_status.sql` again and diff against the saved result; every migration must show applied.

## 4. Retention

- Weekly dumps: 8 weeks online, then one per month for 12 months, then yearly (RA 10173 retention decisions rest with the DPO).
- Storage copies: keep the latest weekly copy plus month-end copies for 12 months.
- Restore-test records: keep permanently (they are the evidence the DR plan works).

## 5. Failure during an incident

- Database unavailable: check Supabase status first; if a restore is needed, restore the latest daily backup or weekly dump into a **new** project, update `VITE_SUPABASE_URL`/keys in Vercel, and only then cut over. Record everything in the logbook.
- Never restore into production over live data — restore into a fresh project and switch the app over deliberately.
