# ADR-029: Validation workshop controls and Chapter 5 in the platform (v1.15.0)

Status: Proposed, 12 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head to accept before the workshop of 1–4 December 2026. Migration `20261112002700_validation_workshop.sql`.

## Context
The 140 baseline scores must be validated before the Situational Analysis Report and before the Manual chapters cite them as final (Methodology v1.1 §6). Before this release any validator could validate any score, including one they set, a changed score needed no reason, and the score that was submitted was not kept. Chapter 5 (DRRM financing) was an empty shell merged into Area 1, while IAT A4.6 (anticipatory action funding) is a High gap.

## Decision
1. **Separation of duties in SQL.** `guard_response_workflow` stamps `scored_by` when a signed-in user changes a score or NA. A validation by that person is refused (42501). A score cannot be inserted as validated.
2. **Confirm or revise.** A validation is recorded as `confirmed` or `revised`; `score_before_validation` keeps the submitted score; a revision needs `validation_note` (23514). Reopening clears all three.
3. **Baseline rows have no scorer.** They were loaded from the workbook (`scored_by` null). The platform cannot tell who scored them, so Methodology v1.1 §6.1 rule 7 makes this a procedural control: the lead assessor does not validate baseline items.
4. **Workshop screens** read `v_validation_progress` (security invoker): progress, agreement rate, a queue, printable sheets (offline fallback) and a results board.
5. **Chapter 5 v1.0** becomes a written chapter (primary Area 1, also Area 7) with ten SOPs: WF-BUDGET-CYCLE carries SOPs 5-01 and 5-02; eight new templates carry 5-03 to 5-10; nine FIN forms. Expenditure, certification, procurement and award stay with the offices that hold them by law.
6. **Superseded shells that become chapters return to draft** in the seed, only when their status is `superseded`.

## Consequences
- A validator who changes a score and validates it in one save is recorded as revising it; if they first save the change and then validate, they become the scorer and another validator must validate. The indicator page explains this.
- Agreement rate is a calibration signal, not a performance measure.
- Legal readings in Chapter 5 sec. 17 (AA line by realignment; meaning of "allocation"; slow-onset hazards; "time is of the essence" without a State of Calamity; LDRRMF base) go to the City Legal Office and OCD VIII before adoption. AA tranche parameters stay in `aa_rules` (ADR-025).
