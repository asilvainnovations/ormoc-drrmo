# ADR-034: One-click reference-data loader (GitHub Actions "Load reference data")

Status: Proposed, 13 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head and City IT.

## Context

Reference data (indicators, Manual chapters and annexes, forms, protocols, RACI board) reaches a Supabase project as seed files run in the SQL editor. The editor rejects long scripts, so `scripts/generate_seed.py` splits the 2.7 MB seed into parts of at most about 100 KB and 400 lines. By 1.19.0 that is 41 files to paste in order (parts 01–36, the DDRiVE parts 26a–26d, the RACI part 37), plus a cleanup script and an IAT update. The limit is size, not rows: the Manual text alone is most of the 2.7 MB, so no row-packing would bring it under a few dozen pastes.

The cost showed on 13 Nov 2026. All 29 migrations were applied to production, but its reference data was still at about 1.14.0 (79 documents, 28 templates, 50 forms). Pasting single parts out of order produced foreign-key errors in parts 35, 36 and 37 that looked like defects but were missing earlier parts. On the same day, web uploads put back pre-review copies of parts 35 and 36, which would have failed again on load.

The Supabase CLI cannot run in Bolt (a browser WebContainer cannot start its native binary). The dedicated IPv4 add-on would allow a direct connection but is a paid Pro-plan feature, and MODE stays on free tiers.

## Decision

1. **`scripts/load_reference_data.sh`** loads a project in one run with `psql`: preflight (every migration in `migration_status.sql` must show "applied", or it stops before changing anything), every `supabase/cleanup/*.sql`, every `supabase/seed/parts/*.sql` in file-name order, then `operational/07_iat_v1_7_update.sql` (optional). It ends by checking that every row id in `src/data/reference.json` is in the database (and the RACI board's 6 matrices and 63 activities), and prints a table. It stops at the first error with the SQL error; each file is its own transaction and every file is safe to run again, so the fix is always "correct the cause and run it again". The one-time operational files (baseline responses, evidence, Vault register) are not run.
2. **`.github/workflows/load-reference-data.yml`** runs that script from the Actions tab (`workflow_dispatch`): target `training` or `production`, a check-only mode that changes nothing, and the IAT update switch. Production loads only from `main` and only when the word `production` is typed in the confirm box; runs on the same target never overlap.
3. **Connection:** one repository secret per project, `SUPABASE_DB_URL_PRODUCTION` and `SUPABASE_DB_URL_TRAINING`, each the Supabase *Session pooler* connection string. The shared pooler works over IPv4, which GitHub runners need, at no cost. The script connects as the database owner, exactly like the SQL editor, so seed writes pass the `app.guard_*` triggers as they always have.
4. **CI keeps it working:** the SQL suite job runs the loader over the test database after `test:db`, then again with `--check-only`, so the loader, the seed and the verification cannot drift apart.
5. Migrations are not run by this workflow. They stay a deliberate step (SQL editor, or the Supabase GitHub integration once its migration history is recorded); the loader refuses to run until they are applied.

## Consequences

- A release's database step becomes: apply the migration (if any), then run "Load reference data" on training, check it, then on production. The SQL-editor route in DEPLOY.md §3 still works and stays documented as the fallback.
- The repository secrets give full database access to anyone who can edit workflows on `main`. Only the City's repository administrators hold them; rotate the database password at turnover (DEPLOY.md §8) and update the secrets.
- GitHub Actions minutes are free for this use (a run takes about a minute).
- The check-only mode doubles as an audit: it shows, without changing anything, whether a project's reference data matches the release on `main`.
