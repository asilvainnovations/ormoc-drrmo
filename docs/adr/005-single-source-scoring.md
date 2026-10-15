# ADR-005: Scoring rules in SQL, mirrored in TypeScript under a parity test

Status: Accepted, 15 Oct 2026

## Context
IAT v1.1 scores must be identical on a phone offline, in the CSV export and in reports read straight from the database. The rules: evidence caps (verbal 2, partial 2, approved and in use 3, tested and improved 4); gap priority (4 − score) × weight × 1.5 for mandatory indicators in Parts A and B, × 1.0 otherwise, High ≥ 9, Medium ≥ 4; maturity bands at 0.5 / 1.5 / 2.5 / 3.5; mandatory compliance rate; IMI = Parts A + B; a separate Interface Index for Part C.

## Decision
- SQL is the source of truth: `app.evidence_cap`, `app.gap_priority_score`, `app.priority_band`, `app.maturity_band` and the views `v_response_results`, `v_domain_results`, `v_cycle_results`.
- `src/domain/scoring.ts` mirrors them so offline screens can show results.
- `scripts/make_parity_fixture.sh` computes a fixture from the SQL views; `scoring.parity.test.ts` asserts the TypeScript results equal SQL across all 22 domains and 4 groups.
- Indicator, domain and requirement reference data are generated from the IAT v1.1 and Traceability v1.1 workbooks by `scripts/generate_seed.py`; the workbooks in `reference/` are the source.

## Consequences
- Any change to a rule is made in SQL first, then mirrored; the parity test fails until both agree.
- A new IAT version is a new seed run plus a new `iat_version` value on cycles; old cycles keep their scores.
