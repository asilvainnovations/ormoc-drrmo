// EOC capability assessment rules (ADR-035). This module mirrors app.eoc_assessment_status
// (supabase/migrations/20261114003000_eoc_assessment.sql): the rule lives in SQL, this is the
// TypeScript mirror (ADR-005), and src/domain/eoc_assessment.test.ts keeps them in parity.
// The module never re-scores risk — DDRiVE stays the risk-intelligence source; the board links out.
import type { EocAssessmentStatus } from '@/types';

/**
 * Item status from the mapped IAT B_EOC indicator scores: the weakest (lowest) score decides —
 * 3 or 4 = met, 2 = partially met, 1 = largely unmet, 0 = not met. NA (null/undefined) scores
 * are ignored; an item with no mapped indicator (or only NA scores) has no direct IAT indicator.
 * Mirrors app.eoc_assessment_status exactly.
 */
export function deriveStatus(scores: ReadonlyArray<number | null | undefined>): EocAssessmentStatus {
  const present = scores.filter((s): s is number => typeof s === 'number');
  if (present.length === 0) return 'no_direct_indicator';
  const min = Math.min(...present);
  if (min >= 3) return 'met';
  if (min === 2) return 'partially_met';
  if (min === 1) return 'largely_unmet';
  return 'not_met';
}

/** Statuses in severity order (best first), for summary counts and legends. */
export const STATUS_ORDER: EocAssessmentStatus[] = ['met', 'partially_met', 'largely_unmet', 'not_met', 'not_applicable', 'not_assessed', 'no_direct_indicator'];
/** Statuses a person can record on site (no_direct_indicator is a pre-fill value only). */
export const OBSERVED_STATUSES: EocAssessmentStatus[] = ['met', 'partially_met', 'largely_unmet', 'not_met', 'not_applicable', 'not_assessed'];

/** Count responses per status, in STATUS_ORDER, including the zeros. */
export function statusCounts(statuses: ReadonlyArray<EocAssessmentStatus>): Record<EocAssessmentStatus, number> {
  const counts: Record<EocAssessmentStatus, number> = { met: 0, partially_met: 0, largely_unmet: 0, not_met: 0, not_applicable: 0, not_assessed: 0, no_direct_indicator: 0 };
  for (const s of statuses) counts[s] += 1;
  return counts;
}
