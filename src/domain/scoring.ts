// IAT v1.1 scoring rules (methodology §5). Mirrors the SQL in
// supabase/migrations/20261015000200_iat.sql; scoring.parity.test.ts keeps them aligned.
import type { Domain, Evidence, EvidenceStrength, Indicator, Response } from '@/types';

export const EVIDENCE_CAP: Record<EvidenceStrength, number> = {
  verbal: 2,            // interviews/FGDs alone cannot raise a score above 2
  partial: 2,
  approved_in_use: 3,
  tested_improved: 4,
};

export const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  verbal: 'Interview or FGD account',
  partial: 'Draft or partial document, or partial practice seen',
  approved_in_use: 'Approved document and proof it is used',
  tested_improved: 'Tested, exercised or reviewed, with improvement shown',
};

export const SCORE_LEVELS = [
  { score: 0, label: 'Absent', text: 'Not in place, and no plan to establish it.' },
  { score: 1, label: 'Initial', text: 'Done informally. Depends on individuals. Not documented.' },
  { score: 2, label: 'Developing', text: 'Exists but incomplete, outdated, unapproved or applied inconsistently.' },
  { score: 3, label: 'Compliant', text: 'Meets the legal or policy standard. Documented, approved and applied.' },
  { score: 4, label: 'Advanced', text: 'Exceeds the standard. Tested, reviewed and improved regularly.' },
] as const;

export type Band = 'Absent' | 'Initial' | 'Developing' | 'Compliant' | 'Advanced';
export type Priority = 'High' | 'Medium' | 'Low';
export type Compliance = 'Compliant' | 'Non-compliant' | 'Meets GP' | 'Below GP' | 'N/A' | 'Not scored';

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function evidenceCap(evidence: Pick<Evidence, 'strength'>[]): number {
  return evidence.reduce((m, e) => Math.max(m, EVIDENCE_CAP[e.strength]), 0);
}

/** Why a given score is not allowed, or null if it is. */
export function scoreBlockReason(score: number, cap: number): string | null {
  if (score === 0 || score <= cap) return null;
  if (cap < 3 && score >= 3) return 'A score of 3 needs an approved document and proof it is used. Interviews alone cap the score at 2.';
  if (score === 4) return 'A score of 4 needs a test, exercise or after-action review showing improvement.';
  return `Add evidence first. The evidence so far supports a score of ${cap} at most.`;
}

export function gapPriorityScore(score: number | null, weight: number, type: 'M' | 'GP', part: string): number | null {
  if (score === null) return null;
  return (4 - score) * weight * (type === 'M' && part !== 'C' ? 1.5 : 1.0);
}

export function priorityBand(gps: number | null): Priority | null {
  if (gps === null) return null;
  return gps >= 9 ? 'High' : gps >= 4 ? 'Medium' : 'Low';
}

export function maturityBand(idx: number | null): Band | null {
  if (idx === null) return null;
  if (idx < 0.5) return 'Absent';
  if (idx < 1.5) return 'Initial';
  if (idx < 2.5) return 'Developing';
  if (idx < 3.5) return 'Compliant';
  return 'Advanced';
}

export function complianceStatus(r: Pick<Response, 'score' | 'is_na'> | undefined, type: 'M' | 'GP', part: string): Compliance {
  if (!r) return 'Not scored';
  if (r.is_na) return 'N/A';
  if (r.score === null) return 'Not scored';
  if (type === 'M' && part !== 'C') return r.score >= 3 ? 'Compliant' : 'Non-compliant';
  return r.score >= 3 ? 'Meets GP' : 'Below GP';
}

export interface ResultRow { scored: number; indicators: number; maturityIndex: number | null; band: Band | null; mandatoryCompliance: number | null; highGaps: number }

interface Scored { score: number; weight: number; type: 'M' | 'GP'; part: string }

function summarise(items: Scored[], indicators: number): ResultRow {
  const w = items.reduce((s, i) => s + i.weight, 0);
  const sw = items.reduce((s, i) => s + i.score * i.weight, 0);
  const idx = w === 0 ? null : round(sw / w, 2);
  const m = items.filter((i) => i.type === 'M' && i.part !== 'C');
  const mc = m.length === 0 ? null : round(m.filter((i) => i.score >= 3).length / m.length, 4);
  const high = items.filter((i) => priorityBand(gapPriorityScore(i.score, i.weight, i.type, i.part)) === 'High').length;
  return { scored: items.length, indicators, maturityIndex: idx, band: maturityBand(idx), mandatoryCompliance: mc, highGaps: high };
}

export interface CycleResults {
  domains: Record<string, ResultRow>;
  partA: ResultRow; partB: ResultRow; imi: ResultRow; interface: ResultRow;
  answered: number; total: number;
}

/** Domain, Part, Institutional Maturity (A+B) and Interface (C) results for one cycle. */
export function cycleResults(indicators: Indicator[], domains: Domain[], responses: Response[]): CycleResults {
  const partOf = new Map(domains.map((d) => [d.code, d.part]));
  const byInd = new Map(responses.map((r) => [r.indicator_id, r]));
  const scored: (Scored & { domain: string })[] = [];
  for (const i of indicators) {
    const r = byInd.get(i.id);
    if (r && !r.is_na && r.score !== null) scored.push({ score: r.score, weight: i.weight, type: i.type, part: partOf.get(i.domain) ?? 'A', domain: i.domain });
  }
  const count = (pred: (i: Indicator) => boolean) => indicators.filter(pred).length;
  const domainsOut: Record<string, ResultRow> = {};
  for (const d of domains) {
    domainsOut[d.code] = summarise(scored.filter((s) => s.domain === d.code), count((i) => i.domain === d.code));
  }
  const inPart = (p: string) => (i: Indicator) => partOf.get(i.domain) === p;
  return {
    domains: domainsOut,
    partA: summarise(scored.filter((s) => s.part === 'A'), count(inPart('A'))),
    partB: summarise(scored.filter((s) => s.part === 'B'), count(inPart('B'))),
    imi: summarise(scored.filter((s) => s.part === 'A' || s.part === 'B'), count((i) => partOf.get(i.domain) !== 'C')),
    interface: summarise(scored.filter((s) => s.part === 'C'), count(inPart('C'))),
    answered: responses.filter((r) => r.is_na || r.score !== null).length,
    total: indicators.length,
  };
}
