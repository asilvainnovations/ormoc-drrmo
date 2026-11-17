/**
 * ADR-043 Slice 1 — append these entries to TABLES in src/lib/tables.ts
 * (before the final `];` and after the conversation_messages entry).
 *
 * Also add to REALTIME_TABLES if live board updates are required later:
 *   'manual_review_items', 'outstanding_decisions', 'workshop_sessions'
 */

import type { TableConfig } from './tables'; // type-only reference for editors

const STAMPS = ['created_at', 'updated_at'];

export const GOVERNANCE_TABLES: TableConfig[] = [
  // 1.23.0 (ADR-043): Manual governance. Stakeholders are reference data after seed.
  // Review items and decisions: draft fields via upsert; closed_by / decided_by / closed_at are server-stamped (omit).
  {
    name: 'manual_governance_stakeholders',
    pk: 'id',
    cursor: 'updated_at',
    write: 'none',
  },
  {
    name: 'manual_review_items',
    pk: 'id',
    cursor: 'updated_at',
    write: 'upsert',
    omit: [...STAMPS, 'closed_by', 'closed_at'],
  },
  {
    name: 'outstanding_decisions',
    pk: 'id',
    cursor: 'updated_at',
    write: 'upsert',
    omit: [...STAMPS, 'decided_by'],
  },
  {
    name: 'workshop_sessions',
    pk: 'id',
    cursor: 'updated_at',
    write: 'upsert',
    omit: STAMPS,
  },
  // Link tables and import batches are server-side / admin only for Slice 1; not synced to Dexie yet.
];
