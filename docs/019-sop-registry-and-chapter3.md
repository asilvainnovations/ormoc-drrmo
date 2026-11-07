# ADR-019: One SOP registry: every protocol and workflow names its SOP, process owner, forms, indicators and policy basis; Chapter 3 runs in the platform (v1.10.0)

Status: Accepted, 8 Nov 2026. Extends ADR-016.

## Context
On 8 Nov 2026 the City asked: (1) what is the difference between an SOP and a protocol, and are the terms used loosely; (2) whether each area of the Manual is delivered consistently, from guidance and structure to SOP or protocol, process owner, forms, required indicators and policy references; and (3) that Chapter 3 (Risk Information, Assessment and Planning) be built into the platform, not only filed in the Library and the Vault.

The codebase used three words for overlapping things. Chapter text said "SOP". Template codes began `PR-` (protocol) or `WF-` (workflow). The DRRM module split its templates by category in the browser only. No template recorded its controlling SOP, its owner, or the indicators it serves.

## Decision
1. **Definitions** (Annex 3-N glossary; the in-app labels follow them):
   - **SOP**: the controlled Manual text that says who does what, when, and with what authority. It is approved by the CDRRMO Head and versioned in the Library.
   - **Protocol**: a point-of-action checklist that carries out part of an SOP during an event or a duty shift, often under time pressure. Its categories are daily operations, warning, EOC, anticipatory action, reporting and recovery.
   - **Workflow**: a multi-office management cycle that carries out an SOP over days or months, for example governance, workforce, budget, contingency planning, Geo-COP and the Chapter 3 risk-information cycle.
   - **Form**: the record that closes a step (ADR-016).
2. **The registry lives on `protocol_templates`** (migration `20261108002000_sop_registry.sql`):
   - `kind` (protocol or workflow), backfilled by category and required;
   - `sop_ref`, the Manual section that controls the template;
   - `process_owner`, a position or office, never a person's name;
   - `policy_refs[]`, written in `RefText` citation form;
   - `indicator_ids[]`. The guard refuses an unknown indicator (SQLSTATE 23503).
   These fields are fixed once a template is approved, like its steps. `v_indicator_sops` answers "which SOPs serve indicator X".
3. **Chapter 3 enters as data, not prose:**
   - Forms 3-01 to 3-11;
   - nine workflows, WF-SOP3-01 to WF-SOP3-09, in four new categories: risk information, risk planning, contingency planning and continuity;
   - Library documents for Chapter 3 v1.0 and Annexes 3-A to 3-N, with the figures under `public/library/ch3v10/`.
   Their metadata is in `scripts/sop_registry.py`, and every template has a registry entry (the seed asserts this).
4. **The template sheet shows an SOP control block**: type, controlling SOP, process owner, policy basis and IAT indicators. The Chapter 3 text carries the same block after each SOP (Tables 3.3 to 3.11).

## Consequences
- 23 templates (8 protocols and 15 workflows), 161 steps and 40 forms load as drafts for the December validation workshop.
- Chapters 1 and 2 already map to templates. Their registry entries were filled from the chapter text; the validation workshop should confirm each process owner.
- A new template must have a registry entry, or the seed generator stops.
