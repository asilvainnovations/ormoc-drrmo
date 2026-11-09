# ICT asset register — MODE platform

City-owned record (production-readiness audit P0/P1). The City IT Division is the custodian after turnover; until
then the developer maintains this file. Update it whenever custody, access or ownership changes.

## Accounts, keys and access

| Asset | Where | Owner (after turnover) | Custodian now | Developer access | Access end-date | Notes |
|---|---|---|---|---|---|---|
| Supabase project `jmctsspadywjcbbqwweh` (Tokyo `ap-northeast-1`, ADR-021) | supabase.com | City Government of Ormoc (CDRRMO) | CDRRMO Head + developer | project member (role: developer, not owner) | **TBD — record the engagement end-date + support window here on turnover** | Database password and service key held in the City's password vault, workstation-only |
| Database password (postgres) | City's password vault | City IT Division | CDRRMO | break-glass only, logged | same as above | Rotate on turnover |
| `service_role` key | City's password vault only — never in the repo, never in the app | City IT Division | CDRRMO | basemap build + support tasks | same as above | Revoke and re-issue on turnover |
| Vercel deployment (production) | vercel.com | City Government of Ormoc | developer (team seat) | team member | same as above | Transfer project to a City-owned Vercel team on turnover |
| GitHub repo `asilvainnovations/ormoc-drrmo` | github.com | City Government of Ormoc (org transfer on turnover) | developer (admin) | admin | same as above | Protect `main`; two maintainers minimum after turnover |
| Domain `mode-cddrmo-ormoc.online` | registrar | City Government of Ormoc | developer (technical contact) | technical contact | same as above | Registrant must be the City, not the developer |
| **Support mailbox** `mode-support@asilvainnovations.com` | developer's mail host | **TBD — name the CDRRMO IT focal (position, not person) at turnover** | developer | monitored | mailbox forwarded to the City address on turnover; keep for 90 days | SECURITY.md §Report; acknowledge 2 working days, assessment 10 working days |
| Uptime monitoring | `.github/workflows/uptime.yml` | City IT Division | developer | n/a | n/a | Opens an issue automatically on failure |
| GitHub Actions secrets (`SUPABASE_URL`, `SERVICE_ROLE_KEY` in basemap.yml) | GitHub repo settings | City IT Division | developer | n/a | rotate on turnover | The service key here has Storage write scope for the basemap bucket only |

## Turnover actions (checklist)

- [ ] Name the support-mailbox owner (a position, e.g. "CDRRMO IT focal") in the table above.
- [ ] Record the developer access end-date (engagement end + agreed support window).
- [ ] Rotate: database password, service_role key, GitHub Actions secrets.
- [ ] Transfer: Vercel project, GitHub repo/org, domain registrant contact.
- [ ] Forward the support mailbox for 90 days, then retire the developer address from SECURITY.md.
