# MODE 1.23.0 — Institutional Intelligence Dashboard Handover

**Workstream:** Dashboard and Analytics  
**Target:** MODE 1.23.0 companion implementation  
**Prepared:** 18 November 2026  
**Status:** Architecture and implementation handover — not merged or deployed

## Purpose

This package specifies the next MODE dashboard implementation: a role-aware Institutional Intelligence and Decision-Support layer with interactive gauges, charts, maturity heatmaps, trend graphs, contextual tooltips, drill-downs and offline-aware summaries.

## Important architecture decision

The current authenticated `/today` route is an action-oriented daily operations page. Keep it. Implement the analytical dashboard as a distinct authenticated `/dashboard` route (or a dashboard tab within the existing authenticated shell if product review chooses that), so daily tasks and longitudinal institutional analytics are not conflated.

## Package contents

- `docs/adr/044-institutional-intelligence-dashboard.md` — proposed architecture decision.
- `docs/implementation/MODE-1.23.0-dashboard-analytics-spec.md` — product, UX and engineering specification.
- `docs/implementation/dashboard-data-contract.md` — metric definitions, sources, provenance and display rules.
- `docs/implementation/dashboard-qa-release-gates.md` — tests, accessibility and release criteria.
- `docs/implementation/dashboard-implementation-plan.md` — sequenced implementation tasks and dependencies.
- `reference/iat-v1.7-dashboard-baseline.md` — exact baseline values transcribed from the supplied IAT v1.7 workbook Dashboard sheet.

## Source inspection

The handover was prepared against the supplied repository snapshot `ormoc-drrmo-main(2).zip`:
- package version in snapshot: `1.22.0`;
- current daily landing route: `/today`, rendered by `src/features/home/TodayPage.tsx`;
- IAT scoring logic: `src/domain/scoring.ts`;
- domain maturity visual: `src/features/iat/MaturityChart.tsx`;
- IndexedDB/Dexie entities include `assessment_cycles`, `responses`, `evidence`, `actions`, DDRiVE tables, EOC records, governance tables and validation progress types;
- existing chart library dependency: `recharts`;
- current `TodayPage.tsx` contains inline analytics and example sparkline arrays. Those example arrays must not be reused as factual historical trend data.

The IAT v1.7 workbook Dashboard sheet was inspected directly. Its values are transcribed in `reference/iat-v1.7-dashboard-baseline.md`. The baseline is not a live database query and must not be hard-coded as current operational performance.

## Non-goals

This package does not:
- modify application source code or database migrations;
- create or apply a Supabase migration;
- seed assessment responses or fabricate historical cycles;
- change IAT v1.7 scoring, weights, thresholds or maturity bands;
- certify institutional compliance or disaster resilience;
- trigger EOC activation, evacuation, declarations, warnings or disbursements;
- expose personal data or restricted records in analytics;
- replace `/today` or the approved Manual.

## Application order

1. Confirm the repository base commit and current working tree.
2. Review and accept ADR-044 through the appropriate project governance process.
3. Implement the dashboard domain/query layer using existing scoring functions and schema.
4. Add route and role-aware navigation.
5. Implement gauges, charts, heatmap, tooltips and drill-downs.
6. Implement only metrics whose source data and definitions are verified.
7. Add tests and run the complete repository check suite.
8. Release only after security, accessibility, data integrity and operational review.

See `docs/implementation/dashboard-implementation-plan.md`.
