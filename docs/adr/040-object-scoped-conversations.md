# ADR-040: Object-scoped conversations for assessment and EOC coordination

Status: Proposed, 16 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.  
Builds on [ADR-003](003-local-first-sync.md), [ADR-004](004-rbac-and-rls.md), [ADR-006](006-online-only-authority-actions.md), [ADR-013](013-record-integrity-guards.md).

## Context

Validators, assessors, cluster leads and critical stakeholders need threaded discussion on the same objects they already work on — indicator responses, assessment cycles, EOC activations and protocol runs — without leaving MODE and without a general chat product. External channels (Messenger, radio, email) remain outside the platform and may be linked from public or staff guidance pages.

A free-floating messenger would break local-first discipline, the ten-role model, RA 10173 privacy-by-schema, and the distinction between operational records (logbook, SitReps) and collaboration aids. An object-scoped thread attached to records the Manual already governs stays inside the architecture.

Primary uses before and after the 1–4 December 2026 validation workshop:

- Assessment / validation discussion on indicators, evidence and workshop flags.
- EOC / cluster coordination during activations and protocol runs.

## Decision

1. **Object-scoped threads only.** A thread has exactly one parent of kind  
   `response` | `assessment_cycle` | `eoc_activation` | `protocol_run`.  
   No global channels, no free-floating direct messages, no cross-parent threads.

2. **One open thread per parent.** At most one thread with status `open` or `resolved` exists for a given parent. A second open thread is refused by a unique partial index and a guard. Historical locked threads remain readable. This keeps the UI simple for the workshop and avoids split conversations on the same indicator or activation.

3. **Append-only messages.** Messages are never edited or deleted. A correction is a new message that may set `in_reply_to`. The body is limited (1–2000 characters). There is no message-level version column; the thread carries `version` for optimistic concurrency on status changes only.

4. **Thread status.**  
   - `open` — anyone with post permission may add messages.  
   - `resolved` — set online-only by a permitted role; further messages are refused until reopened (also online-only).  
   - `locked` — set automatically when the parent record locks (response validated, protocol run completed/aborted, activation ended, cycle archived) or by cdrrmo_head / admin. Locked threads accept no new messages and no status change except by Head/admin under a recorded reason if needed later.

5. **Offline-first capture (ADR-003).** Screens read threads and messages from Dexie. New messages go through `save()` / the outbox. Resolve, reopen and any future moderation use `callOnline()` and fail with `NeedsConnectionError` (ADR-006).

6. **Visibility by role and parent (enforced in RLS, not only the UI).**

   | Parent | Read | Post | Resolve / reopen |
   |--------|------|------|------------------|
   | `response`, `assessment_cycle` | assessor, validator, cdrrmo_head, admin; lead_office_focal for indicators whose lead office matches | same | validator, cdrrmo_head, admin |
   | `eoc_activation`, `protocol_run` | eoc_manager, eoc_staff, duty_officer, cdrrmo_head, admin | same | eoc_manager, cdrrmo_head, admin |

   Cluster leads are not a separate platform role in v1; where a designation exists, access follows the eoc_* / duty_officer rules already used for the activation. Refinements (explicit cluster-lead grants) require a later ADR.

7. **Privacy (RA 10173).** No columns for names of affected persons, evacuees or informants. Message bodies are free text with the same on-screen reminder used on evidence and SitRep fields. Prefer role and position language. Retention follows the parent record and City DPO guidance; the platform does not invent a separate retention rule here.

8. **Not an SOP, protocol, workflow or form.** This is platform collaboration support. It does not replace logbook entries, SitRep remarks, protocol step notes, or any Manual text. Controlled vocabulary (ADR-019) is unchanged.

9. **Out of scope for v1.**  
   - @-mentions that notify, push or email.  
   - File attachments beyond references already stored in evidence or the Vault.  
   - Bridges to Messenger, Teams, SMS or radio.  
   - Public or anonymous comments.  
   - Threads on SitReps, resource requests, RACI activities or Vault documents (may be added later under a superseding ADR).  
   - Editing or deleting messages.

## Consequences

- New migration: `conversation_threads`, `conversation_messages`, RLS policies, `app.guard_conversation_*` helpers, partial unique index on open/resolved parent, cascade-to-locked triggers from parent status changes.
- Sync layer: register both tables in `src/lib/tables.ts`, Dexie version bump, types, omit lists for server stamps; messages are insert-only from the client.
- UI: collapsible thread panel on the indicator response page (Assess), the assessment cycle summary, the EOC activation context, and the protocol run screen. Tooltips, dark mode, offline queue indicator, privacy reminder. No new top-level module route required for v1.
- Tests: RLS matrix per role and parent kind; lock-after-parent-validation; offline outbox for messages; resolve requires connection; unique open thread per parent; SQL suite entries in `10_rules_and_security.sql`.
- Traceability: process support for IAT validation and EOC coordination. No change to scoring, declaration rules, or fund guards. Cite this ADR in code comments and in the RefText catalogue if a short user-facing note is needed.
- Release: follow the normal path (migration → seed if any → typecheck/unit/SQL tests → DEPLOY “To x.y” → version bump → annotated tag). Prefer a minor version (e.g. 1.22.0) once Slice 1 is verified.

## Implementation order (Slice 1 first)

1. **Slice 1 — Assessment only** (target: available for the December validation workshop)  
   Tables + RLS + guards; sync; thread panel on indicator response and cycle summary; open / post / resolve / auto-lock on validation.

2. **Slice 2 — EOC**  
   Same tables; panels on activation and protocol run; eoc_* visibility rules.

## References

- RA 10173 (Data Privacy Act) — no names of affected persons in free text.  
- ADR-003 local-first, ADR-006 online-only authority actions, ADR-013 record integrity.  
- IAT validation workflow and workshop flags (ADR-036, ADR-037).  
- EOC activation and protocol run lifecycle (existing EOC and protocol modules).
