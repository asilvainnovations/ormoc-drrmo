# MODE Dashboard — QA, Accessibility and Release Gates

## 1. Functional tests

### Route and role
- `/dashboard` requires an authenticated, approved account.
- Pending/deactivated/signed-out users cannot access dashboard data.
- Role-sensitive panels are appropriate for each role.
- Direct API requests cannot bypass RLS.
- `/today` remains intact and focused on daily work.

### IAT calculations
- Dashboard IMI matches `cycleResults(...).imi`.
- Part A, Part B and Part C match their domain outputs.
- Part C never enters IMI.
- Mandatory Compliance numerator and denominator are correct.
- NA, blank and pending validation remain separate.
- Domain maturity and mandatory compliance are labelled separately.
- Evidence check status is not inferred from score.
- High-priority gap counts match existing priority functions.

### Chart integrity
- No synthetic historical series.
- One assessment cycle produces baseline/no-history state.
- Tooltips show metric, unit, denominator, period, source and freshness.
- Drill-down opens the correct authorised source record/filter.
- Empty, partial, stale and error states are clear.
- Charts remain meaningful without colour.

### Offline
- Cached summaries render without network when source data is locally available.
- Offline status and last sync are visible.
- No offline data is labelled live.
- Sync conflict/failure does not silently overwrite chart state.
- Local data respects the signed-in account and role boundaries.

### Operational analytics
- All timestamps use a defined timezone.
- Counts use canonical status and date fields.
- Declarations are not conflated with EOC activations.
- No unsupported evacuation centre safety claim.
- No warning/evacuation/declaration action is automated.

## 2. Accessibility

- Keyboard access to all filters, chart controls and drill-down links.
- Tooltips have keyboard/touch equivalents.
- Visible focus states.
- Accessible chart title, description and textual data summary.
- Screen-reader labels for gauges and progress bars.
- No colour-only status encoding.
- Test sky-blue card text contrast against actual text sizes.
- Reduced-motion support.
- Responsive layout at 320px width and larger.
- Touch targets meet project accessibility conventions.

## 3. Performance
- Dashboard route and charts lazy-loaded.
- No full evidence-file downloads to render summary charts.
- Indexed queries use existing indexes or justified migrations.
- Chart rendering remains responsive on low-end mobile.
- No new external chart CDN.
- No excessive Supabase round trips per chart.

## 4. Security and privacy
- Role-matrix tests for every aggregate view/RPC.
- RLS enforced on source and derived data.
- No affected-person names in charts, exports or tooltips.
- No restricted record counts exposed.
- Export permission and audit controls tested.
- No invented retention policy.

## 5. Build and test gates

Run in implementation branch:
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:db` where configured
- `npm run test:e2e` where configured
- accessibility tests and manual keyboard/screen-reader review.

Record exact command output and environment. Do not claim tests passed without execution.

## 6. Release gates
Do not call the dashboard released until:
- ADR-044 accepted.
- Metric catalogue and baseline mapping reviewed.
- Role-aware data access tested.
- IAT results reconcile to `cycleResults` and controlled workbook.
- No synthetic trends remain.
- Accessibility and mobile checks pass.
- Offline freshness and account switching verified.
- Documentation, route map and User Guide updated.
- Pull request reviewed and merged through normal repository process.
