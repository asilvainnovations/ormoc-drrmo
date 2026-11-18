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

---

## Review notes (18 November 2026, before merge of this handover)

Checked against `main` at `e2bee21` (package version 1.22.0). Docs only; no code or migration is changed by this PR.

### Confirmed

- Recharts 2.15.0 is a dependency; a wrapper exists at `src/components/ui/chart.tsx`. Use it before writing new chart plumbing.
- `src/domain/scoring.ts` exports `cycleResults`, `maturityBand`, `gapPriorityScore`, `priorityBand`, `complianceStatus`; `cycleResults` returns `domains`, `partA`, `partB`, `imi`, `interface`, `answered`, `total`. Role names in the spec match `Role` in `src/types.ts`. `EvidenceCheck` (`pending`, `verified`, `partially_verified`, `unverified`, `missing`) exists in `src/types.ts`.
- No `/dashboard` route exists. ADR number 044 was free.
- `TodayPage.tsx` lines 79–81 hold made-up sparkline arrays (`[2, 4, 3, 5, 4, 6, …]` and similar), as the handover says.
- The IAT v1.7 baseline in `reference/iat-v1.7-dashboard-baseline.md` was recomputed from the indicator sheets of the repo copy of the workbook (scores, weights and types of A_CDRRMO, B_EOC, C_Interface; high gap = (4 − score) × weight × 1.5 for Mandatory, × 1.0 otherwise, at 9 or more). It matches exactly: IMI 1.984732824, Mandatory Compliance 32.9% (26 of 79), 30 high-priority gaps, Part A 2.058823529, Part B 1.847826087, Part C 1.407407407, and every domain row. The repo copy has no cached values on its `Dashboard` sheet, so the figures in the baseline file came from a copy that had been recalculated; use the indicator sheets when building the reconciliation fixture.

### Gaps the plan must close before Phase 2

1. **Numerator and denominator.** The data contract says to display Mandatory Compliance as numerator and denominator "using existing `cycleResults` output". `ResultRow.mandatoryCompliance` is a ratio rounded to four decimals; it carries no counts. Add the counts to `ResultRow` as additive fields (for example `mandatoryScored`, `mandatoryMet`), computed inside `summarise()`, with a test in `scoring.test.ts`. Do not recompute them in React.
2. **NA versus blank.** The contract asks for scored, NA and unscored shown separately. `cycleResults` gives `scored` and `indicators`; the difference mixes NA with blank, and `answered` counts both. Add `notApplicable` and `unscored` the same way, in the domain layer. `scoring.parity.test.ts` and the SQL views stay the authority for the scoring itself; the new fields change no score.
3. **Mandatory Compliance for A+B.** `summarise()` already excludes Part C from the Mandatory set, so the `imi` row is the correct source. Keep it.

### Findings on the existing Today page (answers the plan's "verify its source")

- The "IAT Readiness Trend" panel is built from real data: the two most recent cycles by `cycle_year`, scored with `cycleResults`. It is not synthetic. It compares the cycle year order, not comparability, so it should still say "vs last cycle" only when both cycles use the same IAT version.
- `delta` coalesces a missing index to 0 (`?? 0`). A cycle with no scored indicators therefore shows a large false change. A missing index should give a null delta and an "N/A" label.
- `metItemsDelta` is the change in `answered` (scored plus NA), but the panel prints it as "mandatory items met since last assessment". That is a different quantity. Either compute the change in mandatory items rated 3 or 4 (needs finding 1) or relabel it.
- The three sparkline arrays are the only fabricated series. Remove them or replace them with persisted timestamped data, as the plan says.

### Other points to settle in Phase 0

- **Milestone number.** "1.23.0" is already used by the Manual Governance and Validation workstream (ADR-043, `MODE-1.23.0-slice1-notes.md`), and `package.json` still reads 1.22.0. The file names in this handover keep the 1.23.0 label as delivered. Decide the release number for the dashboard before the implementation branch is cut; the documents describe it as a companion workstream, which fits.
- **Colours.** The design system defines `ink #13283D` and `sky #2F86C8`, which the spec uses. The spec's `#EAF5FF`, `#D8ECFF` and `#B9DEFA` are not tokens (the existing light fill is `sky-soft #DCEEFB`). Use the tokens, or add the new ones to `docs/design-system.md` first, with contrast ratios.
- **Navigation.** `AppShell.tsx` lists Today as `/today`, and `CommandPalette.tsx` gives Today the search keywords "home dashboard". Remove "dashboard" from that entry when `/dashboard` is added, or searches for "dashboard" will land on the wrong page.
- **Governance panels (Phase 3).** The ADR-043 tables are on `main`. The Phase 3 note to wait for the governance workspace refers to the client screens, whose close and decide sheets are still deferred (`MODE-1.23.0-slice1-notes.md`, follow-up 1).
