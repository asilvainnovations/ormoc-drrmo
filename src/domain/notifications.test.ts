import { describe, expect, it } from 'vitest';
import { buildNotices, EMPTY_PREFS, isUnread, markRead, visibleNotices, type NoticeInput } from './notifications';

const quiet: NoticeInput = { level: 'white', activation: null, declaration: null, pending: { failed: 0, conflicts: 0 }, requests: [], running: [], overdueActions: null };

describe('notifications (1.29.0, ADR-046)', () => {
  it('is empty on a quiet day', () => { expect(buildNotices(quiet)).toEqual([]); });
  it('raises the EOC level, declarations, sync, requests, runs and overdue actions', () => {
    const n = buildNotices({ ...quiet, level: 'red', activation: { id: 'a1', started_at: '2026-11-20T00:00:00Z' },
      declaration: { id: 'd1', status: 'declared' }, pending: { failed: 1, conflicts: 2 },
      requests: [{ id: 'r1', priority: 'life_safety', status: 'requested', requested_at: '2026-11-20T01:00:00Z' },
        { id: 'r2', priority: 'routine', status: 'requested', requested_at: '2026-11-20T01:00:00Z' },
        { id: 'r3', priority: 'urgent', status: 'delivered', requested_at: '2026-11-20T01:00:00Z' }],
      running: [{ id: 'p1', started_at: '2026-11-20T02:00:00Z' }], overdueActions: 3 });
    expect(n.map((x) => x.kind)).toEqual(['eoc', 'declaration', 'sync', 'requests', 'protocols', 'actions']);
    expect(n[0]!.tone).toBe('bad');
    expect(n[2]!.title).toBe('3 records need your attention');
    expect(n[3]!.title).toBe('1 open resource request');   // routine and delivered requests are left out
  });
  it('shows a read notice as unread again when its situation changes', () => {
    const a = buildNotices({ ...quiet, level: 'blue', activation: { id: 'a1', started_at: 'x' } });
    const prefs = markRead(EMPTY_PREFS, a);
    expect(isUnread(a[0]!, prefs)).toBe(false);
    const b = buildNotices({ ...quiet, level: 'red', activation: { id: 'a1', started_at: 'x' } });
    expect(isUnread(b[0]!, prefs)).toBe(true);
  });
  it('hides muted kinds', () => {
    const n = buildNotices({ ...quiet, running: [{ id: 'p1', started_at: 'x' }] });
    expect(visibleNotices(n, { ...EMPTY_PREFS, muted: { protocols: true } })).toEqual([]);
  });
});
