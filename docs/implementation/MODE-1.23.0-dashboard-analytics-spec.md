# MODE 1.23.0 — Institutional Intelligence Dashboard Specification

## 1. Product intent

Build an interactive, mobile-first dashboard that converts authorised MODE records into understandable institutional intelligence. The dashboard should help users understand capability, progress, gaps, outstanding governance work, operational activity and data quality.

The dashboard is an analytical and decision-support layer. It is not an authority engine, certification tool, official warning service or replacement for the approved Manual.

## 2. Route and navigation

- New authenticated route: `/dashboard`.
- Preserve `/today` as the daily operational landing page.
- Add a role-aware “Dashboard” navigation entry in the authenticated shell.
- Public website navigation remains separate.
- Do not expose dashboard route or data to signed-out, pending or deactivated accounts.

If product review elects not to add a new route, the alternative is a dedicated Dashboard tab within Today; do not merge longitudinal analytics into the daily task list without clear visual separation.

## 3. Page structure

### 3.1 Header and controls

- Title: Institutional Intelligence Dashboard.
- Subtitle: Assessment, governance, operations and improvement overview.
- Assessment-cycle selector (only cycles available to the current user).
- Time-period selector for operational metrics.
- “Last updated” and online/offline/sync freshness indicator.
- Role-aware links to relevant source modules.
- Avoid a global “all data” selector that bypasses module permissions.

### 3.2 Overview KPI cards

Initial cards:
1. Institutional Maturity Index (IMI), 0–4.
2. Mandatory Compliance (% of scored mandatory indicators rated 3 or 4).
3. Assessment Coverage (scored/total, with NA and pending separated).
4. High-Priority Gaps (count under existing gap-priority algorithm).

For each card show:
- value and units;
- cycle name/version/date;
- numerator and denominator;
- maturity band or definition;
- source link;
- evidence/validation qualifier.

Do not show a single “readiness percentage” unless a formally approved metric defines it.

### 3.3 Assessment analytics

- IMI gauge: Parts A+B only.
- Part A CDRRMO maturity and Part B EOC maturity.
- Part C Interface Index displayed separately.
- Domain maturity horizontal bar chart or heatmap for all 22 domains.
- Mandatory compliance by domain, separately from maturity.
- Indicator score distribution (0–4, NA, unscored).
- Evidence verification distribution: verified, partially verified, unverified, missing, pending validation.
- High-priority gaps by domain and indicator.
- Drill-down to the IAT domain/indicator detail.

Use `cycleResults` from `src/domain/scoring.ts` as the calculation source. Reuse `MaturityChart` patterns where suitable. Do not copy scoring formula into React components.

### 3.4 Manual governance analytics

After ADR-043 governance workspace is integrated:
- Review register status funnel.
- Outstanding decisions by status and responsible authority/office, where authorised.
- Workshop session completion.
- Assigned review workload and due dates.
- Evidence-supported closure counts.
- Do not equate comments or submitted recommendations with validated or approved content.

### 3.5 EOC operational analytics

Potential charts, only when records and date semantics support them:
- Logbook entries by day/shift.
- Barangay reports by time window and reporting status.
- Resource requests by status and category.
- SitRep submission timeliness.
- EOC activation history and level changes.
- Camp/evacuation-site summary only when source records are validated and privacy-safe.

Do not use synthetic values in sparklines. Do not infer a trend from current counts repeated across prior dates.

### 3.6 Risk and barangay analytics

- DDRiVE flood susceptibility class distribution.
- Priority-rank distribution.
- Hazard assessment coverage and data quality.
- Barangay-level comparisons where source coverage is adequate.
- Clear source date, geographic boundary version, hazard model/source and completeness.

Do not call a susceptibility map a forecast. Do not infer that an unassessed barangay has zero exposure. Do not expose affected-person names.

### 3.7 Improvement analytics

- Corrective actions by status.
- Actions by due date/overdue status using actual due dates and agreed business rules.
- Actions by responsible office.
- Completion trend only when historical status timestamps exist.
- Links to underlying action and evidence records.

### 3.8 Platform health

For administrators/technical roles only:
- Pending outbox items.
- Failed sync and conflict counts.
- Last successful sync timestamp.
- Reference-data version.
- Data freshness and local storage status.
- No security-sensitive system details in general user views.

## 4. Role-sensitive views

| Role | Primary emphasis |
|---|---|
| admin | platform health and authorised institutional overview |
| cdrrmo_head | IMI, compliance, priority gaps, governance decisions, improvement |
| assessor | assessment coverage, scores, evidence, gap analysis |
| validator | validation queue, evidence verification, changes and unresolved items |
| eoc_manager | EOC capability, activation and coordination summaries |
| eoc_staff / duty_officer | operational activity, reporting, resource and assigned actions |
| lead_office_focal / author | assigned review items, evidence and corrective actions |
| viewer | permitted read-only and published summaries |

These are dashboard configurations only. The server and database remain the security boundary.

## 5. Charts, gauges and tooltips

Existing dependency `recharts` is available in the supplied package. Use existing chart wrappers and tokens if present.

Every chart must provide:
- visible title and one-sentence description;
- direct labels or accessible legend;
- unit, scale and denominator;
- source and data timestamp;
- tooltip with metric definition and calculation;
- keyboard/touch-accessible equivalent;
- empty and error states;
- responsive layout.

Tooltips should not be the only place where essential information appears.

### Suggested visual hierarchy

- Sky-wash (`#EAF5FF`) for key KPI/card surfaces.
- Sky-blue (`#D8ECFF`) for highlighted panels.
- Clear blue (`#B9DEFA`) for selected/secondary accents.
- MODE blue (`#2F86C8`) for primary data series and actions.
- Deep navy (`#13283D`) for text and high-contrast emphasis.
- White for dense charts and tables.
- Semantic alert colours reserved for actual status/severity.

Do not use sky blue to mean “warning” or “safe”. Status colour semantics remain independent from brand colour.

## 6. Data freshness and offline state

- Show `Updated at` using source timestamp where available.
- When offline, label values “From this device” / “Last synced …”.
- Distinguish local cached snapshot from server current state.
- Do not claim “live” unless a live source is actually used.
- If stale, show staleness and provide a route to Sync.
- Avoid displaying a false “all systems nominal” statement based only on missing warning rows.

## 7. Search and drill-down

- KPI click opens its source module with relevant filter.
- Domain chart click opens the IAT domain.
- Review funnel click opens the corresponding governance register filter.
- Operational chart click opens EOC records filtered to the selected interval/status.
- Search results and drill-downs must respect the same permissions as source records.

## 8. Internationalisation

Translate dashboard chrome, navigation, labels, buttons, empty states and explanatory summaries into English, Ormocanon and Filipino as approved translations become available.

Do not force-translate familiar technical terms such as Tools, Dashboard, EOC, ICS, SOP, SitRep or official acronyms where local usage retains the English term. Use a controlled glossary and local-speaker review.

The controlled Manual source text and official legal wording remain unchanged. Translated explanatory UI must be labelled as a translation where necessary.

## 9. Performance

- Lazy-load the dashboard route and chart modules.
- Avoid loading all assessment evidence documents to compute a summary.
- Compute aggregates from indexed local tables or scoped server views.
- Memoise expensive chart transformations.
- Limit high-cardinality charts and provide date filters.
- Use responsive SVG/canvas output already supported by Recharts; no remote chart CDN.
- Target usable first content on low-end mobile devices.

## 10. Required visualisations

Phase 1:
- IMI gauge.
- Mandatory compliance card/gauge.
- A/B/C assessment composition.
- Domain maturity bars/heatmap.
- Score distribution.
- Evidence verification status.

Phase 2:
- Governance review funnel and decisions.
- Corrective-action status and due-date view.

Phase 3:
- EOC operational activity.
- DDRiVE risk profile and barangay coverage.
- Platform health.

Historical trends only after multiple comparable dated observations exist.
