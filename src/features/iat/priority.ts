/** 1.17 (ADR-031): the Pareto priority set — the 22 IAT indicators that carry most of the readiness
 * gain, chosen for leverage: strategic (they unblock other indicators), CDRRMO-controllable, and
 * implementable within about a quarter (one ordinance, one EO, one funded staffing item).
 * Curated by the assessment team from the coherence analysis; it is a judgment, not a computed
 * ranking — revise it with each cycle. Stated for users in the Introduction chapter §4.4. */
export interface PriorityIndicator { id: string; tier: 1 | 2 | 3 }

export const PRIORITY_INDICATORS: PriorityIndicator[] = [
  // Tier 1 — the basics: legal mandate, council, staffing, fund access.
  { id: 'A1.1', tier: 1 }, { id: 'A1.2', tier: 1 }, { id: 'A2.2', tier: 1 }, { id: 'A2.3', tier: 1 },
  { id: 'A4.1', tier: 1 }, { id: 'A4.2', tier: 1 },
  // Tier 2 — EOC establishment, alert levels, contingency planning, warning, anticipatory action.
  { id: 'B1.1', tier: 2 }, { id: 'B1.2', tier: 2 }, { id: 'B1.3', tier: 2 }, { id: 'A3.3', tier: 2 },
  { id: 'A6.1', tier: 2 }, { id: 'A6.2', tier: 2 }, { id: 'A6.3', tier: 2 }, { id: 'B4.1', tier: 2 },
  { id: 'B4.2', tier: 2 }, { id: 'A8.6', tier: 2 }, { id: 'A8.8', tier: 2 },
  // Tier 3 — audit, M&E, recovery procedures, the State of Imminent Disaster workflow.
  { id: 'A4.6', tier: 3 }, { id: 'A10.4', tier: 3 }, { id: 'A10.6', tier: 3 }, { id: 'A10.8', tier: 3 },
  { id: 'A7.3', tier: 3 }, { id: 'A1.8', tier: 3 },
];

export function priorityOf(id: string): 1 | 2 | 3 | null {
  return PRIORITY_INDICATORS.find((p) => p.id === id)?.tier ?? null;
}
