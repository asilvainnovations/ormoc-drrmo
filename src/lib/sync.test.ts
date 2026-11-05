// Sync engine against an in-memory fake of the Supabase client. The fake enforces
// optimistic concurrency the way app.touch_row() does (PT409 on a stale version).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { configError: null, supabaseUrl: 'http://fake', supabaseAnonKey: 'k', appVersion: 'test' } }));
vi.mock('@/lib/supabase', () => ({ supabase: null, AUTH_STORAGE_KEY: 'sb-fake-auth-token' }));

import { db } from './db';
import { discardFailed, queueUpload, retryHeldUpload, save, setActingUser } from './store';
import { backoffMs, clearDeviceAfterSignOut, getPushProblem, isConnectionProblem, isTransient, push, pull, reasonOf, retryNow, setSyncClient, unsentFor } from './sync';

type Row = Record<string, unknown>;
class FakeServer {
  tables: Record<string, Map<string, Row>> = {};
  clock = 0;
  failNext: { code?: string; message: string; hint?: string; status?: number } | null = null;
  /** Fail every write of this primary key (a row the server keeps choking on). */
  failFor = new Map<string, { code?: string; message: string; status?: number }>();
  /** Apply the write but lose the reply (the device never hears back). */
  loseReply = false;
  offline = false;
  /** Next storage upload answer (null = accept). */
  uploadError: { message: string; statusCode?: string | number } | null = null;
  uploads: string[] = [];
  writes: { table: string; mode: string }[] = [];
  t(name: string) { return (this.tables[name] ??= new Map()); }
  stamp() { this.clock += 1; return new Date(Date.UTC(2026, 9, 15, 0, 0, this.clock)).toISOString(); }
  write(table: string, row: Row, mode: 'upsert' | 'update' | 'insert', pkName = 'id'): { data: Row[] | null; error: unknown; status?: number } {
    this.writes.push({ table, mode });
    if (this.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 };
    if (this.failNext) { const e = this.failNext; this.failNext = null; return { data: null, error: e, status: e.status ?? 400 }; }
    const stuck = this.failFor.get(String(row[pkName])); if (stuck) return { data: null, error: stuck, status: stuck.status ?? 500 };
    if (this.loseReply) { this.loseReply = false; this.apply(table, row, mode, pkName); return { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 }; }
    return this.apply(table, row, mode, pkName);
  }
  apply(table: string, row: Row, mode: 'upsert' | 'update' | 'insert', pkName = 'id') {
    const t = this.t(table); const pk = String(row[pkName]); const cur = t.get(pk);
    if (mode === 'insert' && cur) return { data: [], error: null };
    if (mode === 'update' && !cur) return { data: [], error: null };
    if (cur && mode !== 'insert') {
      if (row.version !== undefined && row.version !== cur.version) return { data: null, error: { code: 'PT409', message: 'Version conflict' } };
      const next = { ...cur, ...row, version: (cur.version as number) + 1, updated_at: this.stamp() };
      t.set(pk, next); return { data: [next], error: null };
    }
    const next = { ...row, version: 1, updated_at: this.stamp(), created_at: row.created_at ?? this.stamp() };
    t.set(pk, next); return { data: [next], error: null };
  }
}

function fakeClient(s: FakeServer) {
  const from = (table: string) => {
    const q: { filters: [string, string, unknown][]; orders: string[]; lim?: number; or?: { c: string; ts: string; pk: string; v: string } } = { filters: [], orders: [] };
    const rows = () => [...s.t(table).values()].filter((r) => q.filters.every(([op, k, v]) => op === 'eq' ? String(r[k]) === String(v) : String(r[k]) >= String(v)))
      .filter((r) => !q.or || String(r[q.or.c]) > q.or.ts || (String(r[q.or.c]) === q.or.ts && String(r[q.or.pk]) > q.or.v))
      .sort((a, b) => { for (const o of q.orders) { const c = String(a[o]).localeCompare(String(b[o])); if (c) return c; } return 0; }).slice(0, q.lim ?? 10_000);
    const sel: Record<string, unknown> = {
      eq: (k: string, v: unknown) => { q.filters.push(['eq', k, v]); return sel; },
      gte: (k: string, v: unknown) => { q.filters.push(['gte', k, v]); return sel; },
      // keyset page: c.gt."ts",and(c.eq."ts",pk.gt."v")
      or: (expr: string) => { const m = /^(\w+)\.gt\."([^"]+)",and\(\w+\.eq\."[^"]+",(\w+)\.gt\."([^"]+)"\)$/.exec(expr)!; q.or = { c: m[1]!, ts: m[2]!, pk: m[3]!, v: m[4]! }; return sel; },
      order: (k: string) => { q.orders.push(k); return sel; },
      limit: (n: number) => { q.lim = n; return Promise.resolve({ data: rows(), error: null }); },
      range: () => Promise.resolve({ data: rows(), error: null }),
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    };
    return {
      select: () => sel,
      upsert: (row: Row, opts: { ignoreDuplicates?: boolean }) => ({ select: () => Promise.resolve(s.write(table, row, opts.ignoreDuplicates ? 'insert' : 'upsert')) }),
      update: (rest: Row) => ({ eq: (k: string, v: unknown) => ({ select: () => Promise.resolve(s.write(table, { ...rest, [k]: v }, 'update', k)) }) }),
    };
  };
  return {
    from,
    rpc: vi.fn(async () => (s.offline ? { error: { message: 'Failed to fetch' } } : { error: null })),
    storage: { from: () => ({ upload: vi.fn(async (path: string) => {
      if (s.uploadError) { const error = s.uploadError; s.uploadError = null; return { error }; }
      s.uploads.push(path); return { error: null };
    }) }) },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const cycleBase = { id: 'c1', name: 'Baseline', cycle_year: 2026, iat_version: '1.1', status: 'draft', period_from: null, period_to: null, notes: null, version: 1 };

const cycle = cycleBase;
let server: FakeServer;
beforeEach(async () => {
  await db.delete(); await db.open();
  server = new FakeServer();
  setSyncClient(fakeClient(server));
  setActingUser('u');
});

describe('push', () => {
  it('sends a new row and stores the server copy', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    expect(await db.outbox.count()).toBe(1);
    expect(await push()).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(server.t('assessment_cycles').get('c1')?.version).toBe(1);
    expect((await db.assessment_cycles.get('c1'))?.updated_at).toBeDefined();
  });

  it('rebases a second offline edit onto the version the first edit created', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    await save('assessment_cycles', { ...local, name: 'Edit 1' }, 'edit 1');
    await save('assessment_cycles', { ...local, name: 'Edit 2' }, 'edit 2');   // same base version, made offline
    expect(await push()).toBe(true);
    expect(server.t('assessment_cycles').get('c1')).toMatchObject({ name: 'Edit 2', version: 3 });
    expect(await db.conflicts.count()).toBe(0);
  });

  it('turns a stale version into a reviewable conflict and keeps the server copy', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    server.write('assessment_cycles', { id: 'c1', name: 'Someone else', version: 1 }, 'upsert');   // another user saves first
    await save('assessment_cycles', { ...local, name: 'Mine' }, 'my edit');
    await push();
    const conflicts = await db.conflicts.toArray();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.local).toMatchObject({ name: 'Mine' });
    expect((await db.assessment_cycles.get('c1'))?.name).toBe('Someone else');
  });

  it('records a rule refusal with the server explanation and restores the row', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    await save('assessment_cycles', { ...local, status: 'final' }, 'finalize');
    server.failNext = { code: '42501', message: 'Only a validator can finalize', hint: 'Ask the CDRRMO Head.' };
    await push();
    const failed = await db.failed.toArray();
    expect(failed[0]?.error).toBe('Only a validator can finalize Ask the CDRRMO Head.');
    expect((await db.assessment_cycles.get('c1'))?.status).toBe('draft');
  });

  it('stops on a network failure and keeps the queue in order', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await save('assessment_cycles', { ...cycle, id: 'c2', name: 'Second', _new: true }, 'create 2');
    server.offline = true;
    expect(await push()).toBe(false);
    expect(await db.outbox.count()).toBe(2);
    server.offline = false;
    expect(await push()).toBe(true);
    expect(server.t('assessment_cycles').size).toBe(2);
  });

  it('never resends server-stamped columns', async () => {
    await save('responses', { id: 'r1', cycle_id: 'c1', indicator_id: 'A1.1', score: null, is_na: false, status: 'draft', assessed_by: 'spoofed', validated_by: 'spoofed', version: 1, _new: true }, 'r');
    const item = (await db.outbox.toArray())[0]!;
    expect(item.row).not.toHaveProperty('assessed_by');
    expect(item.row).not.toHaveProperty('validated_by');
    expect(item.row).not.toHaveProperty('updated_at');
  });
});

describe('append-only tables', () => {
  it('never send a version column (logbook and barangay reports have none)', async () => {
    await save('logbook_entries', { _new: true, id: 'l1', activation_id: null, occurred_at: '2026-10-15T00:00:00Z', category: 'general', entry: 'Net check', corrects_id: null, author: 'u' }, 'log');
    const row = (await db.outbox.toArray())[0]!.row!;
    expect(row).not.toHaveProperty('version');
    expect(row).not.toHaveProperty('author');
  });
});

describe('update-only tables', () => {
  it('send only the fields a person can change, never the locked snapshot', async () => {
    await db.protocol_run_steps.put({ id: 's1', run_id: 'r', step_id: 't', seq: 1, instruction: 'Log the bulletin', is_critical: true, requires_note: true,
      due_at: '2026-10-15T00:10:00Z', status: 'pending', done_by: null, done_at: null, note: null, version: 1 });
    const step = (await db.protocol_run_steps.get('s1'))!;
    await save('protocol_run_steps', { ...step, status: 'done', note: 'TCB #2 logged' }, 'step');
    const row = (await db.outbox.toArray())[0]!.row!;
    expect(Object.keys(row).sort()).toEqual(['id', 'note', 'status', 'version']);
  });
});

describe('pull', () => {
  it('fetches newer rows but never overwrites unsent local edits', async () => {
    server.write('assessment_cycles', { ...cycle, name: 'Server A' }, 'upsert');
    server.write('assessment_cycles', { ...cycle, id: 'c2', name: 'Server B' }, 'upsert');
    await pull(['assessment_cycles']);
    expect(await db.assessment_cycles.count()).toBe(2);
    const b = (await db.assessment_cycles.get('c2'))!;
    await save('assessment_cycles', { ...b, name: 'Local B' }, 'local');          // unsent
    server.write('assessment_cycles', { id: 'c2', name: 'Server B2', version: 1 }, 'upsert');
    await pull(['assessment_cycles']);
    expect((await db.assessment_cycles.get('c2'))?.name).toBe('Local B');
  });
});

describe('v1.2 hardening', () => {
  it('sends edits as updates, so the third and later edits of a row still succeed', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    for (const name of ['Edit 1', 'Edit 2', 'Edit 3']) {
      const local = (await db.assessment_cycles.get('c1'))!;
      await save('assessment_cycles', { ...local, name }, name);
      expect(await push()).toBe(true);
    }
    expect(server.t('assessment_cycles').get('c1')).toMatchObject({ name: 'Edit 3', version: 4 });
    expect(server.writes.map((w) => w.mode)).toEqual(['insert', 'update', 'update', 'update']);
    expect(await db.conflicts.count()).toBe(0);
  });

  it('keeps the change queued on a server or gateway error, and never deletes the local row', async () => {
    await save('logbook_entries', { _new: true, id: 'l1', activation_id: null, occurred_at: '2026-10-15T00:00:00Z', category: 'general', entry: 'Typhoon net check', corrects_id: null, author: 'u' }, 'log');
    for (const failure of [{ message: '<html>502 Bad Gateway</html>', status: 502 }, { code: '57014', message: 'canceling statement due to statement timeout', status: 500 },
      { code: 'PGRST301', message: 'JWT expired', status: 401 }, { message: 'Too Many Requests', status: 429 }]) {
      server.failNext = failure;
      await retryNow();                                  // skip the backoff (1.7) so each failure is tried
      expect(await push()).toBe(false);
      expect(await db.outbox.count()).toBe(1);
      expect(await db.logbook_entries.get('l1')).toBeDefined();
    }
    await retryNow();
    expect(await push()).toBe(true);
    expect(server.t('logbook_entries').get('l1')).toBeDefined();
    expect(await db.failed.count()).toBe(0);
  });

  it('classifies temporary and permanent errors', () => {
    expect(isTransient({ code: '42501', message: 'new row violates row-level security' }, 403)).toBe(false);
    expect(isTransient({ code: '23514', message: 'Score above evidence' }, 400)).toBe(false);
    expect(isTransient({ code: '40P01', message: 'deadlock detected' }, 500)).toBe(true);
    expect(isTransient({ message: 'Failed to fetch' })).toBe(true);
  });

  it('keeps what the person entered when the server refuses it, including later edits', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    await save('assessment_cycles', { ...local, status: 'final' }, 'finalize');
    await save('assessment_cycles', { ...local, status: 'final', notes: 'Second edit with field notes' }, 'notes');
    server.failNext = { code: '42501', message: 'Only a validator can finalise' };
    await push();
    const [f] = await db.failed.toArray();
    expect(f!.rows).toHaveLength(2);
    expect(f!.rows![1]).toMatchObject({ notes: 'Second edit with field notes' });
  });

  it('a lost reply does not turn the person\'s own change into a conflict', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    await save('assessment_cycles', { ...local, name: 'Edit 1' }, 'edit 1');
    server.loseReply = true;
    expect(await push()).toBe(false);                 // applied on the server, reply lost
    expect(await push()).toBe(true);                  // retry sees its own change
    expect(await db.conflicts.count()).toBe(0);
    expect((await db.assessment_cycles.get('c1'))?.name).toBe('Edit 1');
  });

  it('records the base row so "apply my change on top" keeps the other person\'s fields', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    await push();
    const local = (await db.assessment_cycles.get('c1'))!;
    server.write('assessment_cycles', { id: 'c1', notes: 'Their note', version: 1 }, 'update');
    await save('assessment_cycles', { ...local, name: 'My name' }, 'rename');
    await push();
    const [c] = await db.conflicts.toArray();
    expect(c!.base).toMatchObject({ name: 'Baseline' });
    expect(c!.server).toMatchObject({ notes: 'Their note' });
  });

  it('never sends changes made on this device by another account', async () => {
    setActingUser('someone-else');
    await save('assessment_cycles', { ...cycle, _new: true }, 'theirs');
    setActingUser('u');
    await save('assessment_cycles', { ...cycle, id: 'c2', _new: true }, 'mine');
    expect(await push('u')).toBe(true);
    expect([...server.t('assessment_cycles').keys()]).toEqual(['c2']);
    expect(await db.outbox.count()).toBe(1);
  });

  it('pages past more than a thousand rows that share one timestamp', async () => {
    const t = server.t('responses');
    for (let i = 0; i < 1005; i++) t.set(`r${String(i).padStart(4, '0')}`, { id: `r${String(i).padStart(4, '0')}`, cycle_id: 'c', indicator_id: 'A1.1', updated_at: '2026-10-15T01:00:00.000Z', version: 1 });
    t.set('zz', { id: 'zz', cycle_id: 'c', indicator_id: 'A1.2', updated_at: '2026-10-15T02:00:00.000Z', version: 1 });
    await pull(['responses']);
    expect(await db.responses.count()).toBe(1006);
  });
});

describe('evidence uploads (1.5.1)', () => {
  const photo = () => new File([new Uint8Array([1, 2, 3])], 'field-photo.jpg', { type: 'image/jpeg' });

  it('deletes the device copy only after the server has the file', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    expect(await push('u')).toBe(true);
    expect(server.uploads).toEqual(['c1/e1/field-photo.jpg']);
    expect(await db.files.get('e1')).toBeUndefined();
  });

  it('keeps the file on the device when storage refuses the upload', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    server.uploadError = { message: 'new row violates row-level security policy', statusCode: '403' };
    expect(await push('u')).toBe(true);
    expect(await db.outbox.count()).toBe(0);                        // a refusal does not block the queue
    expect(await db.files.get('e1')).toBeDefined();                 // the only copy is still here
    const [held] = await db.failed.toArray();
    expect(held).toMatchObject({ fileId: 'e1', path: 'c1/e1/field-photo.jpg', bucket: 'evidence', fileName: 'field-photo.jpg', userId: 'u' });
    expect(held!.error).toMatch(/kept on this device/);
  });

  it('keeps the upload queued on a temporary storage error', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    server.uploadError = { message: 'Bad gateway', statusCode: 502 };
    expect(await push('u')).toBe(false);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.failed.count()).toBe(0);
    expect(await db.files.get('e1')).toBeDefined();
  });

  it('a retry sends the held file under the same path and account, then clears it', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    server.uploadError = { message: 'Parent evidence row not found', statusCode: 400 };
    await push('u');
    const [held] = await db.failed.toArray();
    await retryHeldUpload(held!.id!);
    expect(await db.failed.count()).toBe(0);
    expect((await db.outbox.toArray())[0]).toMatchObject({ kind: 'upload', fileId: 'e1', path: 'c1/e1/field-photo.jpg', userId: 'u' });
    expect(await push('u')).toBe(true);
    expect(server.uploads).toEqual(['c1/e1/field-photo.jpg']);
    expect(await db.files.get('e1')).toBeUndefined();
  });

  it('discarding a held upload deletes the file, and only then', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    server.uploadError = { message: 'Forbidden', statusCode: 403 };
    await push('u');
    const [held] = await db.failed.toArray();
    expect(await db.files.get('e1')).toBeDefined();
    await discardFailed(held!.id!);
    expect(await db.failed.count()).toBe(0);
    expect(await db.files.get('e1')).toBeUndefined();
  });

  it('counts a held upload as unsent, so sign-out still warns', async () => {
    await queueUpload(photo(), 'c1/e1/field-photo.jpg', 'e1');
    server.uploadError = { message: 'Forbidden', statusCode: 403 };
    await push('u');
    expect((await db.outbox.count()) + (await db.failed.count())).toBe(1);
  });
});

describe('one stuck item (1.7, audit #8)', () => {
  const log = (id: string, entry: string) => ({ _new: true, id, activation_id: null, occurred_at: '2026-11-05T00:00:00Z', category: 'general', entry, corrects_id: null, author: 'u' });

  it('backs off with the server\'s reason and lets independent items through', async () => {
    await save('logbook_entries', log('l1', 'stuck'), 'log 1');
    await save('logbook_entries', log('l2', 'fine'), 'log 2');
    server.failFor.set('l1', { message: '<html><body>502 Bad Gateway</body></html>', status: 502 });
    expect(await push('u')).toBe(false);
    expect(server.t('logbook_entries').has('l2')).toBe(true);           // not blocked
    const [stuck] = await db.outbox.toArray();
    expect(stuck!.pk).toBe('l1');
    expect(stuck!.lastError).toBe('502 Bad Gateway');                   // readable, not HTML
    expect(Date.parse(stuck!.nextAttemptAt!)).toBeGreaterThan(Date.now());
    expect(getPushProblem()).toEqual({ stop: 'server', reason: '502 Bad Gateway' });
    expect(await db.failed.count()).toBe(0);                            // still queued, never dropped
  });

  it('waits during the backoff, then sends on retry', async () => {
    await save('logbook_entries', log('l1', 'stuck'), 'log 1');
    server.failFor.set('l1', { code: '57014', message: 'canceling statement due to statement timeout', status: 500 });
    await push('u');
    const writes = server.writes.length;
    await push('u');
    expect(server.writes.length).toBe(writes);                          // not hammered during the backoff
    server.failFor.clear();
    await retryNow('u');
    expect(await push('u')).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });

  it('holds back items that depend on the stuck one, in order', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create cycle');
    await save('responses', { _new: true, id: 'r1', cycle_id: 'c1', indicator_id: 'A1.1', score: null, version: 1 }, 'response in that cycle');
    await save('logbook_entries', log('l9', 'independent'), 'log');
    server.failFor.set('c1', { message: 'Bad Gateway', status: 502 });
    expect(await push('u')).toBe(false);
    expect(server.t('responses').has('r1')).toBe(false);                // waits for its cycle
    expect(server.t('logbook_entries').has('l9')).toBe(true);
    expect((await db.outbox.toArray()).map((o) => o.pk)).toEqual(['c1', 'r1']);
  });

  it('stops the round when the server itself is in trouble (two problems in a row)', async () => {
    await save('logbook_entries', log('a', '1'), 'a');
    await save('logbook_entries', log('b', '2'), 'b');
    await save('logbook_entries', log('c', '3'), 'c');
    for (const k of ['a', 'b', 'c']) server.failFor.set(k, { message: 'Service Unavailable', status: 503 });
    await push('u');
    expect(server.writes.filter((w) => w.table === 'logbook_entries').length).toBe(2);
  });

  it('stops at once when there is no connection, without a backoff', async () => {
    await save('logbook_entries', log('l1', 'x'), 'log');
    server.offline = true;
    expect(await push('u')).toBe(false);
    expect(getPushProblem()?.stop).toBe('connection');
    expect((await db.outbox.toArray())[0]!.nextAttemptAt).toBeUndefined();
  });

  it('backs off 15 s, doubling, to at most 30 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([15_000, 30_000, 60_000, 120_000]);
    expect(backoffMs(20)).toBe(30 * 60_000);
  });

  it('tells connection problems from server problems', () => {
    expect(isConnectionProblem({ message: 'Failed to fetch' })).toBe(true);
    expect(isConnectionProblem({ code: 'PGRST301', message: 'JWT expired' }, 401)).toBe(true);
    expect(isConnectionProblem({ message: 'Too Many Requests' }, 429)).toBe(true);
    expect(isConnectionProblem({ message: 'Bad Gateway' }, 502)).toBe(false);
    expect(isConnectionProblem({ code: '57014', message: 'statement timeout' }, 500)).toBe(false);
    expect(reasonOf({ message: '<html><h1>504 Gateway Time-out</h1></html>' }, 504)).toBe('504 Gateway Time-out');
  });
});

describe('shared devices (1.7, audit #7)', () => {
  const photo = () => new File([new Uint8Array([1, 2, 3])], 'field-photo.jpg', { type: 'image/jpeg' });
  it('signing out keeps another account\'s unsent changes, files and conflicts', async () => {
    // A queues a logbook entry and a photo offline, and has a conflict; then B signs in and out.
    setActingUser('A');
    await save('logbook_entries', { _new: true, id: 'la', activation_id: null, occurred_at: '2026-11-05T00:00:00Z', category: 'general', entry: 'A, offline', corrects_id: null, author: 'A' }, 'A log');
    await queueUpload(photo(), 'c1/e9/a.jpg', 'fa');
    await db.conflicts.add({ table: 'assessment_cycles', pk: 'cA', local: {}, server: null, at: 'x', label: 'A conflict', userId: 'A' });
    setActingUser('B');
    await save('logbook_entries', { _new: true, id: 'lb', activation_id: null, occurred_at: '2026-11-05T00:00:00Z', category: 'general', entry: 'B', corrects_id: null, author: 'B' }, 'B log');
    expect(await unsentFor('B')).toBe(1);                                // B is warned about B's only
    expect(await clearDeviceAfterSignOut('B')).toBe('kept_for_others');
    expect((await db.outbox.toArray()).map((o) => o.label).sort()).toEqual(['A log', 'Upload field-photo.jpg']);
    expect(await db.files.get('fa')).toBeDefined();                     // A's photo survives
    expect(await db.logbook_entries.get('la')).toBeDefined();           // the row A's change needs
    expect(await db.logbook_entries.get('lb')).toBeUndefined();         // B's data is gone
    expect(await db.conflicts.count()).toBe(1);
    expect(await unsentFor('A')).toBe(3);
  });

  it('with nothing held for others, signing out deletes the whole device database', async () => {
    await save('logbook_entries', { _new: true, id: 'l1', activation_id: null, occurred_at: '2026-11-05T00:00:00Z', category: 'general', entry: 'x', corrects_id: null, author: 'u' }, 'log');
    expect(await clearDeviceAfterSignOut('u')).toBe('deleted');
    await db.open();
    expect(await db.outbox.count()).toBe(0);
  });

  it('tags refusals and conflicts with the account that made the change', async () => {
    await save('assessment_cycles', { ...cycle, _new: true }, 'create');
    server.failNext = { code: '42501', message: 'Only the CDRRMO Head', status: 403 };
    await push('u');
    expect((await db.failed.toArray())[0]!.userId).toBe('u');
  });
});
