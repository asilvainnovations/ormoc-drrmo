# ADR-037: Training runs — Tool results as IAT evidence, positions and counts only (v1.21.0)

Status: Proposed, 14 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.

## Context

The readiness tools (ICS exercise simulator, ECHO simulator, PSCP workbench, GK self-check) keep their run history in the browser (ADR-011), so a good exercise leaves nothing the IAT can use as evidence — and the evidence cap keeps the B7.2–B7.4 and B2.7 scores down. The assessor's review asked that a Tool run be saveable as a training record and fileable as evidence, without ever letting a tool set a score.

## Decision

1. **`training_runs`** (migration `20261114003100`): tool, title, run time, outcome summary and `counts` — a JSON object of aggregate counts and positions ONLY (RA 10173: never personal names). Reads for every active user; saving a record and filing it are authority actions (ADR-006) for the assessor, validator, CDRRMO Head or admin, enforced by `app.guard_training_run`. Filing stamps `filed_by`/`filed_at` and never reopens; a record is corrected, never removed; versions guard concurrent edits (PT409).
2. **"Save run record" and "File as evidence"** appear on the ICS results page and the ECHO exercise report (`RunFiling`, shown only to the filing roles, online only). Filing adds an evidence row of kind `test` to the indicator's response in the latest assessment cycle — opening the response first if needed, exactly like the Assess evidence sheet — and links the run to the evidence via `evidence.training_run_id` (navigation only). Only B7.2, B7.3, B7.4 and B2.7 are offered, per the assessment.
3. **Scores never move.** The evidence cap and the score rules are untouched: the assessor owns the score; the run simply becomes the evidence the assessor was asked for.

## Consequences

- Participant and facilitator names never leave the browser; the server record carries roles, offices and counts.
- A filed run is visible from the Assess indicator page like any other evidence, and the run record itself stays readable for the record.
