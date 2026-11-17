/**
 * ADR-043 Slice 1 — Dexie changes for src/lib/db.ts
 *
 * 1. Import types (or merge from types.governance.ts into types.ts):
 *    ManualReviewItem, OutstandingDecision, WorkshopSession, ManualGovernanceStakeholder
 *
 * 2. Add table properties on DrrmDB:
 *    manual_governance_stakeholders!: Table<T.ManualGovernanceStakeholder, string>;
 *    manual_review_items!: Table<T.ManualReviewItem, string>;
 *    outstanding_decisions!: Table<T.OutstandingDecision, string>;
 *    workshop_sessions!: Table<T.WorkshopSession, string>;
 *
 * 3. Bump schema — additive only, after version(10):
 *
 *    // v11 (1.23.0): Manual Review and Validation Workspace (ADR-043 Slice 1)
 *    this.version(11).stores({
 *      manual_governance_stakeholders: 'id, source_key, institution',
 *      manual_review_items: 'id, source_tracker_id, review_status, priority, chapter_ref',
 *      outstanding_decisions: 'id, source_decision_id, decision_status, priority',
 *      workshop_sessions: 'id, source_session_key, session_number, status',
 *    });
 */
export const DEXIE_GOVERNANCE_VERSION = 11;
export const DEXIE_GOVERNANCE_STORES = {
  manual_governance_stakeholders: 'id, source_key, institution',
  manual_review_items: 'id, source_tracker_id, review_status, priority, chapter_ref',
  outstanding_decisions: 'id, source_decision_id, decision_status, priority',
  workshop_sessions: 'id, source_session_key, session_number, status',
} as const;
