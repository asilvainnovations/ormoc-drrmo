# ADR-043: Manual Review and Validation Workspace

**Status:** Proposed milestone decision, 17 November 2026  
**Scope:** MODE Manual governance, review, validation and institutional follow-through  
**Builds on:** ADR-003 (local-first sync), ADR-004 (RBAC/RLS), ADR-006 (online-only authority actions), ADR-012 (single Manual), ADR-013 (record integrity), ADR-019 (SOP registry), ADR-032 (Manual structure and renumbering), ADR-040 (object-scoped conversations).

## Context

The Validation Tracker and the updated Introduction to the Manual establish a review and validation process that is broader than IAT score validation or document review. The current platform supports assessment evidence, indicator validation, Vault review and object-scoped conversations on selected assessment and operational records. It does not yet provide one integrated workspace for managing Manual review items, outstanding decisions, stakeholder assignments, workshop sessions, evidence-based closure and links to controlled Manual content.

The next major MODE development milestone is therefore the **Manual Review and Validation Workspace**. It will provide the institutional workflow through which the CDRRMO coordinates review, validation, decision-making, revision and closure of the Manual and its supporting instruments.

The current Validation Tracker baseline, as supplied for this milestone, contains 69 open review items, 18 outstanding decisions and a 12-session workshop agenda. These counts are import controls, not immutable constants. The source workbook remains authoritative until its controlled import and reconciliation are completed.

## Decision

MODE shall develop a connected Manual Review and Validation Workspace. It shall extend the existing Library, Vault, audit and object-scoped conversation architecture rather than create a separate tracker application or a free-floating chat product.

The workspace shall include the following capabilities:

1. **Review Register** — stable tracker ID; issue/title; description; priority; status; lead validator; contributing offices; linked chapter/section/SOP/form/annex; evidence references; discussion thread; required action; closure test; disposition; dates and audit history.
2. **Outstanding Decisions Register** — stable decision ID; decision question; one accountable coordinator/owner; competent decision authority; options or recommendation where appropriate; dependencies; supporting evidence; target date; decision status; formal decision reference; disposition and implementation follow-through. An accountable owner does not acquire the authority to decide by virtue of assignment.
3. **Stakeholder and Workshop Management** — stakeholder/cluster matrix; workshop session; agenda item; assigned participants by office/position; session materials; attendance/participation record where authorized; issues raised; decisions and action items. The 12-session agenda is imported as source content and may be revised through controlled updates.
4. **Evidence-based closure** — closure requires a recorded disposition, linked supporting evidence or decision record, a satisfied closure test, and verification by a role distinct from the person who performed the underlying work where the applicable process requires separation. Status change alone is insufficient.
5. **Document and section traceability** — review and decision items link to canonical Manual document and section identifiers, version, Vault evidence, SOPs, protocols, forms and annexes. Legacy identifiers may be retained as aliases but must not conflict with canonical IDs.
6. **Object-scoped discussion** — extend ADR-040's parent model to Manual documents/versions/sections, review items, decisions and workshop agenda items. Threads remain attached to one parent, append-only, permission-controlled and subject to record-retention guidance. No global chat channels.
7. **Controlled lifecycle** — distinguish review, validation, approval, effectivity and records/archive dimensions. Do not collapse these into one ambiguous status enum. The UI may show a derived summary label, but the underlying events and authority references remain distinct.
8. **Assignments and prompts** — create actionable assignments with assignee office/position, action required, rationale, linked object, due date, completion criteria and escalation path. Notifications/reminders are introduced only with an approved notification policy and user preferences. A prompt does not itself confer authority.
9. **Audit and reporting** — immutable or append-only history of material status changes, assignments, validation decisions, approvals, evidence links and closure. Provide workload, overdue, unresolved-decision, evidence-completeness and workshop-progress views.

## Lifecycle model

The workspace shall maintain separate dimensions:

- **Review:** Draft / For Review / Returned for Revision / Review Complete.
- **Validation:** Not Started / For Validation / Validated / Revised / Not Validated.
- **Approval:** Not Submitted / Pending Approval / Approved / Rejected.
- **Effectivity:** Not Yet Effective / Effective / Superseded.
- **Records disposition:** Active / Archived.

These are conceptual states for the proposed design. Final controlled vocabularies, transition permissions and required evidence must be confirmed before migration implementation. A validated item is not necessarily approved; an approved item is not effective before its effective date; archived records remain traceable and are not silently deleted.

## Data and relationship model

The logical model shall include, at minimum:

- `manual_review_items`
- `manual_decisions`
- `manual_workshops`
- `manual_workshop_agenda_items`
- `manual_assignments`
- `manual_item_evidence`
- `manual_lifecycle_events`
- `manual_reference_verifications` (for legal/regulatory references, if included in this milestone slice)

The model shall reuse canonical IDs and existing references where available. It shall not duplicate the contents of the Vault or Manual Library. Evidence is referenced, not copied, wherever the existing evidence/Vault model can serve as the controlled source.

## Authority, security and privacy constraints

1. Postgres RLS and database guards enforce access and permitted transitions; hiding controls in the UI is not sufficient.
2. Role permissions shall be based on existing roles and designated office/position relationships. Do not add a broad administrator privilege merely to make the workspace easier to operate.
3. Review coordination, technical validation, formal approval and legal decision authority remain distinct.
4. No workflow assignment or RACI designation creates or transfers statutory authority.
5. Authority-bearing actions (validation decision, approval, closure where designated, reopening locked records, role changes) require a live connection and server-side authorization.
6. Discussion and evidence fields shall carry privacy reminders and must not solicit unnecessary personal or sensitive information. Apply RA 10173 and City DPO guidance.
7. Retention periods, redaction rules and DPO permissions must follow formally approved City policy; MODE shall not invent them.
8. Offline capture may be supported for drafts and comments where safe. Final validation, approval and other authority-bearing transitions are online-only.

## Relationship to ADR-040

ADR-040 remains the basis for object-scoped conversations on indicator responses, assessment cycles, EOC activations and protocol runs. ADR-043 extends that pattern to Manual governance objects. It does not authorize global channels, direct messaging or replacement of formal records with chat messages. A decision or validation outcome must be recorded in its structured record, not inferred from a discussion thread.

## Release sequencing

### Slice 0 — Governance and source reconciliation

- Confirm tracker workbook version, sheet names, IDs and row counts.
- Preserve original tracker identifiers and source provenance.
- Confirm status vocabulary, role/authority matrix, closure tests and canonical Manual identifier crosswalk.
- Reconcile the 69 review items, 18 decisions and 12 workshop sessions against the source workbook before import.

### Slice 1 — Workshop-critical workspace

- Review Register and Outstanding Decisions Register.
- Stakeholder/cluster matrix and 12-session agenda.
- Links to Manual Library, Vault evidence and ADR-040 conversations.
- Assignment, status history and evidence-based closure.
- Import validation report and reconciliation exceptions.

### Slice 2 — Document lifecycle and integrity

- Separate review, validation, approval, effectivity and records dimensions.
- Authority-specific transitions and audit history.
- Canonical identifier integrity checks and orphan-reference report.
- Legal/regulatory reference verification metadata, subject to confirmed source and verification rules.

### Slice 3 — Prompts and institutional follow-through

- Assignment queues, due dates, reminders and escalation.
- Workshop action follow-through and closure dashboards.
- Notifications only after notification policy is agreed.

## Explicit dependencies and non-goals

- The 85-barangay count remains subject to OD-08 reconciliation; this ADR does not confirm or hard-code the City masterlist denominator.
- Chapters 9 and 10 must be seeded from controlled source drafts; this ADR does not authorize reconstructing their text from RACI entries or summaries.
- The warning-to-action register, full recovery and financing workflows, DPO/retention implementation, formal technical handover and regulatory watch remain separate work packages unless explicitly added through a later decision.
- No automated evacuation, declaration, alert-level change, expenditure or procurement decision is introduced.
- No score is changed by a review item, discussion thread, training record or closure action.

## Acceptance criteria

The milestone is ready for workshop use only when:

1. The imported review-item, decision and workshop counts reconcile to the controlled source workbook, with every exception reported.
2. Every review item has a stable source ID and can be linked to its Manual provision or explicitly marked as an unresolved mapping.
3. Every outstanding decision has exactly one accountable coordination owner and a separately identified competent decision authority or an explicit “authority to be confirmed” status.
4. Review, validation, approval and effectivity are distinguishable in both data and interface.
5. A review item cannot be closed without a disposition, closure test and required evidence/decision reference.
6. The system records who changed a status, when, under what permission and with what reason where required.
7. Users cannot validate their own work where separation of assessor/validator is required.
8. RLS tests cover each role and each parent object; unauthorized access is denied by the database.
9. Offline actions cannot bypass online-only authority transitions.
10. Identifier checks report duplicate canonical IDs, invalid aliases and orphaned links before a controlled import/release.
11. The workspace preserves source provenance and does not overwrite the original tracker.
12. Unit, type, database-security, sync and end-to-end tests pass before release.

## Consequences

- MODE gains a governed institutional process for reviewing and validating the Manual, not merely a place to store its content.
- The Validation Tracker becomes a source-controlled import and ongoing governance record, rather than a parallel spreadsheet that must be manually reconciled.
- The CDRRMO can monitor review progress, unresolved decisions, evidence sufficiency and institutional follow-through.
- The data model and lifecycle controls require careful design before implementation; a rushed single-status field or unstructured comment system would undermine the intended governance model.
- This ADR is proposed and requires CDRRMO review before the schema and authority transitions are treated as approved requirements.
