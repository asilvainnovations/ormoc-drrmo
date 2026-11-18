// Dashboard figures (1.24.0). Pure functions over rows already on the device; no I/O.
//
// Two controlled sources, kept apart on purpose:
//   1. The Institutional Assessment Tool (IAT): what the institution has in place, scored 0-4.
//   2. The Validation Tracker: what the Manual still needs, reviewed and decided before the workshop.
// There is no combined score. A tracker status never changes an IAT figure, and the other way round.
// Scoring rules live in SQL and src/domain/scoring.ts; this file only reads them.
import type { Domain, Indicator, ManualReviewItem, OutstandingDecision, Response, WorkshopSession } from '@/types';
import { cycleResults, type Band } from './scoring';

export interface IatDomainRow { code: string; name: string; part: 'A' | 'B' | 'C'; index: number | null; band: Band | null; scored: number; indicators: number; highGaps: number }
export interface IatSnapshot {
  /** Parts A and B only (the IMI). null until at least one indicator is scored: show "not scored", never 0. */
  imi: number | null; band: Band | null;
  /** Part C, reported on its own and never added to the IMI. */
  interfaceIndex: number | null;
  scored: number; indicators: number;
  /** Mandatory indicators in Parts A and B scored 3 or 4, out of all Mandatory indicators (not out of scored ones). */
  mandatoryMet: number; mandatoryTotal: number;
  highGaps: number;
  domains: IatDomainRow[];
}

export function iatSnapshot(indicators: Indicator[], domains: Domain[], responses: Response[]): IatSnapshot {
  const res = cycleResults(indicators, domains, responses);
  const partOf = new Map(domains.map((d) => [d.code, d.part]));
  const byInd = new Map(responses.map((r) => [r.indicator_id, r]));
  const mandatory = indicators.filter((i) => i.type === 'M' && partOf.get(i.domain) !== 'C');
  const mandatoryMet = mandatory.filter((i) => {
    const r = byInd.get(i.id);
    return !!r && !r.is_na && r.score !== null && r.score >= 3;
  }).length;
  return {
    imi: res.imi.maturityIndex, band: res.imi.band, interfaceIndex: res.interface.maturityIndex,
    scored: res.imi.scored, indicators: res.imi.indicators,
    mandatoryMet, mandatoryTotal: mandatory.length,
    highGaps: res.partA.highGaps + res.partB.highGaps,
    domains: [...domains].sort((a, b) => a.sort - b.sort).map((d) => {
      const r = res.domains[d.code];
      return { code: d.code, name: d.name, part: d.part, index: r?.maturityIndex ?? null, band: r?.band ?? null, scored: r?.scored ?? 0, indicators: r?.indicators ?? 0, highGaps: r?.highGaps ?? 0 };
    }),
  };
}

/** The change between two cycles. null when either side has no index, so a missing score is never read as 0. */
export function indexDelta(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : Math.round((current - previous) * 100) / 100;
}

export interface TrackerSnapshot {
  items: { total: number; open: number; closed: number; deferred: number; criticalOpen: number; awaitingDecision: number; awaitingEvidence: number };
  decisions: { total: number; forDecision: number; decided: number; criticalForDecision: number; authorityToConfirm: number };
  sessions: { total: number; completed: number; next: WorkshopSession | null };
}

export function trackerSnapshot(items: ManualReviewItem[], decisions: OutstandingDecision[], sessions: WorkshopSession[]): TrackerSnapshot {
  const isOpen = (i: ManualReviewItem) => i.review_status !== 'closed' && i.review_status !== 'deferred';
  const pendingDecision = (d: OutstandingDecision) => d.decision_status === 'for_decision' || d.decision_status === 'in_progress';
  const upcoming = sessions
    .filter((s) => s.status === 'planned' || s.status === 'in_progress')
    .sort((a, b) => (a.scheduled_date ?? '9999').localeCompare(b.scheduled_date ?? '9999') || a.session_number - b.session_number)[0] ?? null;
  return {
    items: {
      total: items.length,
      open: items.filter(isOpen).length,
      closed: items.filter((i) => i.review_status === 'closed').length,
      deferred: items.filter((i) => i.review_status === 'deferred').length,
      criticalOpen: items.filter((i) => isOpen(i) && i.priority === 'critical_urgent').length,
      awaitingDecision: items.filter((i) => i.review_status === 'pending_decision').length,
      awaitingEvidence: items.filter((i) => i.review_status === 'pending_evidence').length,
    },
    decisions: {
      total: decisions.length,
      forDecision: decisions.filter(pendingDecision).length,
      decided: decisions.filter((d) => d.decision_status === 'decided').length,
      criticalForDecision: decisions.filter((d) => pendingDecision(d) && d.priority === 'critical_urgent').length,
      authorityToConfirm: decisions.filter((d) => pendingDecision(d) && d.authority_status === 'to_be_confirmed').length,
    },
    sessions: { total: sessions.length, completed: sessions.filter((s) => s.status === 'completed').length, next: upcoming },
  };
}
