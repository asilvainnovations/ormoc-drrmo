// Outbox push + incremental pull + realtime (ADR-003).
//
// Push: FIFO. Each write carries the version the user last saw. On success the
// server row replaces the local one and later queued edits of the same row are
// rebased onto the new version. A stale version (PT409) becomes a conflict the
// user can review; a rule refusal (e.g. evidence gate) becomes a failed item with
// the server's explanation and the local row is restored from the server.
//
// Pull: per-table cursor on updated_at/created_at. Rows with unsent local edits
// are never overwritten. Small reference tables are refreshed whole.
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, getMeta, setMeta, type OutboxItem } from './db';
import { REALTIME_TABLES, TABLE, TABLES, type TableConfig } from './tables';
import { env } from './env';
import { supabase as defaultClient } from './supabase';

export type SyncStatus = 'demo' | 'idle' | 'syncing' | 'offline' | 'signed_out' | 'error';
interface SyncState { status: SyncStatus; lastSyncAt: string | null; message: string | null }

let state: SyncState = { status: env.demo ? 'demo' : 'idle', lastSyncAt: null, message: null };
const listeners = new Set<() => void>();
const setState = (patch: Partial<SyncState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const useSyncState = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
export const getSyncState = () => state;

let client: SupabaseClient | null = defaultClient;
/** Tests inject a fake client. */
export function setSyncClient(c: SupabaseClient | null) { client = c; }

type PgError = { code?: string; message: string; details?: string | null; hint?: string | null };
type Row = Record<string, unknown>;

const PAGE = 1000;
const REFERENCE_TTL_MS = 6 * 3600_000;

function isNetworkError(e: PgError | Error | unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (e as { message?: string })?.message ?? '';
  const code = (e as PgError)?.code;
  return /fetch|network|timeout|load failed|ECONN/i.test(msg) && !code?.match(/^[0-9A-Z]{5}$/);
}

const tableOf = (name: string) => (db as unknown as Record<string, import('dexie').Table<Row, unknown>>)[name]!;

async function fetchServerRow(cfg: TableConfig, pk: string): Promise<Row | null> {
  if (!client) return null;
  const { data } = await client.from(cfg.name).select('*').eq(cfg.pk, pk).maybeSingle();
  return (data as Row | null) ?? null;
}

async function dropLaterItemsFor(item: OutboxItem) {
  const later = await db.outbox.where('pk').equals(item.pk!).filter((o) => o.table === item.table && (o.seq ?? 0) > (item.seq ?? 0)).toArray();
  await db.outbox.bulkDelete(later.map((o) => o.seq!));
  return later;
}

async function restoreFromServer(cfg: TableConfig, pk: string) {
  const server = await fetchServerRow(cfg, pk);
  if (server) await tableOf(cfg.name).put(server);
  else await tableOf(cfg.name).delete(cfg.name === 'aa_fund_years' ? Number(pk) : pk);
  return server;
}

async function pushWrite(item: OutboxItem): Promise<'done' | 'stop'> {
  const cfg = TABLE[item.table!]!;
  const row = item.row!;
  let res: { data: unknown; error: PgError | null };
  if (cfg.write === 'update') {
    const { [cfg.pk]: pkVal, ...rest } = row;
    res = await client!.from(cfg.name).update(rest).eq(cfg.pk, pkVal as string).select('*');
  } else if (cfg.write === 'insert') {
    res = await client!.from(cfg.name).upsert(row, { onConflict: cfg.pk, ignoreDuplicates: true }).select('*');
  } else {
    res = await client!.from(cfg.name).upsert(row, { onConflict: cfg.pk }).select('*');
  }
  if (res.error) {
    if (isNetworkError(res.error)) return 'stop';
    if (res.error.code === 'PT409') {
      const later = await dropLaterItemsFor(item);
      const latestLocal = later.length ? later[later.length - 1]!.row! : row;
      const server = await restoreFromServer(cfg, item.pk!);
      await db.conflicts.add({ table: cfg.name, pk: item.pk!, local: latestLocal, server, at: new Date().toISOString(), label: item.label });
    } else {
      await dropLaterItemsFor(item);
      await restoreFromServer(cfg, item.pk!);
      const text = [res.error.message, res.error.hint].filter(Boolean).join(' ');
      await db.failed.add({ label: item.label, error: text, at: new Date().toISOString(), table: cfg.name, pk: item.pk });
    }
    return 'done';
  }
  const rows = (res.data as Row[] | null) ?? [];
  if (rows.length === 0 && cfg.write === 'update') {
    await dropLaterItemsFor(item);
    await restoreFromServer(cfg, item.pk!);
    await db.failed.add({ label: item.label, error: 'Your role cannot change this record.', at: new Date().toISOString(), table: cfg.name, pk: item.pk });
    return 'done';
  }
  const server = rows[0];
  if (server) {
    await tableOf(cfg.name).put(server);
    // Rebase later queued edits of this row onto the version the server now holds.
    const later = await db.outbox.where('pk').equals(item.pk!).filter((o) => o.table === item.table && (o.seq ?? 0) > (item.seq ?? 0)).toArray();
    for (const o of later) {
      if (o.row && typeof server.version === 'number') await db.outbox.update(o.seq!, { row: { ...o.row, version: server.version } });
    }
  }
  return 'done';
}

async function pushRpc(item: OutboxItem): Promise<'done' | 'stop'> {
  const { error } = await client!.rpc(item.fn!, item.args ?? {});
  if (error) {
    if (isNetworkError(error)) return 'stop';
    await db.failed.add({ label: item.label, error: [error.message, error.hint].filter(Boolean).join(' '), at: new Date().toISOString() });
  }
  return 'done';
}

async function pushUpload(item: OutboxItem): Promise<'done' | 'stop'> {
  const f = await db.files.get(item.fileId!);
  if (!f) return 'done';
  const { error } = await client!.storage.from(item.bucket ?? 'evidence').upload(item.path!, f.blob, { contentType: f.type, upsert: false });
  if (error) {
    const msg = error.message ?? '';
    if (/exists|duplicate/i.test(msg)) return 'done';       // replayed upload
    if (isNetworkError(error)) return 'stop';
    await db.failed.add({ label: item.label, error: msg, at: new Date().toISOString() });
  }
  return 'done';
}

export async function push(): Promise<boolean> {
  const items = await db.outbox.orderBy('seq').toArray();
  for (const item of items) {
    if (!(await db.outbox.get(item.seq!))) continue;    // removed while handling an earlier item
    const fresh = (await db.outbox.get(item.seq!))!;
    const outcome = fresh.kind === 'write' ? await pushWrite(fresh) : fresh.kind === 'rpc' ? await pushRpc(fresh) : await pushUpload(fresh);
    if (outcome === 'stop') {
      await db.outbox.update(fresh.seq!, { attempts: fresh.attempts + 1 });
      return false;
    }
    await db.outbox.delete(fresh.seq!);
  }
  return true;
}

async function pendingKeys(table: string): Promise<Set<string>> {
  const items = await db.outbox.where('table').equals(table).toArray();
  return new Set(items.map((i) => i.pk!));
}

async function pullTable(cfg: TableConfig, force = false): Promise<void> {
  const t = tableOf(cfg.name);
  if (cfg.cursor === null) {
    const key = `ref:${cfg.name}`;
    const last = await getMeta<number>(key, 0);
    if (!force && Date.now() - last < REFERENCE_TTL_MS) return;
    const all: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client!.from(cfg.name).select('*').range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...((data as Row[]) ?? []));
      if (!data || data.length < PAGE) break;
    }
    if (all.length > 0) {
      await db.transaction('rw', t, async () => { await t.clear(); await t.bulkPut(all); });
    }
    await setMeta(key, Date.now());
    return;
  }
  const key = `cursor:${cfg.name}`;
  let cursor = await getMeta<string>(key, '1970-01-01T00:00:00Z');
  const pending = await pendingKeys(cfg.name);
  for (;;) {
    const { data, error } = await client!.from(cfg.name).select('*').gte(cfg.cursor, cursor)
      .order(cfg.cursor, { ascending: true }).order(cfg.pk, { ascending: true }).limit(PAGE);
    if (error) throw error;
    const rows = ((data as Row[]) ?? []).filter((r) => !pending.has(String(r[cfg.pk])));
    if (rows.length) await t.bulkPut(rows);
    const all = (data as Row[]) ?? [];
    if (all.length === 0) break;
    const lastTs = String(all[all.length - 1]![cfg.cursor]);
    if (all.length < PAGE || lastTs === cursor) { cursor = lastTs; break; }
    cursor = lastTs;
  }
  await setMeta(key, cursor);
}

export async function pull(only?: string[], force = false): Promise<void> {
  for (const cfg of TABLES) {
    if (only && !only.includes(cfg.name)) continue;
    await pullTable(cfg, force);
  }
}

let running: Promise<void> | null = null;
let rerun = false;

export async function syncNow(opts: { forceReference?: boolean; only?: string[] } = {}): Promise<void> {
  if (env.demo || !client) return;
  if (running) { rerun = true; return running; }
  running = (async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setState({ status: 'offline' }); return; }
      const { data } = await client!.auth.getSession();
      if (!data.session) { setState({ status: 'signed_out' }); return; }
      setState({ status: 'syncing', message: null });
      const pushed = await push();
      if (!pushed) { setState({ status: 'offline' }); return; }
      await pull(opts.only, opts.forceReference);
      const at = new Date().toISOString();
      await setMeta('lastSyncAt', at);
      setState({ status: 'idle', lastSyncAt: at });
    } catch (e) {
      setState(isNetworkError(e) ? { status: 'offline' } : { status: 'error', message: (e as Error).message });
    } finally {
      running = null;
      if (rerun) { rerun = false; void syncNow(); }
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync(delayMs = 1500) {
  if (env.demo) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, delayMs);
}

/** Start background sync: on load, every minute, on reconnect, on focus, and on realtime changes. */
export function startSync(): () => void {
  if (env.demo || !client) return () => {};
  void getMeta<string | null>('lastSyncAt', null).then((at) => setState({ lastSyncAt: at }));
  const onOnline = () => scheduleSync(200);
  const onOffline = () => setState({ status: 'offline' });
  const onVisible = () => { if (document.visibilityState === 'visible') scheduleSync(200); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => scheduleSync(0), 60_000);
  const channel = client.channel('drrm-ops');
  for (const table of REALTIME_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleSync(300));
  }
  channel.subscribe();
  scheduleSync(0);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    void client?.removeChannel(channel);
  };
}
