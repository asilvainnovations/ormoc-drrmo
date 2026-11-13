# ADR-035: EOC capability self-assessment (OCD EOC Capability Assessment Checklist) mapped to IAT Part B

Status: Proposed, 14 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.

## Context

IAT Part B scores the EOC as an institution (legal basis, staffing, information management, SOPs). The OCD/NDRRMC TWG *EOC Capability Assessment Checklist* (December 2017, adapted from FEMA) covers the facility and readiness side: siting, building, rooms, communications, supplies, training and exercises, for both the primary and the alternate EOC. The IAT defers to it (B2.1, B2.2 and B2.4 say "record results on the ... sheet of the EOC Capability Assessment Checklist"), and the backlog has carried "EOC capability self-assessment mapped to IAT Part B" since 1.9. On 14 Nov 2026 the lead assessor supplied an accomplished checklist for Ormoc: 154 items in 15 sections, each mapped to Part B indicators.

Review of that workbook found that its statuses were not observed: for all 154 items the status is the lowest IAT v1-7 score among the mapped indicators (3 Met, 2 Partially met, 1 Largely unmet, 0 Not met), and all 194 evidence entries are copies of the IAT text. 20 of the 59 "Met" items rest on B2.6 or B3.1, which the IAT itself flags "CHECK: score 3 vs evidence". Used as evidence, such answers would be circular: the IAT would cite the checklist and the checklist only restates the IAT. Six items have no Part B counterpart (CBRNE and blast protection, helicopter landing zone, historic-site constraint, ownership, community blending), and the alternate EOC is not assessed because none is designated (B2.7, score 0).

## Decision

1. **Two tables** (migration `20261114003000_eoc_capability.sql`): `eoc_cap_items` (the 154 items, reference data, each with its `iat_indicators` and an `assess_locally` flag) and `eoc_cap_responses` (one answer per assessment cycle, item and site — primary or alternate — with status Met / Partially met / Largely unmet / Not met / Not applicable / Not assessed, evidence observed, gap, recommended action and an optional Document Vault link).
2. **Provenance is a column, set by the server.** The Ormoc answers load as `prefilled_iat` (operational files `08a/08b_eoc_capability_prefill.sql`). Any save by a person, a change or a plain confirmation on site, makes the answer `observed` (`app.guard_eoc_cap_response`). Only an observed answer can be validated, only by the CDRRMO Head, online (ADR-006); a validated answer is fixed until the Head reopens it. Not applicable needs a reason. Answers are never deleted. A finished or archived cycle is read-only, as in the IAT.
3. **The pre-fill never overwrites people.** Re-running the pre-fill refreshes only answers that are still pre-filled drafts. `scripts/eoc_capability_seed.py` checks, on every run, that each pre-filled status still follows the lowest-score rule, so the label "pre-filled from IAT" stays true.
4. **Roll-up to B1–B7** (view `v_eoc_cap_domains`, mirrored by `src/domain/eocCapability.ts` with a unit test): per cycle, site and Part B domain, counts by status plus how many answers are observed, pre-filled and validated. An item mapped to two domains counts in each; items with no IAT counterpart roll up as "local"; a missing answer counts as not assessed.
5. **Screens:** Assess → cycle → *EOC capability checklist* (site switch, B1–B7 table, filters by answer, provenance and domain, item sheet with Confirm/Save, Validate and Reopen for the Head). An IAT Part B indicator page shows how many checklist items map to it.
6. **No effect on IAT scores.** The checklist itself says its components "are not requirements or guidelines, but rather a tool". Observed checklist answers, filed with their Vault documents, are evidence an assessor may cite for Part B; they never change a score by themselves.

## Consequences

- The December workshop can walk the EOC with the checklist on a phone, offline, and turn pre-filled answers into observed ones item by item; the dashboard shows how much of the picture is still only a crosswalk.
- The alternate EOC gets its own column the day one is designated (B2.7).
- Six "assess locally" items start as Not assessed: they need a local judgement, not an IAT score.
- The mapping (which indicators each item serves) is the lead assessor's reading and is reviewed at the workshop; a change is a new reference file and a re-run of the generator.
