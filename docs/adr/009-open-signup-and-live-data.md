# ADR-009: Open sign-up with administrator approval; live data only (v1.2)

Status: Accepted, 16 Oct 2026. Supersedes the invite-only sign-in of [ADR-004](004-rbac-and-rls.md) and the demo mode of [ADR-003](003-local-first-sync.md); their other decisions stand.

## Context
The City asked for people to be able to create their own accounts and sign in, and for the in-browser demo data to be replaced by the system's own data. Until 1.1, accounts were invited from the Supabase dashboard, and a build without Supabase settings ran a demo that kept everything in the browser.

A production-readiness review found that the database, as it stood, would have let any self-registered account read almost every operational table: read policies only required an active profile, and every new profile is active.

## Decision
- **Anyone can create an account** with an email and password (or be invited). The email must be confirmed.
- **An account sees nothing until an administrator grants a role.** "Active user" in RLS now means an active profile *with at least one role* (`app.is_active_user()`, migration 0009). Until then the app shows only a waiting page: no City data is downloaded and sync does not start.
- **Approving is granting a role**, on Settings → Users and roles. The administrator sees the verified email next to the name the person typed (`admin_list_accounts()`), and cannot grant a role before the email is confirmed. Declining is deactivating. An administrator cannot remove their own admin role or deactivate themselves.
- **After approval, name and position are changed by an administrator**, so records keep a trustworthy name.
- **Live data only.** The app always works against the City's Supabase project. A build without valid settings stops (`vite.config.ts`), and an app that somehow has none shows a configuration screen. Training uses a separate Supabase project.
- **Email links** (confirmation, invitation, sign-in, password reset) all land on `/auth/confirm`, which understands token-hash links (recommended templates; any device), PKCE code links (same browser) and older `#access_token` invitations.
- **One account per device at a time.** Changes are stamped with the account that made them and are only sent under that account. When a different account signs in, the previous account's synced copy is removed first. Signing out always clears the device, offline included; unsent changes block it unless the person types DISCARD.

## Consequences
- Validation workshops and training need a training Supabase project with test accounts, not a demo build.
- The e2e suite runs against real migrations and RLS through PostgREST (`scripts/e2e_test.sh`), including the sign-up and approval journey.
- Supabase Auth must have sign-up on, email confirmation on, a working SMTP sender and the app's exact addresses in Redirect URLs (DEPLOY.md section 2).
