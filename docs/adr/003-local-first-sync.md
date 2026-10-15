# ADR-003: Local-first with IndexedDB, an outbox and versioned rows

Status: Accepted, 15 Oct 2026

## Context
During a typhoon the EOC and barangays may lose data service for hours. Duty officers must still log events, tick protocol steps and record barangay figures, and nothing typed may be lost. Several people edit the same assessment or SitRep.

## Decision
- **Reads** come from IndexedDB (Dexie). Screens never wait on the network.
- **Writes** go to IndexedDB and, in the same transaction, to an outbox. The outbox is sent first-in first-out when online.
- **Optimistic concurrency.** Every editable table has `version` and `updated_at`, maintained by `app.touch_row()`. A write carries the version the user saw. A stale version raises SQLSTATE `PT409` (PostgREST returns HTTP 409). 40001 must not be used: PostgREST retries serialization failures, so the request would never return (found by the integration test).
- **Outcomes of a push.** Success replaces the local row with the server copy, and later queued edits of the same row are rebased onto the new version. A conflict is kept for review on the Sync screen ("Apply my change on top" or "Keep theirs"). A rule refusal (evidence gate, role, locked record) becomes a failed item carrying the server's explanation, and the local row is restored from the server.
- **Payloads** never contain server-stamped columns (who/when, sequence numbers, deadlines, snapshots). `src/lib/tables.ts` lists them per table. Append-only tables (logbook, barangay reports) are inserted with "ignore duplicates", so a replayed insert is harmless.
- **Deterministic ids** let a device create the same rows the server would. Protocol run steps are UUIDv5(run id, step seq). AA checklist actions are UUIDv5(declaration or PDRA id, template id). Both client and SQL use `uuid_generate_v5`, so a run started offline and then replayed through `start_protocol()` produces identical step ids.
- **Pull.** Each table has a cursor (`updated_at` or `created_at`). Rows with unsent local edits are not overwritten. Small reference tables are refreshed whole every 6 hours. Realtime change events on EOC tables trigger an immediate pull.
- **Demo mode.** With no Supabase env vars the app runs entirely local, emulating the RPCs, for training and for the validation workshops.

## Consequences
- Authority actions cannot be queued (ADR-006).
- Conflicts are visible to users, not silently resolved; the Sync screen is part of training.
- Verified by `src/lib/sync.test.ts` (fake client) and `tests/integration/sync.it.test.ts` (real supabase-js → PostgREST 12 → Postgres 16 with all migrations and RLS).
