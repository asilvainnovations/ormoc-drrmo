// EOC rules. Mirrors supabase/migrations/20261015000400_eoc.sql.
import type { Activation, BarangayCondition, BarangayReport, EocLevel, RequestStatus, Role } from '@/types';

// Alert levels: National Disaster Response Plan, as restated in the RDRRMC VIII SOP (Res. No. 12-006, s. 2023).
// NDRRMC Memorandum No. 131, s. 2018 governs EOC activation and functions; it lets each EOC set its own
// alert-level codes (para. 9.2.2) and does not itself define White, Blue and Red.
export const LEVEL_BASIS = 'National Disaster Response Plan; RDRRMC VIII Res. No. 12-006, s. 2023';
export const LEVEL_INFO: Record<EocLevel, { name: string; meaning: string }> = {
  white: { name: 'White', meaning: 'Normal operations' },
  blue: { name: 'Blue', meaning: 'Partial activation: at least half of resources on standby' },
  red: { name: 'Red', meaning: 'Full activation: all resources available' },
};

export const REQUEST_NEXT: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['mobilized', 'rejected'],
  mobilized: ['delivered'],
  delivered: ['demobilized'],
  demobilized: [],
  rejected: [],
};
export const REQUEST_VERB: Record<RequestStatus, string> = {
  requested: 'Request', approved: 'Approve', mobilized: 'Mark mobilized', delivered: 'Mark delivered',
  demobilized: 'Demobilize', rejected: 'Reject',
};

export const canChangeLevel = (roles: Role[]) => roles.some((r) => r === 'eoc_manager' || r === 'cdrrmo_head' || r === 'admin');
export const canDecideRequest = canChangeLevel;
export const canOperate = (roles: Role[]) =>
  roles.some((r) => ['duty_officer', 'eoc_staff', 'eoc_manager', 'cdrrmo_head', 'admin'].includes(r));

export function currentLevel(activations: Activation[]): { level: EocLevel; activation: Activation | null } {
  const open = activations.find((a) => !a.ended_at) ?? null;
  return { level: open?.level ?? 'white', activation: open };
}

export function levelChangeProblem(current: EocLevel, next: EocLevel, reason: string): string | null {
  if (current === next) return `The EOC is already at ${LEVEL_INFO[next].name} level.`;
  if (!reason.trim()) return 'Give the reason for the level change.';
  return null;
}

// --------------------------------------------------------------- events and barangay figures
//
// An "event" is a run of back-to-back activations. set_eoc_level() closes the open activation
// and opens the next one in the same transaction, so Blue -> Red is two rows with the second
// starting when the first ends. Figures for the EOC board, the barangay list and the SitRep
// count only reports from the current event, never a past typhoon (audit 31 Oct 2026, #16).

/** Activations further apart than this are separate events. */
export const EVENT_GAP_MS = 60_000;
/** At White level (no event) the board and barangay list show the last day of monitoring reports. */
export const MONITORING_WINDOW_HOURS = 24;

const t = (iso: string) => Date.parse(iso);

export interface EocEvent { start: string; end: string | null; activationIds: string[] }

/** All events, oldest first. */
export function eventsOf(activations: Activation[]): EocEvent[] {
  const sorted = [...activations].sort((a, b) => t(a.started_at) - t(b.started_at));
  const events: EocEvent[] = [];
  for (const a of sorted) {
    const last = events[events.length - 1];
    if (last && last.end !== null && t(a.started_at) - t(last.end) <= EVENT_GAP_MS) {
      last.activationIds.push(a.id);
      last.end = a.ended_at;
    } else {
      events.push({ start: a.started_at, end: a.ended_at, activationIds: [a.id] });
    }
  }
  return events;
}

/** The event an activation belongs to. */
export function eventOf(activations: Activation[], activationId: string | null | undefined): EocEvent | null {
  if (!activationId) return null;
  return eventsOf(activations).find((e) => e.activationIds.includes(activationId)) ?? null;
}

export interface ReportWindow { from: string; to: string | null; kind: 'event' | 'monitoring' }

/** Which reports count right now: the current event, or the last 24 hours at White level. */
export function currentReportWindow(activations: Activation[], now = new Date()): ReportWindow {
  const { activation } = currentLevel(activations);
  const ev = eventOf(activations, activation?.id);
  if (ev) return { from: ev.start, to: null, kind: 'event' };
  return { from: new Date(now.getTime() - MONITORING_WINDOW_HOURS * 3_600_000).toISOString(), to: null, kind: 'monitoring' };
}

/** Which reports a SitRep draws on: its event up to the end of its period, or just its period. */
export function sitrepReportWindow(activations: Activation[], s: { activation_id: string | null; period_start: string; period_end: string }): ReportWindow {
  const ev = eventOf(activations, s.activation_id);
  return ev ? { from: ev.start, to: s.period_end, kind: 'event' } : { from: s.period_start, to: s.period_end, kind: 'monitoring' };
}

/** The latest report from each barangay inside the window. */
export function latestPerBarangay(reports: BarangayReport[], w: ReportWindow): BarangayReport[] {
  const from = t(w.from); const to = w.to === null ? Infinity : t(w.to);
  const latest = new Map<string, BarangayReport>();
  for (const r of reports) {
    const at = t(r.reported_at);
    if (at < from || at > to) continue;
    const cur = latest.get(r.barangay_psgc);
    if (!cur || at > t(cur.reported_at)) latest.set(r.barangay_psgc, r);
  }
  return Array.from(latest.values());
}

/** Evacuation totals from the latest reports. A blank count is "not reported", not zero. */
export function evacuationTotals(latest: BarangayReport[]): { families: number; persons: number; notReported: number } {
  let families = 0; let persons = 0; let notReported = 0;
  for (const r of latest) {
    if (r.families_evacuated === null || r.persons_evacuated === null) {
      if (r.condition !== 'normal') notReported += 1;
    }
    families += r.families_evacuated ?? 0;
    persons += r.persons_evacuated ?? 0;
  }
  return { families, persons, notReported };
}

// --------------------------------------------------------------- barangay report form
// Mirrors the checks in supabase/migrations/20261105001300_barangay_report_counts.sql.

/** A typed count: blank is null ("not reported"); anything else must be a whole number, 0 or more. */
export function parseCount(s: string): number | null | 'invalid' {
  const v = s.trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v)) return 'invalid';
  return Number(v);
}

export function barangayReportProblem(f: { condition: BarangayCondition; families: string; persons: string }): string | null {
  const fam = parseCount(f.families); const per = parseCount(f.persons);
  if (fam === 'invalid' || per === 'invalid') return 'Enter counts as whole numbers, 0 or more, or leave them blank if not reported.';
  if (f.condition === 'evacuating' && (fam === null || per === null)) return 'An evacuating barangay needs both counts. Enter 0 if no one has arrived yet.';
  if (fam !== null && per !== null && per < fam) return 'Persons evacuated cannot be fewer than families evacuated.';
  return null;
}
