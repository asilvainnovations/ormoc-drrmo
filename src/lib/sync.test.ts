// Sync engine against an in-memory fake of the Supabase client. The fake enforces
// optimistic concurrency the way app.touch_row() does (PT409 on a stale version).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: { demo: false, supabaseUrl: 'http://fake', supabaseAnonKey: 'k', appVersion: 'test' } }));
vi.mock('@/lib/supabase', () => ({ supabase: null }));

import { db } from './db';
import { save } from './store';
import { push, pull, setSyncClient } from './sync';

type Row = Record<string, unknown>;
class FakeServer {
  tables: Record<string, Map<string, Row>> = {};
  clock = 0;
  failNext: { code: string; message: string; hint?: string } | null = null;
  offline = false;
  t(name: string) { return (this.tables[name] ??= new Map()); }
  stamp() { this.clock += 1; return new Date(Date.UTC(2026, 9, 15, 0, 0, this.clock)).toISOString(); }
  write(table: string, row: Row, mode: 'upsert' | 'update' | 'insert', pkName = 'id') {
    if (this.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
    if (this.failNext) { const e = this.failNext; this.failNext = null; return { data: null, error: e }; }
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
    const q: { filters: [string, string, unknown][]; order?: string; lim?: number } = { filters: [] };
    const rows = () => [...s.t(table).values()].filter((r) => q.filters.every(([op, k, v]) => op === 'eq' ? String(r[k]) === String(v) : String(r[k]) >= String(v)))
      .sort((a, b) => (q.order ? String(a[q.order]).localeCompare(String(b[q.order])) : 0)).slice(0, q.lim ?? 10_000);
    const sel: Record<string, unknown> = {
      eq: (k: string, v: unknown) => { q.filters.push(['eq', k, v]); return sel; },
      gte: (k: string, v: unknown) => { q.filters.push(['gte', k, v]); return sel; },
      order: (k: string) => { q.order ??= k; return sel; },
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
    storage: { from: () => ({ upload: vi.fn(async () => ({ error: null })) }) },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const cycle = { id: 'c1', name: 'Baseline', cycle_year: 2026, iat_version: '1.1', status: 'draft', period_from: null, period_to: null, notes: null, version: 1 };

let server: FakeServer;
beforeEach(async () => {
  await db.delete(); await db.open();
  server = new FakeServer();
  setSyncClient(fakeClient(server));
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
