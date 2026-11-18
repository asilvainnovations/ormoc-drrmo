# IAT v1.7 — Dashboard Baseline Reference

**Source:** `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx`  
**Sheet:** `Dashboard`  
**Inspection date:** 18 November 2026  
**Use:** Reconciliation fixture/reference only. Not a live MODE dashboard feed.

## Overall baseline values

| Metric | Workbook value |
|---|---:|
| Institutional Maturity Index (Parts A+B) | 1.984732824 / 4.00 |
| Displayed IMI | 1.98 / 4.00 |
| IMI maturity band | Developing |
| Mandatory Compliance | 32.9% |
| Indicators scored (A+B) | 125 |
| Part A + B coverage | 1.00 (125/125 scored in workbook snapshot) |
| Part C Interface Index | 1.407407407 |
| High-priority gaps | 30 |
| Part A CDRRMO maturity | 2.058823529 |
| Part B EOC maturity | 1.847826087 |
| Part C Interface maturity | 1.407407407 |

## Instrument structure

| Part | Indicators | Domains | Treatment |
|---|---:|---:|---|
| A — CDRRMO | 82 | 10 | Included in IMI |
| B — EOC | 43 | 7 | Included in IMI |
| C — Interface | 15 | 5 | Report separately; excluded from IMI |
| Total | 140 | 22 | — |

The workbook shows 125 indicators scored in A+B and Part C separately. Its evidence validation control shows all 140 indicators as “Pending validation” at the time of this workbook snapshot. This does not mean that all indicator scores are zero or that all evidence is missing.

## IMI composition

| Classification | Count |
|---|---:|
| Mandatory | 79 |
| Good Practice | 46 |
| Total A+B | 125 |

Mandatory Compliance is the share of scored Mandatory indicators rated 3 or 4. The workbook displays 32.9%.

## Part A domain values

| Code | Domain | Indicators | Scored | Maturity Index | Band | Mandatory Compliance | High gaps |
|---|---|---:|---:|---:|---|---:|---:|
| A1 | Legal Mandate & DRRM Governance | 8 | 8 | 2.470588235 | Developing | 66.7% | 2 |
| A2 | Organization, Staffing & Human Resources | 10 | 10 | 1.863636364 | Developing | 14.3% | 4 |
| A3 | DRRM & Contingency Planning | 7 | 7 | 2.611111111 | Compliant | 50.0% | 1 |
| A4 | DRRM Financing & Fund Management | 9 | 9 | 2.157894737 | Developing | 50.0% | 1 |
| A5 | Risk Assessment, Data & Knowledge Management | 9 | 9 | 2.111111111 | Developing | 75.0% | 0 |
| A6 | Early Warning & Risk Communication | 7 | 7 | 1.933333333 | Developing | 25.0% | 3 |
| A7 | Preparedness & Community Capacity | 9 | 9 | 2.117647059 | Developing | 40.0% | 1 |
| A8 | Response Capability | 9 | 9 | 1.772727273 | Developing | 25.0% | 5 |
| A9 | Rehabilitation & Recovery | 5 | 5 | 1.375000000 | Initial | 0.0% | 0 |
| A10 | Partnerships, M&E & Accountability | 9 | 9 | 1.857142857 | Developing | 25.0% | 1 |

## Part B domain values

| Code | Domain | Indicators | Scored | Maturity Index | Band | Mandatory Compliance | High gaps |
|---|---|---:|---:|---:|---|---:|---:|
| B1 | EOC Legal Basis & Concept of Operations | 5 | 5 | 2.230769231 | Developing | 20.0% | 2 |
| B2 | EOC Facility, Site & Resilience | 7 | 7 | 2.533333333 | Compliant | 75.0% | 1 |
| B3 | EOC Communications & ICT | 6 | 6 | 1.909090909 | Developing | 33.3% | 1 |
| B4 | EOC Organization & Staffing | 6 | 6 | 1.307692308 | Initial | 0.0% | 2 |
| B5 | Information Management & Reporting | 7 | 7 | 1.466666667 | Initial | 0.0% | 3 |
| B6 | Coordination & Resource Management | 6 | 6 | 1.384615385 | Initial | 0.0% | 2 |
| B7 | EOC SOPs, Training, Exercises & Continuity | 6 | 6 | 2.083333333 | Developing | 25.0% | 1 |

## Part C

| Part | Indicators | Scored | Maturity Index | Band | High gaps |
|---|---:|---:|---:|---|---:|
| C — Interface | 15 | 15 | 1.407407407 | Initial | 2 |

The workbook notes that Part C is scored using the same rubric but reported separately because its indicators are owned by other offices.

## Important interpretation controls

1. The workbook dashboard reports all 140 evidence-validation statuses as Pending validation. Evidence validation is a separate control; it does not automatically alter scores.
2. “Compliant” in the maturity-band column is a maturity classification, not proof that all mandatory indicators in the domain are compliant. Example: A3 has a 2.61 maturity index (Compliant band) but 50.0% Mandatory Compliance.
3. The workbook's 125 scored indicators are A+B; Part C is separately scored. Confirm exact NA and blank handling against the detailed indicator sheets before reproducing coverage cards.
4. These values describe the workbook snapshot, not a live assessment cycle. MODE must query the selected current cycle and display its own source date/version.
5. Do not hard-code these values in production UI, seed them as new assessment records, or present them as current without verifying the selected assessment cycle and evidence validation state.
