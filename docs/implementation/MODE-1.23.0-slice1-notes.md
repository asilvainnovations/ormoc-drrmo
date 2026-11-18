# MODE 1.23.0 Slice 1 — Implementation notes

**Date:** 17 November 2026  
**ADR:** [043](../adr/043-manual-review-validation-workspace.md)  
**Work packages covered:** WP0 (reconciliation), WP1 (core registers), partial WP2/WP4/WP5

## Source reconciliation (WP0)

| Control | Count | IDs |
|---------|------:|-----|
| Validation Register | 69 | VR-001 … VR-069 |
| Outstanding Decisions | 18 | OD-01 … OD-18 |
| Workshop Agenda | 12 | WS-01 … WS-12 (deterministic) |
| Stakeholder matrix | 29 | SH-nn-… (deterministic) |

Source workbook: `Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx` (controlled draft 12 Nov 2026).  
Import is idempotent on the stable source keys. Blank cells are stored as null, never coerced to zero or “No”.

## Schema summary

- `manual_review_items` — review register; close requires disposition + closure_test; reopen Head/admin only  
- `outstanding_decisions` — one accountable owner office; authority status separate; decide requires disposition + decision_reference  
- `workshop_sessions` — 12 agenda sessions  
- `manual_governance_stakeholders` — reference matrix  
- link tables for session↔item / session↔decision (empty until workshop mapping is done)  
- `manual_governance_import_batches` — reconciliation report row per import  

Guards follow ADR-006 / ADR-013 patterns (plain-English `42501` messages, server stamps for closed_by / decided_by).

## Client

Feature module `src/features/governance/` with four read screens over Dexie.  
Authority action UI (close / decide sheets calling `callOnline`) is intentionally deferred so the registers can be used in the workshop while CDRRMO confirms status vocabulary.

## Follow-ups

1. Wire close/decide sheets + `callOnline` paths.  
2. Extend `conversation_threads.parent_kind` for governance parents.  
3. Map workshop sessions to review items / decisions (link tables).  
4. SQL role tests and e2e journey.  
5. Slice 2 document lifecycle dimensions.


## Consolidated handover reconciliation (18 November 2026)

The client-side integration files in this handover are taken from `MODE-1.23.0-build-fix-governance.zip`, because that package already merges the governance types, Dexie schema, sync table registry, route and navigation wiring into the existing application files. Do not separately apply `src/types.governance.ts`, `src/lib/db.governance.delta.ts` or `src/lib/tables.governance.delta.ts` from the original Slice 1 zip; those are superseded integration deltas.

The migration's review-item and outstanding-decision UPDATE RLS policies have been tightened to the same role set described by the migration comments: `admin`, `cdrrmo_head`, `assessor`, `validator`, and `author`. The database trigger remains the authority gate for formal closure/decision transitions.

The `scripts/load_reference_data.sh` replacement is included from the CI-fix handover. It verifies both `eoc_assessment_items` from part 38a and `eoc_cap_items` from part 38.

ADR-043 remains **Proposed**. The migration and seed are a development handover, not authorization to apply them to production. The supplied handover does not include SQL role-matrix tests, client unit tests, or end-to-end tests; those remain release blockers.
