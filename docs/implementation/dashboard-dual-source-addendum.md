# Dashboard dual-source addendum: IAT v1-7 and the Validation Tracker

**Added:** 18 November 2026, at the CDRRMO's request, to the MODE 1.23.0 dashboard handover (ADR-044).
**Status:** Proposed. Read with `dashboard-data-contract.md` and `MODE-1.23.0-dashboard-analytics-spec.md`.

The handover treats the IAT as the dashboard's data source and mentions governance only in passing. The dashboard must draw on two controlled sources. This addendum says what each source answers, how they connect and where they must not be joined.

## 1. The two sources

| | **IAT v1-7** | **Validation Tracker V-2** |
|---|---|---|
| Question it answers | How mature is the institution, and where are the gaps? | How far has review and validation of the Manual got? What is still undecided? |
| Controlled file | `reference/Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx` | `Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx` (12 Nov 2026). **Not in `reference/` yet.** |
| In MODE | `assessment_cycles` (`iat_version` 1.7), `iat_indicators`, `v_response_results`, `v_domain_results`, `v_cycle_results`, `v_validation_progress` | `manual_review_items`, `outstanding_decisions`, `workshop_sessions`, `manual_governance_stakeholders`, link tables, `manual_governance_import_batches` (ADR-043, seed part 40) |
| Dexie (offline) | yes | yes (`src/lib/db.ts`, `src/lib/tables.ts`) |
| Read access | any active user (RLS) | any authenticated user (RLS `mri_select`, `od_select`, `ws_select`, `mgs_select`) |
| Writes the dashboard may do | none | none |

The dashboard reads from MODE's database through Dexie and approved views. It does not read either `.xlsx` file at run time. The files are fixtures and reconciliation sources only.

## 2. Rules for combining them

1. **Two panels, two vocabularies, no combined score.** The IMI, Mandatory Compliance and Interface Index come from the IAT only. Tracker counts never enter any IAT figure.
2. **A closed review item does not raise a score.** Indicator scores change only through Assess validation (evidence rules, Methodology §5.2). The dashboard must not show a tracker closure as an IAT improvement.
3. **Review, validation, approval and effectivity stay apart** (ADR-043). A validated item is not approved. Show `review_status`, `validation_status`, `decision_status` and `authority_status` as separate fields, never as one "done" figure.
4. **Blank is not zero.** A null `target_date`, `scheduled_date`, `decided_by` or `lead_office` is "not recorded". `scheduled_date_raw = 'TBA'` is "to be announced", not a date.
5. **No inferred due dates, owners or authority.** `authority_status = to_be_confirmed` is shown as such. An accountable owner is not shown as the decision authority.
6. **Decision support only** (ADR-044 §6). Nothing on either panel triggers an action.

## 3. How the two connect: by Manual chapter, not by indicator

Tested on 18 November 2026 against the database built from `main` (`e2bee21`):

- Only **2 of 69** review items name an IAT indicator ID in their text, so a join by indicator ID is not possible.
- The reliable bridge is the chapter: tracker `chapter_ref` ("Ch. 4") → `moo_documents.chapter_no` → `moo_document_indicators` → `iat_indicators` → `v_response_results`.

| Chapter | IAT indicators linked | of which High gap | Tracker items | of which Critical & Urgent |
|---:|---:|---:|---:|---:|
| 1 | 19 | 11 | 10 | 6 |
| 2 | 15 | 6 | none | none |
| 3 | 25 | 1 | none | none |
| 4 | 33 | 13 | 14 | 9 |
| 5 | 15 | 1 | 11 | 2 |
| 6 | 19 | 2 | 10 | 5 |
| 7 | 13 | 1 | 6 | 0 |
| 8 | 20 | 2 | 7 | 1 |
| 9 | no linked document | n/a | 5 | 0 |
| 10 | no linked document | n/a | 6 | 1 |

Reading the table:

- **Never sum the indicator columns across chapters.** One indicator can be linked to documents in several chapters, so the column adds to 159, not 140.
- Chapters 1 and 4 carry both the most High gaps and the most Critical & Urgent review items. This supports a "validation attention versus assessment gap" view, labelled as a coincidence of coverage and not as a cause.
- Chapters 2 and 3 have High-gap indicators but no tracker items. Chapters 9 and 10 have tracker items but no IAT-linked document. Show both as gaps in coverage, not as zero risk.
- The IAT "Feeds Manual Chapter" column still uses pre-renumbering codes. The generator remaps them at build time (ADR-032). The bridge is only as good as that remap; any workbook renumber sweep must re-run the bridge test.

## 4. Dashboard content from the Tracker

| Panel item | Definition | Source field | Baseline (seed part 40) |
|---|---|---|---:|
| Review items by status | count by `review_status` | `manual_review_items` | open 69 |
| Review items by priority | count by `priority` | same | critical_urgent 24, important 22, standard 23 |
| Review items by chapter | count by `chapter_ref` | same | see §3 |
| Items awaiting evidence | `review_status = 'pending_evidence'` | same | 0 |
| Items closed with disposition | `closed_at is not null`, disposition shown | same | 0 |
| Outstanding decisions by status | count by `decision_status` | `outstanding_decisions` | for_decision 18 |
| Decisions with authority not confirmed | `authority_status = 'to_be_confirmed'` | same | 18 |
| Decisions by priority | count by `priority` | same | critical_urgent 9, important 9 |
| Workshop sessions by status | count by `status` | `workshop_sessions` | planned 12 |
| Sessions with linked items or decisions | rows in link tables | `workshop_session_*` | 0 |
| Stakeholders by criticality | count by `criticality` | `manual_governance_stakeholders` | critical_urgent 20, important 9 |

Trend: the tracker has one import and no closures yet, so there is nothing to trend. A burn-down may be drawn only from real `closed_at` and `decision_date` values once they exist. No history is invented (ADR-044 §3).

## 5. Dashboard content from the IAT (confirmed, unchanged)

The IAT panel follows `reference/iat-v1.7-dashboard-baseline.md`. The database built from `main` reproduces it:

- IMI (A+B) 1.984732824, from 125 scored indicators (A 82, B 43; 79 Mandatory, 46 Good Practice).
- High gaps: A 18, B 12 (30 for A+B), plus 2 in Part C (32 in all). The headline "30" is A+B only; label it.
- Part C Interface Index stays separate.

IAT figures remain provisional: all rows are "Pending validation", and a score resting only on FGD or interview evidence is capped at 2 until validated (Methodology §5.2).

## 6. Additional release gates

Add to `dashboard-qa-release-gates.md`:

1. **Tracker reconciliation.** Row counts shown on the dashboard equal the latest `manual_governance_import_batches` row and the live table counts (baseline 69 / 18 / 12 / 29). A mismatch shows a warning, not a silent number.
2. **No cross-contamination.** A test changes tracker statuses and asserts the IMI, Mandatory Compliance and Interface Index are unchanged.
3. **Bridge test.** A fixture for §3 fails when a chapter renumber or a document-to-indicator link changes.
4. **Null handling.** Fixtures with null dates, null lead office and `TBA` render "not recorded", never 0 or a date.
5. **Separate status fields.** No single "done" or "validated" figure combines review, validation and decision status.
6. **Role and offline checks** repeat the existing RLS and freshness gates for the four tracker tables.

## 7. Open items

- **Supply the Tracker workbook.** The figures above come from seed part 40 loaded in a test database. They reconcile with ADR-043's 69 / 18 / 12, but I have not seen the `.xlsx` itself. Commit it to `reference/` and add a row-level check, as for the IAT.
- **Release number.** "1.23.0" is used by the governance workstream (ADR-043). Choose the dashboard's number before cutting the implementation branch.
- **Slice 1 status vocabulary.** Review, validation and decision status values are still to be confirmed by the CDRRMO. The dashboard reads them as stored and does not rename them.
