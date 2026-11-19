// Dashboard figures (1.24.0). Pure functions over rows already on the device; no I/O.
//
// Two controlled sources, kept apart on purpose:
//   1. The Institutional Assessment Tool (IAT): what the institution has in place, scored 0-4.
//   2. The Validation Tracker: what the Manual still needs, reviewed and decided before the workshop.
// There is no combined score. A tracker status never changes an IAT figure, and the other way round.
// Scoring rules live in SQL and src/domain/scoring.ts; this file only reads them.
import type { Action, Domain, Indicator, ManualReviewItem, OutstandingDecision, Response, Role, WorkshopSession } from '@/types';
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

/** Priority-indicator tiers on Today (ADR-031, ADR-044 principle 4). N/A leaves the count; an unscored indicator is
 *  "not yet scored", never "needs work"; only scored indicators below 3 are listed as needing work. */
export interface PriorityItem { id: string; tier: 1 | 2 | 3; response?: Pick<Response, 'score' | 'is_na'> }
export function priorityTiers<T extends PriorityItem>(items: T[]) {
  const scored = (p: PriorityItem) => !!p.response && !p.response.is_na && p.response.score !== null;
  const rows = ([1, 2, 3] as const).map((tier) => {
    const inTier = items.filter((p) => p.tier === tier && !p.response?.is_na);
    return { tier, total: inTier.length, met: inTier.filter((p) => scored(p) && p.response!.score! >= 3).length,
      unscored: inTier.filter((p) => !scored(p)).length };
  });
  const needsWork = items.filter((p) => scored(p) && p.response!.score! < 3).sort((a, b) => a.tier - b.tier);
  return { rows, needsWork };
}

// ------------------------------------------------------------------ Today page (ADR-044 items 1-3 and 6, 1.27.0)

/** Which Today sections a person sees. Every table behind them is readable by any active user (RLS: is_active_user),
 *  so this is emphasis, not access control: each role sees the panels its work needs, and nothing empty. */
export interface TodaySections { validation: boolean; assessment: boolean; actions: boolean; eocCapability: boolean; evacuation: boolean; manual: boolean; raci: boolean }
export function todaySections(roles: Role[]): TodaySections {
  const any = (...r: Role[]) => roles.some((x) => r.includes(x));
  const assessmentTeam = any('assessor', 'validator', 'lead_office_focal', 'cdrrmo_head', 'admin');
  const eoc = any('duty_officer', 'eoc_staff', 'eoc_manager', 'cdrrmo_head', 'admin');
  return {
    validation: any('cdrrmo_head', 'assessor', 'validator', 'author', 'lead_office_focal', 'admin'),
    assessment: assessmentTeam,
    actions: assessmentTeam || any('author'),
    eocCapability: eoc || any('assessor', 'validator'),
    evacuation: eoc,
    manual: roles.length > 0,
    raci: roles.length > 0,
  };
}

/** How fresh the figures on this device are. Null last sync = never synced here: say so, never imply live data. */
export function freshness(lastSyncAt: string | null, online: boolean, now: number): { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' } {
  if (!lastSyncAt) return { label: online ? 'Not yet synced on this device. Figures will fill in after the first sync.' : 'Offline and not yet synced on this device. Figures may be missing.', tone: 'warn' };
  const mins = Math.max(0, Math.round((now - new Date(lastSyncAt).getTime()) / 60000));
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  if (!online) return { label: `Offline. Figures are from the last sync, ${ago}; they are not live.`, tone: mins > 24 * 60 ? 'bad' : 'warn' };
  return { label: `Figures are from this device, last synced ${ago}.`, tone: mins > 24 * 60 ? 'warn' : mins > 60 ? 'info' : 'ok' };
}

/** The latest change among rows that carry updated_at (or created_at): the "as of" of a figure built from them. */
export function latestStamp(rows: { updated_at?: string | null; created_at?: string | null }[]): string | null {
  let best: string | null = null;
  for (const r of rows) { const t = r.updated_at ?? r.created_at ?? null; if (t && (!best || t > best)) best = t; }
  return best;
}

/** Corrective actions of one IAT cycle (ADR-044 section 5). Dropped actions leave the denominator; an action with no
 *  target date is never "overdue"; "no owner" means neither an office nor a person is named. */
export interface ActionSummary { total: number; open: number; notStarted: number; ongoing: number; done: number; dropped: number; overdue: number; noOwner: number; noDate: number; overdueList: Action[] }
export function actionSummary(actions: Action[], today: string): ActionSummary {
  const live = actions.filter((a) => a.status !== 'dropped');
  const open = live.filter((a) => a.status !== 'done');
  const overdue = open.filter((a) => !!a.target_date && a.target_date < today).sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
  return {
    total: live.length, open: open.length, done: live.filter((a) => a.status === 'done').length, dropped: actions.length - live.length,
    notStarted: live.filter((a) => a.status === 'not_started').length, ongoing: live.filter((a) => a.status === 'ongoing').length,
    overdue: overdue.length, overdueList: overdue,
    noOwner: open.filter((a) => !a.responsible_office_id && !(a.responsible_person ?? '').trim()).length,
    noDate: open.filter((a) => !a.target_date).length,
  };
}
