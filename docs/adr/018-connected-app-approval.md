# ADR-018: Other apps read City data only after the City approves them (v1.9.0)

Status: Accepted, 6 Nov 2026. Amends ADR-010.

## Context
ADR-010 made MODE an OAuth 2.1 / OIDC provider whose client tokens are read-only. Any app registered in Supabase could then read what the signed-in person's role can read, once that person clicked *Allow*. On 6 Nov 2026 the City asked to "allow Apps to be connected in Settings": the City, not each user, should decide which systems connect.

## Decision
1. A register `connected_apps` records each OAuth client: purpose, owning office, contact position, redirect address and, in plain words, what it will read. An administrator registers it (status *requested*); an administrator or the CDRRMO Head approves, suspends or retires it. Approval is due for review after a year. A retired app stays retired; it is registered again as a new request.
2. `app.oauth_client_allowed()` is true for the app's own sessions (no client) and for clients whose register entry is *approved*. `app.has_role`, `app.has_any_role` and `app.is_active_user` require it, so a token from an unapproved, suspended or retired client reads nothing anywhere.
3. Client tokens stay read-only on every table (ADR-010).
4. The consent screen asks `connected_app_status(client_id)` and warns when the City has not approved the app. Settings → Connected apps shows each person's own grants and, to administrators and the Head, the City register (online only; it is not kept on devices).

## Consequences
- Registering an app is two steps: create the client in Supabase (Authentication → OAuth Apps), then register it in the app for approval.
- An app approved by the City still sees only what the signed-in person's role can see.
