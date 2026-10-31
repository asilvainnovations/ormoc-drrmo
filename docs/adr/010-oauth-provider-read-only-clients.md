# ADR-010: "Sign in with Ormoc DRRM" (OAuth 2.1 / OpenID Connect provider); other apps are read-only (v1.4)

Status: Accepted, 31 Oct 2026. Builds on [ADR-009](009-open-signup-and-live-data.md); its decisions stand.

## Context
Other City systems (reporting dashboards, partner-office tools, AI assistants) need to know who a CDRRMO or EOC staff member is, and sometimes to read the records their role allows, without keeping a second set of passwords. Supabase Auth can act as an OAuth 2.1 authorization server with OpenID Connect for the City's project:

| Endpoint | Address (City production project) |
|---|---|
| Authorization | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/authorize` |
| Token | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/oauth/token` |
| JWKS | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/jwks.json` |
| OIDC discovery | `https://jmctsspadywjcbbqwweh.supabase.co/auth/v1/.well-known/openid-configuration` |

Supabase issues the codes and tokens. The project must supply the screen where a person signs in and allows or refuses an app (the "Authorization Path"). A token issued to an app is an ordinary user token with an added `client_id` claim, so without further rules row-level security would let the app do whatever the person's role allows, including changing declarations, disbursements and validated scores.

## Decision
- **The platform is the consent screen**, at `/oauth/consent` (`src/features/auth/OAuthConsentPage.tsx`). Supabase sends people there with `authorization_id`. A signed-out person signs in first and returns to the same request, including through an emailed sign-in link. The screen names the app, its website, the return address and each requested scope in plain words.
- **Only an approved, active account can allow an app.** Pending and deactivated accounts see an explanation instead. Allowing needs a connection ([ADR-006](006-online-only-authority-actions.md)).
- **People can withdraw access** on Settings → Connected apps (`listGrants`, `revokeGrant`). Administrators see the endpoints there to give to an app's developer.
- **Other apps are read-only.** Migration 0010 puts a trigger on every public table and restrictive policies on storage. Any insert, update or delete made with a token that carries `client_id` is refused (42501), including through the definer RPCs `set_eoc_level`, `start_protocol` and `load_aa_checklist`. Reads follow the person's role as usual. An app can be allowed to write only by adding its `client_id` to `app.oauth_write_clients` in a migration, with a recorded decision.
- **The app checks session tokens against the JWKS.** The public keys are cached on the device and refreshed daily. A session whose signature does not match is dropped. An offline restart resumes only if the stored token was signed by the project, whenever the project's keys allow a check on the device (asymmetric keys). Expiry is not checked on the device, because phone clocks drift; supabase-js renews tokens with the server.
- **Return addresses are checked.** After sign-in the app only continues to its own pages (`safeNext`). After a decision it only follows `https` (or `localhost`) return addresses.

## Consequences
- The Supabase project must enable the OAuth 2.1 server (beta), set the Authorization Path to `/oauth/consent`, and should switch to **asymmetric JWT signing keys**. These are needed for OpenID Connect ID tokens and for on-device signature checks. With legacy shared-secret keys the checks report "unknown" and the app behaves as before. See DEPLOY.md section 2a.
- Each app is registered by an administrator with its exact redirect URI. Dynamic client registration stays off.
- The scopes Supabase grants (`openid`, `email`, `profile`, `phone`) describe identity only. What an app can read is decided by the person's role through RLS. An app allowed by a viewer sees what a viewer sees.
- A table added by a later migration needs the same trigger. The comment on `app.block_oauth_client_writes()` says so, and the SQL suite tests the rule.
- supabase-js moved from 2.45 to 2.118, which provides `auth.oauth.*` and `auth.getClaims()`.
