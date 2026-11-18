# MODE 1.23.0 — Dashboard Implementation Plan

## Phase 0 — Confirm source and baseline

1. Confirm implementation branch base commit and package version.
2. Inspect current schema/migrations and route/navigation.
3. Confirm the controlled IAT v1.7 workbook and selected assessment cycle.
4. Reconcile baseline values in the workbook Dashboard sheet.
5. Confirm no duplicate analytics definitions exist.
6. Accept ADR-044.

**Exit:** metric catalogue agreed; no schema assumptions unresolved.

## Phase 1 — Dashboard foundation

1. Create `src/features/dashboard/` with:
   - `DashboardPage.tsx`
   - `dashboard.routes.tsx` or module routes
   - `queries.ts`
   - `metrics.ts`
   - `types.ts`
   - `components/KpiCard.tsx`
   - `components/ScoreGauge.tsx`
   - `components/ChartPanel.tsx`
   - `components/ChartTooltip.tsx`
   - `components/EmptyChartState.tsx`
2. Add authenticated `/dashboard` route.
3. Add role-aware navigation entry in AppShell.
4. Keep `/today` unchanged as daily operational landing.
5. Use existing `cycleResults`, `maturityBand`, `priorityBand` and other scoring functions.

**Exit:** route loads; role guard and base layout work; calculations tested.

## Phase 2 — IAT v1.7 analytics

1. Implement selected-cycle query from Dexie.
2. Show IMI gauge, Part A, Part B and separate Part C.
3. Show Mandatory Compliance with numerator/denominator.
4. Show indicator coverage and NA/unscored status.
5. Show domain maturity and mandatory compliance separately.
6. Show score distribution and evidence validation distribution.
7. Add drill-down to IAT domain and indicator screens.
8. Reconcile to workbook baseline in a controlled test fixture.

**Exit:** all IAT dashboard values match domain scoring and workbook baseline.

## Phase 3 — Governance analytics

After ADR-043 / Manual Governance Workspace is integrated and schema verified:
1. Review status funnel.
2. Outstanding decisions summary.
3. Workshop session status.
4. Assigned review workload and due dates.
5. Evidence-supported closure metrics.
6. Drill-down to Review Register and Decisions pages.

Do not treat a comment as validation, validation as approval, or an assignment as a closed decision.

## Phase 4 — Operational and risk analytics

1. EOC operational summaries from canonical entities.
2. Barangay report time series from real timestamps.
3. Resource request status.
4. SitRep submission history only with approved timeliness rule.
5. EOC activation history distinct from declarations.
6. DDRiVE hazard/susceptibility profiles and coverage.
7. Source date and geographic version labels.
8. Privacy-safe barangay aggregates.

## Phase 5 — Improvement and platform health

1. Corrective-action status and due dates.
2. Responsible-office distribution.
3. Historical improvement trend only where timestamped snapshots exist.
4. Sync health and offline freshness.
5. Platform health visible only to authorised technical roles.

## Phase 6 — QA and release

1. Role matrix and RLS tests.
2. Calculation reconciliation.
3. Accessibility and keyboard/touch tests.
4. Offline/account-switch tests.
5. Performance checks.
6. Full `npm run check` and DB/E2E suites.
7. Update system design, route map, ADR index and User Guide.
8. Open PR for review; do not merge without approval.

## Known repository issues to address during implementation

- `TodayPage.tsx` includes sample sparkline arrays. Remove them or replace with actual persisted time-series data before representing them as trends.
- The Today page has a “IAT Readiness Trend” panel that expects a `readiness` object. Verify its source and whether it has multiple comparable cycles; otherwise label as current snapshot rather than trend.
- Some current operational summaries use local query fallbacks and generic `any` access. Dashboard queries should use typed selectors and documented source entities.
- Existing MaturityChart provides a useful bar visual but should be enhanced with accessible summaries and clear distinction between maturity and mandatory compliance.
- Do not introduce a second scoring formula in chart components.

## Proposed pull request scope

**Title:** `MODE 1.23.0: Institutional Intelligence Dashboard and Analytics`

**Target:** `main`  
**Source branch:** `feature/mode-1.23.0-institutional-dashboard`

PR should include:
- route and navigation;
- dashboard query and metric layer;
- IAT analytics components;
- chart/tooltip components;
- role-aware panels;
- tests;
- documentation updates.

Do not include production migration unless a verified schema gap requires one and it is separately reviewed.
