## MODE 1.22.0 build fix

Fixes the failing Vercel build (`tsc -b` exit 2) on `main`, and adds the PHIVOLCS Tsunami Information link to Today.

### Root causes
1. `src/features/eoc/actions.ts` was overwritten by an upload with the EOC *assessment* actions (already in `features/eoc-assessment/actions.ts`), so `setEocLevel` and `addLog` vanished. **Restored** from `1dd5ce6^`.
2. Dexie tables `eoc_cap_items` / `eoc_cap_responses` were dropped from `db.ts` / `tables.ts` in an earlier merge (46f44d7) while `EocCapabilityPage` and its tests still use them. **Restored** (Dexie v10, additive).
3. ADR-040 tables `conversation_threads` / `conversation_messages` were never registered. **Added** (threads and messages insert-only; server stamps omitted).
4. `package.json` version 1.22.0.

### Today page
- Hazard watch now links to **PHIVOLCS Tsunami Information** (`https://tsunami.phivolcs.dost.gov.ph/`). Outbound link only (`rel="noopener noreferrer"`): no iframe, no scraping, CSP unchanged, per ADR-011 / ADR-041a. ADR-041a updated to list it.

### Verified locally (Node 22)
`tsc -b` 0 errors; `vitest run` 41 files / 319 tests pass; `vite build` succeeds with Supabase env vars set. No SQL changes.
