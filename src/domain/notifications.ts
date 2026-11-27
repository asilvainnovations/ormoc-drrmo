/** 1.29.0 (ADR-046): in-app notifications, built from records already on the device.
 *
 *  Nothing new is stored on the server: each notice is derived from the EOC level, a declaration in force, the sync
 *  queue, open resource requests, running protocols and overdue improvement actions. A notice has a stable id plus a
 *  signature; when the signature changes (a new level, a higher count) the notice is unread again. Read marks and the
 *  per-kind on/off choices stay on this device only. */
import type { EocLevel } from '@/types';

export type NoticeKind = 'eoc' | 'declaration' | 'coordination' | 'sync' | 'requests' | 'protocols' | 'actions';
export type NoticeTone = 'bad' | 'warn' | 'info';

export interface Notice {
  id: string;
  kind: NoticeKind;
  tone: NoticeTone;
  title: string;
  body: string;
  /** Where the notice leads. */
  to: string;
  /** Changes when the underlying situation changes, so the notice shows as unread again. */
  signature: string;
  at: string | null;
}

export const NOTICE_KINDS: { kind: NoticeKind; label: string; about: string }[] = [
  { kind: 'eoc', label: 'EOC Level', about: 'The EOC is at Blue or Red level.' },
  { kind: 'declaration', label: 'Declarations', about: 'A State of Imminent Disaster is requested, recommended or in force.' },
  { kind: 'coordination', label: 'EOC Coordination', about: 'A check-in call you have not answered, and urgent messages on the current activation.' },
  { kind: 'sync', label: 'Sync Problems', about: 'Records the server refused or that someone else edited first.' },
  { kind: 'requests', label: 'Resource Requests', about: 'Life-safety and urgent requests not yet delivered.' },
  { kind: 'protocols', label: 'Running Protocols', about: 'Protocols and drills still running on any device.' },
  { kind: 'actions', label: 'Overdue Actions', about: 'Improvement actions past their target date (assessment roles).' },
];

export interface NoticeInput {
  level: EocLevel;
  activation: { id: string; started_at: string } | null;
  declaration: { id: string; status: 'requested' | 'recommended' | 'declared'; updated_at?: string | null } | null;
  pending: { failed: number; conflicts: number };
  requests: { id: string; priority: 'life_safety' | 'urgent' | 'routine'; status: string; requested_at: string }[];
  running: { id: string; started_at: string }[];
  /** Overdue improvement actions, or null when this user does not see actions. */
  overdueActions: number | null;
  /** 1.32.0: the current activation's coordination thread, as this user sees it. Optional so older callers keep working. */
  coordination?: { checkinDue: boolean; callAt: string | null; urgent: { id: string; created_at: string }[] } | null;
}

const OPEN_REQUEST = new Set(['requested', 'approved', 'mobilized']);

export function buildNotices(i: NoticeInput): Notice[] {
  const out: Notice[] = [];
  if (i.level !== 'white') {
    out.push({ id: 'eoc-level', kind: 'eoc', tone: i.level === 'red' ? 'bad' : 'warn',
      title: `EOC at ${i.level === 'red' ? 'Red' : 'Blue'} level`,
      body: i.level === 'red' ? 'Full activation: all resources available.' : 'Partial activation: at least half of resources on standby.',
      to: '/eoc', signature: `${i.level}:${i.activation?.id ?? ''}`, at: i.activation?.started_at ?? null });
  }
  if (i.declaration) {
    const d = i.declaration;
    out.push({ id: 'declaration', kind: 'declaration', tone: d.status === 'declared' ? 'bad' : 'warn',
      title: d.status === 'declared' ? 'State of Imminent Disaster in force'
        : d.status === 'requested' ? 'Declaration requested from RDRRMC VIII' : 'RDRRMC recommends a declaration',
      body: 'Open the anticipatory action board for the clock and the actions due.',
      to: '/eoc', signature: `${d.id}:${d.status}`, at: d.updated_at ?? null });
  }
  const co = i.coordination;
  if (co?.checkinDue && co.callAt) {
    out.push({ id: 'coordination', kind: 'coordination', tone: 'bad', title: 'The EOC called a check-in',
      body: 'Open Coordination and tap where you are.', to: '/eoc/coordination', signature: `call:${co.callAt}`, at: co.callAt });
  } else if (co && co.urgent.length > 0) {
    const last = [...co.urgent].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)!;
    out.push({ id: 'coordination', kind: 'coordination', tone: 'warn',
      title: `${co.urgent.length} urgent coordination message${co.urgent.length === 1 ? '' : 's'}`,
      body: 'On the current activation.', to: '/eoc/coordination', signature: `urgent:${last.id}`, at: last.created_at });
  }
  const stuck = i.pending.failed + i.pending.conflicts;
  if (stuck > 0) {
    out.push({ id: 'sync', kind: 'sync', tone: 'warn', title: `${stuck} record${stuck === 1 ? '' : 's'} need${stuck === 1 ? 's' : ''} your attention`,
      body: [i.pending.failed && `${i.pending.failed} refused by the server`, i.pending.conflicts && `${i.pending.conflicts} edited by someone else first`].filter(Boolean).join('; ') + '.',
      to: '/settings/sync', signature: `${i.pending.failed}:${i.pending.conflicts}`, at: null });
  }
  const open = i.requests.filter((r) => OPEN_REQUEST.has(r.status) && r.priority !== 'routine');
  if (open.length > 0) {
    const life = open.filter((r) => r.priority === 'life_safety').length;
    const latest = open.map((r) => r.requested_at).sort().at(-1) ?? null;
    out.push({ id: 'requests', kind: 'requests', tone: life ? 'bad' : 'warn',
      title: `${open.length} open resource request${open.length === 1 ? '' : 's'}`,
      body: life ? `${life} life-safety, ${open.length - life} urgent; not yet delivered.` : `${open.length} urgent; not yet delivered.`,
      to: '/eoc', signature: open.map((r) => r.id).sort().join(','), at: latest });
  }
  if (i.running.length > 0) {
    const latest = i.running.map((r) => r.started_at).sort().at(-1) ?? null;
    out.push({ id: 'protocols', kind: 'protocols', tone: 'info',
      title: `${i.running.length} protocol${i.running.length === 1 ? '' : 's'} running`,
      body: 'Open DRRM to continue a run or close its steps.',
      to: '/drrm/protocols', signature: i.running.map((r) => r.id).sort().join(','), at: latest });
  }
  if (i.overdueActions && i.overdueActions > 0) {
    out.push({ id: 'actions', kind: 'actions', tone: 'warn',
      title: `${i.overdueActions} improvement action${i.overdueActions === 1 ? '' : 's'} overdue`,
      body: 'Past the target date in the action plan.', to: '/assess', signature: String(i.overdueActions), at: null });
  }
  return out;
}

export interface NoticePrefs { muted: Partial<Record<NoticeKind, boolean>>; read: Record<string, string> }
export const EMPTY_PREFS: NoticePrefs = { muted: {}, read: {} };

export const isUnread = (n: Notice, p: NoticePrefs) => p.read[n.id] !== n.signature;
export const visibleNotices = (all: Notice[], p: NoticePrefs) => all.filter((n) => !p.muted[n.kind]);
export function markRead(p: NoticePrefs, list: Notice[]): NoticePrefs {
  const read = { ...p.read };
  for (const n of list) read[n.id] = n.signature;
  return { ...p, read };
}
