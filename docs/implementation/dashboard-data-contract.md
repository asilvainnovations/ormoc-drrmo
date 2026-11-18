# MODE Dashboard — Data Contract and Metric Definitions

## 1. Source of truth

Use the current repository's schema, domain functions and controlled source files. Do not create a separate dashboard-only scoring engine.

Relevant current code/data:
- `src/domain/scoring.ts` — `cycleResults`, `maturityBand`, `gapPriorityScore`, `priorityBand`, `complianceStatus`.
- `src/features/iat/MaturityChart.tsx` — current domain maturity presentation pattern.
- `src/types.ts` — `Cycle`, `Response`, `Evidence`, `Action`, `ValidationProgress`.
- `src/lib/db.ts` — Dexie stores including assessment, EOC, DDRiVE and governance.
- Supabase schema/migrations and RLS are authoritative for persisted data and permissions.

## 2. IAT v1.7 metric contract

### Institutional Maturity Index (IMI)
- Source: selected controlled assessment cycle.
- Population: Parts A + B only.
- Excludes Part C.
- Calculation: existing `cycleResults(...).imi`.
- Display scale: 0.00–4.00.
- Maturity bands: use `maturityBand` from existing scoring domain.
- Must show cycle, IAT version, scored count and total indicator count.

### Part A — CDRRMO
- Source: Part A domains in selected cycle.
- Calculation: `cycleResults(...).partA`.
- Show separately.

### Part B — EOC
- Source: Part B domains in selected cycle.
- Calculation: `cycleResults(...).partB`.
- Show separately.

### Part C — Interface Index
- Source: Part C domains in selected cycle.
- Calculation: `cycleResults(...).interface`.
- Report separately; never add to IMI.

### Mandatory Compliance
- Source: scored Mandatory indicators in Parts A+B.
- Formula: number of scored Mandatory indicators rated 3 or 4 / number of scored Mandatory indicators.
- Use existing `cycleResults` output and validate with controlled workbook calculation.
- Display numerator and denominator, not percentage alone.
- Do not include GP or Part C indicators in the IMI mandatory compliance denominator.

### High-Priority Gaps
- Source: scored indicators and existing gap-priority algorithm.
- Use `gapPriorityScore` and `priorityBand` from `src/domain/scoring.ts`.
- Do not replace existing priority thresholds or weights in dashboard code.
- Show definition and count basis.

### Assessment Coverage
- Show scored, NA, blank/unscored and total separately.
- Do not count NA as a scored indicator.
- Do not imply that pending validation means zero.
- Display Part A/B/C coverage independently where useful.

### Domain maturity
- Use `cycleResults(...).domains[domainCode]`.
- Maturity band is not the same as mandatory compliance.
- A domain with maturity band “Compliant” must not be described as meeting all mandatory requirements unless its Mandatory Compliance is 100% under the approved rule.

### Evidence validation
- Distinguish evidence check states: pending, verified, partially verified, unverified, missing.
- The workbook's “Pending validation” evidence status is separate from indicator score.
- Do not infer verified evidence from a score of 3 or 4.
- Do not treat evidence verification as automatic score approval.

## 3. Supplied IAT v1.7 workbook baseline

See `reference/iat-v1.7-dashboard-baseline.md`. Values are a source workbook snapshot, not current live data. Do not seed them as a new assessment cycle or overwrite current records.

## 4. Operational metric definitions

Before coding any EOC chart, specify:
- source table/entity;
- timestamp field and timezone;
- status filters;
- inclusion/exclusion rules;
- aggregation window;
- duplicate/revision handling;
- missing-data behaviour;
- role access;
- offline freshness behaviour.

Examples:
- “Barangay reports in last 24 hours” must use actual submitted/received timestamp and a documented timezone.
- “Open resource requests” must use the canonical request status and current record state.
- “EOC activations” must distinguish activation records from declarations and incident command events.
- “SitRep timeliness” requires an approved due-time rule; do not invent one.
- “Overdue actions” requires a defined date/time convention and status exclusions.

## 5. Risk / barangay analytics contract

Every risk visualization must identify:
- source workbook/dataset and version/date;
- geographic boundary reference and version;
- hazard type and classification;
- assessment coverage denominator;
- unassessed/missing records;
- whether values represent susceptibility, exposure, vulnerability, risk or a forecast.

Never:
- treat unassessed as zero;
- call susceptibility a forecast;
- merge incompatible hazard classes without documented harmonisation;
- infer official warnings from map layers;
- expose personally identifiable affected-person data.

## 6. Trend contract

A trend chart requires multiple real, comparable, dated observations.

If only one assessment cycle exists:
- display a single baseline observation or a “No comparable prior cycle” state;
- do not draw a multi-point trend;
- do not create synthetic sparkline arrays;
- do not use repeated current values as historical data.

For status progress, only derive a time series if event timestamps or snapshots were persisted. Current status counts alone do not reconstruct history.

## 7. Data quality / freshness contract

Every aggregate should carry:
- `source_as_of` or latest source timestamp;
- `computed_at`;
- `assessment_cycle_id` or period;
- `source_version`;
- `coverage` / denominator;
- `is_partial` or equivalent completeness marker;
- `sync_state` for offline/local data.

Where source timestamps are unavailable, say “Timestamp not recorded” rather than guessing.

## 8. Security contract

- RLS is mandatory.
- Do not rely on UI role hiding.
- Aggregate views/RPCs must enforce the same access scope as source rows.
- Avoid unscoped `SECURITY DEFINER` functions.
- Use explicit grants, `search_path`, and role tests if a privileged function is unavoidable.
- Do not include names of affected persons in aggregate payloads.
- Do not expose restricted record existence through counts, filters, suggestions or tooltips.
