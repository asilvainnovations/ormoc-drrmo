import { useCallback, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useActiveDeclaration, useEocStatus, usePending } from '@/lib/hooks';
import { actionSummary, todaySections } from '@/domain/dashboard';
import { buildNotices, EMPTY_PREFS, isUnread, markRead, visibleNotices, type Notice, type NoticePrefs } from '@/domain/notifications';

/** Read marks and on/off choices live on this device only (ADR-046). Storage can be missing or full; the app
 *  then keeps the choices in memory for the session. */
const KEY = 'mode.notifications.v1';
let memory: NoticePrefs = load();
const listeners = new Set<() => void>();

function load(): NoticePrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PREFS;
    const p = JSON.parse(raw) as Partial<NoticePrefs>;
    return { muted: p.muted ?? {}, read: p.read ?? {} };
  } catch { return EMPTY_PREFS; }
}
export function setNoticePrefs(next: NoticePrefs) {
  memory = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* memory only */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useNoticePrefs = () => useSyncExternalStore(subscribe, () => memory, () => memory);

export function useNotifications() {
  const { roles, userId } = useAuth();
  const { level, activation } = useEocStatus();
  const decl = useActiveDeclaration();
  const pending = usePending(userId);
  const prefs = useNoticePrefs();
  const seesActions = todaySections(roles).actions;
  const extra = useLiveQuery(async () => {
    const requests = await db.resource_requests.where('status').anyOf('requested', 'approved', 'mobilized').toArray();
    const running = await db.protocol_runs.where('status').equals('running').toArray();
    let overdue: number | null = null;
    if (seesActions) {
      const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray()).find((c) => c.status !== 'archived');
      const actions = cycle ? await db.actions.where('cycle_id').equals(cycle.id).toArray() : [];
      overdue = actionSummary(actions, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })).overdue;
    }
    return { requests, running, overdue };
  }, [seesActions], { requests: [], running: [], overdue: null });

  const all = buildNotices({
    level, activation: activation ? { id: activation.id, started_at: activation.started_at } : null,
    declaration: decl ? { id: decl.id, status: decl.status as 'requested' | 'recommended' | 'declared', updated_at: decl.updated_at } : null,
    pending, requests: extra.requests, running: extra.running, overdueActions: extra.overdue,
  });
  const notices = visibleNotices(all, prefs);
  const unread = notices.filter((n) => isUnread(n, prefs));
  const markAllRead = useCallback(() => setNoticePrefs(markRead(prefs, notices)), [prefs, notices]);
  const markOneRead = useCallback((n: Notice) => setNoticePrefs(markRead(prefs, [n])), [prefs]);
  return { all, notices, unread, prefs, markAllRead, markOneRead };
}
