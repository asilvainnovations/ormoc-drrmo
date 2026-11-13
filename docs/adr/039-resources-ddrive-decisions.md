# ADR-039: Resource inventory screen and DDRiVE inside EOC decisions (v1.21.0)

Status: Proposed, 14 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.

## Context

The assessor's review found the `resources` table had no screen at all (B6.3, B2.5, B6.6), and that DDRiVE — though integrated — played no part in EOC decisions during an activation. Both gaps are cheap to close with what is already in the local store.

## Decision

1. **Resource inventory screen** (`/eoc/resources`, ADR-032 respected): read-first over the existing table as it is — list, search, filter by kind and by barangay/place, a detail sheet; the deferred Chapter 6 fields are not invented. Quantity, location and serviceability are editable online by the operations team exactly as the table's RLS (duty officer, EOC staff, EOC Manager, CDRRMO Head) already permits — no new grants, PT409 conflict handling via `updateOnline`.
2. **DDRiVE as decision support, never a trigger.** On the Barangay liaison desk, silent barangays are sorted by DDRiVE priority rank and annotated with their rank, so the desk calls the high-risk silent barangays first (B5.2, B3.2). On the EOC Board, a "Priority barangays (DDRiVE)" section shows the five highest-priority barangays for the active hazard and whether each has reported in this activation (window per #16). Nothing in either place raises, lowers or automates anything: people decide; DDRiVE ranks.

## Consequences

- The inventory finally answers "what do we have, where, does it work" during an activation, and its edits flow through the same audited, version-checked path as everything else.
- DDRiVE stays the risk-intelligence source and now informs the two moments it was built for: whom to chase, and what to watch.
