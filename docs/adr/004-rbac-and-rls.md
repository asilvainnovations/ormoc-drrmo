# ADR-004: City roles enforced by row-level security and triggers

Status: Accepted, 15 Oct 2026

## Context
Who may score, validate, approve an SOP, change the EOC level or release anticipatory-action funds follows from RA 10121, RA 12287 and its IRR, and City issuances. A client-side check is not a control.

## Decision
- Roles (`app_role`): `admin`, `cdrrmo_head`, `assessor`, `validator`, `eoc_manager`, `eoc_staff`, `duty_officer`, `lead_office_focal`, `author`, `viewer`. A person may hold several. `admin` manages accounts only, not content approvals in practice.
- Helpers `app.has_role`, `app.has_any_role`, `app.is_active_user`, `app.my_office`, `app.can_answer` are `SECURITY DEFINER` with a fixed `search_path`.
- RLS on every table. Table grants are minimal: the logbook is insert and select only, so entries cannot be edited or deleted; corrections are new entries that point to the original.
- Workflow rules are triggers that raise plain-language messages: only a validator validates; validated responses are locked; scores are capped by evidence strength; only the CDRRMO Head approves an SOP version, and approved versions are immutable; closed protocol runs and their step snapshots are locked; resource requests move forward only; declaration steps follow the IRR order with computed deadlines.
- Part C indicators can be answered by the focal person of the lead office (`app.can_answer`).
- Every change to institutional records is written to `audit_log` by `app.audit()`.
- New sign-ups get a profile with no roles; an admin grants roles.

## Consequences
- The UI hides what a role cannot do, but the database is the authority. Refusals reach the user as failed items with the reason.
- 105 SQL checks in `supabase/tests/10_rules_and_security.sql` run every rule as each role on a real Postgres.
