# ADR-016: Every workflow and protocol step is recorded on a form; the DRRM module (v1.9.0)

Status: Accepted, 6 Nov 2026. Extends ADR-013.

## Context
On 6 Nov 2026 the City decided that "all Protocols or protocol steps need form to accomplish. And it should be implemented in the platform", and asked for a DRRM module to hold the office's Workflows and Protocols. The Manual already defines forms and registers (GOV-F.., HR-F.., EOC-GIS-..); many steps have none.

## Decision
1. **Forms are data.** `form_templates` holds each form's fields as a JSON schema (text, number, whole number, date, time, choice, several choices, tick box). Forms start as drafts; only the CDRRMO Head approves, reopens or retires one; an approved form's fields are fixed and its revision number rises when they change.
2. **Every step names a form**: the Manual's form where there is one, otherwise `STEP-RECORD` (outcome: done as written or done with changes, remarks, record reference). On screen STEP-RECORD is one tap: *Done* records "as written", or "with changes" when remarks were entered.
3. **Runs keep a snapshot.** `start_protocol` copies the form's code, revision and schema into each run step. The device makes the same snapshot offline. A later revision never changes a past record.
4. **Done needs a complete form.** `app.form_problems(schema, data)` names what is missing or wrong, in the user's words; the run-step guard refuses *done* until it returns nothing. `src/domain/forms.ts` mirrors it (parity cases in `forms.cases.json`, generated from Postgres). Skipped and not-applicable steps need a reason, not a form. Form data is capped at 32 KB per step and holds institutional records and counts only.
5. **DRRM module.** `/drrm` replaces `/protocols` (old links redirect) with three tabs: *Workflows* (governance, workforce, budget, contingency plans and clusters, Geo-COP), *Protocols* (duty, warning, EOC, anticipatory action, reporting, recovery) and *Forms*.

## Consequences
- 14 templates, 94 steps and 29 forms load as drafts for the December validation workshop; the Head approves each.
- Editing a form's fields in the app is not built yet; fields change through the reference data (`scripts/forms_seed.py`) while drafts.
