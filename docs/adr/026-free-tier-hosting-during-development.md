# ADR-026: Free-tier hosting while the platform is a development initiative (v1.13.0)

Status: Accepted, 11 Nov 2026, by Alvin M. Silva. Narrows ADR-002 and ADR-021 for the development period; to be revisited before the City adopts the platform for production use.

## Context
MODE is Alvin M. Silva's own initiative to place the development of the Manual of Operations into a platform. It runs on a Vercel Hobby team and a Supabase Free project in Tokyo (`ap-northeast-1`). Paid plans would add cost that the initiative does not carry. The 11 Nov 2026 audit found that three Vercel projects built every push, so the Hobby limit of 100 deployments a day was reached and deploys were refused for 24 hours. Vercel's terms restrict Hobby to non-commercial personal use, and a Supabase Free project cannot change region or add backups beyond the free tier.

## Decision
1. Stay on Vercel Hobby and Supabase Free during development. No cost is incurred.
2. Keep **one** Vercel project connected to the repository (`ormoc-drrmo-eoc`); disconnect the other two.
3. Build only when the app changes: `vercel.json` `ignoreCommand` skips builds when a commit touches only documentation, reference files, SQL migrations, seeds, tests or scripts.
4. Push with git in batches, not file by file through the web upload.
5. Stay in Tokyo; Singapore would be closer, but moving needs a new project.

## Consequences
- Fewer builds: one project and app-only builds keep well under 100 deployments a day.
- Before the City uses MODE for real operations or holds personal data in it, the City decides on City-owned accounts (Vercel or other government hosting; a paid Supabase plan with backups), and this ADR is superseded.
- The privacy notice and SECURITY.md keep naming Tokyo and the transfer to Japan.

## Status update (11 Nov 2026)

- Done: only `ormoc-drrmo-eoc` is still connected to the repository; the other two Vercel projects were removed by Alvin.
- The uptime check (`.github/workflows/uptime.yml`) is on by default and checks the City domain every six hours. Set the repository variable `UPTIME_ENABLED` to `false` to pause it.
- The basemap workflow is optional: without its two secrets it skips, and the basemap is uploaded by hand (DEPLOY.md, section 6).
