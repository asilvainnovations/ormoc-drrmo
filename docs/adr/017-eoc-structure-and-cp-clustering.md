# ADR-017: EOC positions and designations; contingency plans activate response clusters (v1.9.0)

Status: Accepted, 6 Nov 2026.

## Context
The Brief Assessment and the Cluster Coordinator proposal (Chapters 1 and 2, Draft 1.2) found that EOC positions are not designated three deep (IAT B4.1, B4.2), that the response clusters are not tied to the contingency plans, and that barangay reporting needs a cluster-level liaison. The City chose "Disaster Response Clustering following Contingency Plans activation" as the validation exercise for 1–4 December 2026.

## Decision
1. **Positions and designations.** `eoc_positions` lists the EOC's positions by section with a required depth (primary and two alternates). `eoc_designations` names an office and a position title (not a person's name) and may link an app account. Anyone who staffs the EOC proposes, offline if need be; only the CDRRMO Head approves (online); an approved designation is fixed and is withdrawn, not edited. `v_eoc_depth` and `src/domain/structure.ts` give the two-deep share for B4.2.
2. **Contingency plans** (`contingency_plans`) carry status (to prepare, draft, adopted, expired, retired), adoption reference and validity, and an activation set (`cp_activation_items`): which of the ten response clusters and eight EOC modules are lead, on or standby, and from which level.
3. **Activation** is an authority action: `activate_contingency_plan(plan)` (EOC Manager or Head, online, on an open Blue or Red activation) opens the set on the activation; items whose minimum level is above the current level wait on standby. A level change carries the plan and its clusters forward, and raising to Red brings standby items up to the plan's state. Each change is logged.
4. **Barangay clusters** (D1–D6, pilots D1 and D3 from June to November 2027) group the 85 barangays; hazard tags come from one register (the CDRA) with their source. The Barangay Liaison Desk shows reporting and silent barangays per cluster in the current activation (`v_cluster_status`, mirrored in `clusterStatus`).
5. No new role for cluster coordinators: the existing ten roles cover them (ADR-004).

## Consequences
- Only CP-FLOOD-LUNOP is adopted (CDRRMC Res. 2-A, 2021); the earthquake plan has expired; five plans are still to prepare. Activating a non-adopted plan works and says so in the log.
- Designations hold office and position titles, so a change of person does not need a new approval unless the position changes.
