# ADR-044: Institutional Intelligence Dashboard and Analytics Layer

**Status:** Proposed  
**Date:** 18 November 2026  
**Target milestone:** MODE 1.23.0  
**Decision owners:** CDRRMO product/institutional owner, technical maintainer and authorised City reviewers

## Context

MODE already provides an action-oriented `/today` page and has assessment, EOC, DDRiVE, document, governance and operational data domains. The supplied repository snapshot includes:
- `/today` via `src/features/home/TodayPage.tsx`;
- IAT scoring and aggregation in `src/domain/scoring.ts`;
- a domain maturity chart in `src/features/iat/MaturityChart.tsx`;
- Recharts as an existing dependency;
- Dexie tables for assessment cycles, responses, evidence, actions, DDRiVE, EOC, and governance records.

The current Today page combines daily actions and several operational summaries. Some inline sparkline arrays are example sequences rather than measured historical observations. These must not be represented as real trends.

The supplied IAT v1.7 workbook Dashboard sheet contains a baseline assessment snapshot. It distinguishes the A+B Institutional Maturity Index (IMI) from Part C Interface Index and records evidence-validation status separately. This distinction must remain intact in all MODE analytics.

## Decision

Create a dedicated, authenticated **Institutional Intelligence Dashboard** at `/dashboard`, while retaining `/today` as the daily action and operations landing page.

The dashboard will provide role-aware views across:
1. Institutional assessment (IAT v1.7 and subsequent controlled cycles).
2. Manual review and validation governance.
3. Operational EOC activity.
4. Risk and barangay hazard information.
5. Corrective actions and institutional improvement.
6. Platform health and data quality.

Use existing domain logic and data entities as the source of truth. Prefer Dexie for offline/local-first reads and approved Supabase views/RPCs for server aggregates where needed. Use the existing Recharts dependency; do not add a chart CDN or new chart package without a separate decision.

## Core principles

### 1. One metric, one definition

Every KPI and chart must have a documented metric definition, source entity, filter, denominator, time window, aggregation rule, refresh behaviour and provenance label.

### 2. No fabricated trends

Do not create illustrative values, synthetic sparklines, interpolated history or invented trend points. If only one valid assessment cycle exists, show a baseline point and an explicit “No comparable prior cycle” state.

### 3. Preserve IAT scoring

Use `cycleResults` and existing scoring functions in `src/domain/scoring.ts`. Do not independently reimplement scoring, weights, evidence caps, NA handling or maturity bands in UI components.

The IMI includes Parts A+B only. Part C is a separate Interface Index and must not be added to the IMI. Mandatory Compliance is not the same as the maturity band. A domain's maturity label must not be presented as proof of mandatory compliance; compliance requires the defined mandatory-indicator rule.

### 4. Evidence and assessment state remain distinct

Score, validation status, evidence verification and assessment-cycle status are different dimensions. “Pending validation” is not a score of zero. Missing, blank, NA and unassessed values must not be silently collapsed.

### 5. Permission-aware aggregation

All data and aggregate queries must respect Supabase RLS, role checks and existing application access rules. Aggregate endpoints must not reveal restricted record counts, labels or excerpts to users who cannot access the underlying records.

### 6. Decision support only

Risk and hazard analytics are informational decision support. They do not automatically issue warnings, change alert levels, activate the EOC, order evacuation, declare a State of Calamity or State of Imminent Disaster, approve expenditure or authorise disbursement.

### 7. Privacy by design

Use barangay-level aggregates where appropriate. Do not display names or identifying details of affected persons. Apply RA 10173 and the City's approved data governance arrangements. Do not invent retention periods.

### 8. Offline integrity

Offline dashboard summaries may use locally cached, permitted records. Every offline view must indicate its data freshness and sync state. Do not imply that stale local data is live.

## Dashboard information architecture

- `/dashboard` — institutional intelligence overview.
- `/today` — daily priorities, assigned work and operational situation.
- Deep links from dashboard cards to source modules and filtered records.

Role-sensitive emphasis:
- CDRRMO Head/admin: institutional overview, high-priority gaps, governance decisions and improvement.
- Assessor/validator: assessment coverage, evidence status, domain maturity and validation queue.
- EOC manager/staff/duty officer: EOC operational summaries and assigned coordination tasks.
- Author/lead-office focal: assigned review items and corrective actions.
- Viewer: only published or explicitly permitted summaries.

Role views are presentation and navigation differences, not substitutes for RLS.

## Chart and interaction standards

- Score gauges: show scale, score, maturity band, assessment cycle, source and denominator.
- Bar charts: direct labels and accessible text alternatives.
- Line charts: actual time-series observations only; no fabricated values.
- Heatmaps: include labels and patterns/values so colour is not the sole encoding.
- Tooltips: define metric, value, denominator, time period, source and freshness.
- Drill-down: open the authorised source module and preserve filters.
- Empty states: explain why no chart is shown and what data is needed.
- Mobile: charts reflow; no hover-only information.
- Export: only authorised, privacy-reviewed aggregates; exports identify source cycle and extraction time.

## Data and implementation approach

Use current tables and domain logic first:
- `assessment_cycles`, `responses`, `evidence`, `actions`;
- `iat_parts`, `iat_domains`, `iat_indicators`;
- existing validation progress view/type where available;
- governance tables from ADR-043 / MODE 1.23.0 governance implementation;
- existing EOC, DDRiVE and operational tables.

Before adding SQL, inspect existing migrations and current schema. Prefer existing views/RPCs. Any new aggregate view or RPC must be security-reviewed and tested under each relevant role. Do not create a broad `SECURITY DEFINER` analytics function without explicit `search_path`, grants and row-level scope controls.

## Consequences

Positive:
- Separates daily action from institutional performance analysis.
- Makes existing IAT and operational data easier to interpret.
- Provides leadership with traceable indicators and actionable drill-downs.
- Reuses existing scoring and chart dependencies.

Costs:
- Requires a metric catalogue, query layer and role-aware aggregation.
- Historical trend charts depend on comparable assessment cycles.
- Some operational charts remain unavailable until data quality and coverage are sufficient.
- Additional accessibility and performance testing is required.

## Out of scope

- Automatic compliance certification or resilience scoring beyond approved instruments.
- Predictive hazard forecasting or automated warning.
- Automated EOC activation or declaration decisions.
- New personal-data dashboards.
- Historical trend fabrication.
- Changing IAT v1.7 indicator definitions or scoring rules.
- Replacing the approved Manual or `/today`.

## Acceptance criteria

1. `/dashboard` is authenticated and role-aware.
2. `/today` remains available and retains its daily operational purpose.
3. IAT metrics match `cycleResults` and the controlled source cycle.
4. Part C is shown separately from IMI.
5. Mandatory Compliance and maturity are labelled separately.
6. Pending/unverified/missing/NA records remain distinguishable.
7. No synthetic trend values are rendered.
8. All chart values expose metric definitions and provenance.
9. RLS is tested for every role and aggregate endpoint.
10. Offline views show freshness and never imply live status.
11. Accessibility, responsive and performance tests pass.
12. No operational authority is delegated to the dashboard.
