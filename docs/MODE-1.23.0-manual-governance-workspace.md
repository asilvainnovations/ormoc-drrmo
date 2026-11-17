# MODE 1.23.0 — Manual Governance and Validation Workspace

**Milestone:** Next major MODE development milestone  
**Proposed release line:** 1.23.x (release number subject to normal release approval)  
**Status:** Planning baseline; implementation not yet merged or deployed  
**Primary design record:** [ADR-043](../adr/043-manual-review-validation-workspace.md)

## Outcome

Deliver a secure, traceable workspace in MODE for coordinating review, validation, decisions, workshop activity and evidence-based closure of the CDRRMO–EOC Manual of Operations.

## Work packages

| Work package | Deliverables | Exit condition |
|---|---|---|
| WP0 — Source reconciliation | Controlled tracker source, workbook version, stable IDs, row-count reconciliation, canonical Manual crosswalk | No silent row loss; exceptions documented |
| WP1 — Core registers | Review Register, Outstanding Decisions Register, workshop/session and stakeholder matrix | Users can filter, assign, update and trace source items |
| WP2 — Traceability | Links to Manual documents/sections, versions, SOPs, forms, annexes, Vault evidence and conversations | Each item has a resolvable parent or an explicit unresolved mapping |
| WP3 — Governance lifecycle | Separate review, validation, approval, effectivity and records status dimensions | Transitions are server-authorized and audited |
| WP4 — Evidence and closure | Closure tests, evidence links, validation separation, closure disposition | Closure cannot be achieved by status-only update |
| WP5 — Integrity and import | Idempotent import, duplicate/orphan checks, reconciliation report | Repeat import does not duplicate or overwrite controlled records |
| WP6 — Prompts and follow-through | Assignments, due dates, reminders and overdue views | Every prompt identifies actor, action, rationale, due date and completion criteria |
| WP7 — Assurance | RLS, sync, offline, privacy, audit and end-to-end tests | Release gates pass and limitations are documented |

## Initial source-import controls

The supplied Validation Tracker is reported to contain 69 open review items, 18 outstanding decisions and a 12-session workshop agenda. These are expected reconciliation counts only. The implementation team must inspect the actual workbook, preserve source identifiers and verify each sheet and row before importing. Do not hard-code these totals into application logic.

## Suggested navigation

Add a protected **Manual Governance** entry in the authenticated workspace, with these views:

- Overview
- Review Register
- Outstanding Decisions
- Stakeholders and Clusters
- Workshop Agenda
- Assignments
- Lifecycle and Evidence (role-gated)
- Import and Integrity Report (restricted)

The workspace should link to existing Library and Vault records rather than duplicate them. It should reuse the existing design system, search patterns, offline indicators, empty states and role-aware navigation.

## Proposed core record fields

### Review item

`id`, `source_tracker_id`, `source_version`, `title`, `description`, `priority`, `review_status`, `validation_status`, `lead_office`, `lead_position`, `assigned_validator`, `manual_document_id`, `manual_version_id`, `section_ref`, `sop_refs[]`, `form_refs[]`, `annex_refs[]`, `closure_test`, `disposition`, `closed_at`, `closed_by`, `created_at`, `updated_at`.

### Outstanding decision

`id`, `source_decision_id`, `question`, `context`, `accountable_owner_office`, `accountable_owner_position`, `decision_authority_office`, `decision_authority_position`, `authority_status`, `target_date`, `decision_status`, `decision_reference`, `decision_date`, `disposition`, `evidence_refs[]`, `created_at`, `updated_at`.

### Workshop session and agenda item

`id`, `source_session_id`, `session_number`, `title`, `purpose`, `scheduled_date`, `status`, `agenda_item_id`, `linked_review_ids[]`, `linked_decision_ids[]`, `lead_office`, `materials_refs[]`, `outcome_summary`, `created_at`, `updated_at`.

These are logical field proposals, not final SQL contracts. Normalize many-to-many relationships into link tables; do not store arrays as the sole source of relational integrity.

## Import and migration safeguards

- Use stable UUIDs or deterministic IDs derived from stable source IDs; do not derive identity from row position or title text.
- Store source workbook name, version/date, sheet, source row/key and import batch ID.
- Make imports idempotent and non-destructive.
- Do not overwrite an existing record if its source identity conflicts; report it for reconciliation.
- Retain the original workbook as a controlled source in the Vault.
- Generate an import report: inserted, updated, unchanged, rejected, duplicate, unresolved-link and missing-source counts.
- Never treat a blank source cell as zero, “No”, “Not applicable” or a completed decision.

## Definition of Done

- [ ] Source workbook inspected and approved for import.
- [ ] Tracker IDs and row counts reconciled.
- [ ] Database schema, constraints, RLS and audit events implemented.
- [ ] Dexie schema and sync policy implemented consistently with ADR-003.
- [ ] Protected routes and role-aware screens implemented.
- [ ] Review, decision and workshop workflows tested.
- [ ] Closure evidence and validator separation tested.
- [ ] Import is idempotent and produces a reconciliation report.
- [ ] Canonical Manual identifier integrity checks pass or exceptions are explicitly accepted.
- [ ] Offline capture and online-only authority actions tested.
- [ ] Privacy, accessibility and responsive layouts reviewed.
- [ ] Documentation and user guide updated.
- [ ] CI checks, database tests and end-to-end tests pass.
- [ ] CDRRMO product owner accepts the milestone for workshop use.

## Constraints and unresolved dependencies

- The current connected GitHub integration is read-only; this planning package is not committed to the remote repository.
- The actual Validation Tracker workbook must be available in the implementation workspace before building the importer. The counts supplied in discussion are not a substitute for row-level source inspection.
- The final status vocabulary, office/position permissions, closure authorities, notification policy and approval transitions require CDRRMO confirmation.
- OD-08 remains pending: do not hard-code 85 as a finally confirmed City denominator.
- Chapters 9 and 10 require their controlled source drafts before seeding.
- Retention and DPO rules require formal City/DPO direction.
