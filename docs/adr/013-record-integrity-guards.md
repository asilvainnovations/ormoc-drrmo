# ADR-013: Approval authority, draft protocols and deletes enforced in the database (v1.7.0)

Status: Accepted, 5 Nov 2026. Amends ADR-004. (This file was missing from the repository; restored on 6 Nov 2026 from the decision as implemented in `supabase/migrations/20261105001400_record_integrity_2.sql` and DEPLOY "To 1.7.0". The decision is unchanged.)

## Context
The 31 Oct 2026 audit (findings 4, 5 and 6) found that the `author` role could approve or rewrite protocols and the IRR checklist, that `start_protocol` ran draft templates live, that the PDRA behind a requested declaration could be rewritten, and that Supabase's default grants let `FOR ALL` policies delete legal and financial records. It also found that `app.guard_moo_document` ran as SECURITY DEFINER, so its "is the caller an API role" test never held and its role checks never ran.

## Decision
1. Only the CDRRMO Head approves, retires or reopens a protocol or a Library document. An approved protocol's text and steps are fixed; revising it means the Head sets it back to draft.
2. A draft protocol runs as a drill for anyone who runs protocols. A live run of a draft needs the EOC Manager or the CDRRMO Head. Each run records whether its protocol was approved when it started.
3. The IRR Rule IV checklist templates are the Head's; they are deactivated, never deleted.
4. Once a declaration citing a PDRA leaves draft, the PDRA is fixed. A changed forecast is a new PDRA.
5. DELETE is revoked on every legal, financial and operational record and TRUNCATE on every table; `FOR ALL` policies are split one per command. The logbook and barangay reports are insert-only.
6. Guards that test the caller run as the caller (SECURITY INVOKER) and skip only when `current_user` is not an API role (seed and migration runs).

## Consequences
- Until the December validation, protocols are drafts: duty officers run them as drills; the EOC Manager or Head can start a live run in an emergency.
- On a live Supabase project, check the grants after migrating (`\dp public.declarations`: no `d`, no `D` for `authenticated`).
