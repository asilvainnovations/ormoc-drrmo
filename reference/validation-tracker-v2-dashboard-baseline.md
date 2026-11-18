# Validation Tracker V-2: dashboard baseline reference

**Source workbook:** `Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx` (controlled draft, 12 Nov 2026). Not committed to `reference/`; not seen in this review.
**Figures taken from:** seed part 40 (`supabase/seed/parts/40_manual_governance.sql`, import batch `db26522b-620c-5f35-aced-fde42d25d3c4`), loaded into the test database built from `main` at `e2bee21`, 18 November 2026.
**Use:** reconciliation fixture for the dashboard. Not a live feed. Counts are import controls (ADR-043), not constants; the dashboard reads live tables.

| Register | Rows | Source IDs |
|---|---:|---|
| Review items (`manual_review_items`) | 69 | VR-001 … |
| Outstanding decisions (`outstanding_decisions`) | 18 | OD-01 … OD-18 |
| Workshop sessions (`workshop_sessions`) | 12 | WS-01 … WS-12 |
| Stakeholders (`manual_governance_stakeholders`) | 29 | SH-01 … |
| Workshop links (session to item, session to decision) | 0, 0 | link tables empty |

## Review items

| Priority | Open | Total |
|---|---:|---:|
| critical_urgent | 24 | 24 |
| important | 22 | 22 |
| standard | 23 | 23 |

All 69 are `review_status = open` and `validation_status = not_started`. No item has `closed_at`.

| Chapter ref | Items |
|---|---:|
| Ch. 1 | 10 |
| Ch. 4 | 14 |
| Ch. 5 | 11 |
| Ch. 6 | 10 |
| Ch. 7 | 6 |
| Ch. 8 | 7 |
| Ch. 9 | 5 |
| Ch. 10 | 6 |

No item is assigned to Ch. 2 or Ch. 3. Every item has a `chapter_ref` and a `lead_office`.

## Outstanding decisions

18 rows: 9 critical_urgent and 9 important. All `for_decision`. All `authority_status = to_be_confirmed`. None has a `decision_reference` or `decision_date`.

## Workshop sessions and stakeholders

12 sessions, all `planned`, all `scheduled_date_raw = 'TBA'` (no date).
29 stakeholders: 20 critical_urgent, 9 important. Designation status values are source text, such as "Required validator" (16) and "PROPOSED LEAD, validate at workshop" (9); they are proposals until the workshop confirms them.

## Bridge to the IAT (by Manual chapter)

See `docs/implementation/dashboard-dual-source-addendum.md` §3. Chapter-level counts there are multi-counted and must not be summed.
