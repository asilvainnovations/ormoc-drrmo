// Outbox push + incremental pull + realtime (ADR-003).
//
// Push: FIFO, and only the changes the signed-in account made. A new row is sent
// as an insert, an edit as an update that carries the version the person last saw.
// On success the server row replaces the local one and later queued edits of the
// same row are rebased onto the new version. A stale version (PT409) becomes a
// conflict the person can review; a rule refusal becomes a failed item with the
// server's explanation AND what the person entered, and the local row is restored
// from the server. A temporary problem (no connection, server busy, rate limit,
// expired token) stops the queue and is retried; nothing is dropped for it.
//
// Since 1.7 a server problem with one item (an error page, a timeout) no longer holds
// up the whole queue. That item backs off (15 s, doubling, at most 30 min) with the
// server's reason, and so does anything that depends on it (the same row, rows that
// refer to it, files under it). Independent items still go. Two server problems in one
// round mean the server itself is in trouble, and the round stops. No connection, an
// expired token or a rate limit stop the round at once, as before.
//
// Pull: per-table cursor on updated_at/created_at, paged by (timestamp, key) and
// started a little before the cursor so rows from transactions that committed late
// are not skipped. Rows with unsent local edits are never overwritten. Small
// reference tables are refreshed whole.
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, getMeta, setMeta, type OutboxItem } from './db';
import { REALTIME_TABLES, TABLE, TABLES, type TableConfig } from './tables';
import { supabase as defaultClient } from './supabase';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'retrying' | 'signed_out' | 'error';
interface SyncState { status: SyncStatus; lastSyncAt: string | null; message: string | null }

let state: SyncState = { status: 'idle', lastSyncAt: null, message: null };
const listeners = new Set<() => void>();
const setState = (patch: Partial<SyncState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const useSyncState = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
export const getSyncState = () => state;

let client: SupabaseClient = defaultClient;
/** Tests inject a fake client. */
export function setSyncClient(c: SupabaseClient) { client = c; }

type PgError = { code?: string; message: string; details?: string | null; hint?: string | null };
type Row = Record<string, unknown>;
type Res = { data: unknown; error: PgError | null; status?: number };

const PAGE = 1000;
const REFERENCE_TTL_MS = 6 * 3600_000;
/** Re-read this much before the cursor: covers transactions that committed after a pull. */
const PULL_OVERLAP_MS = 5 * 60_000;

/**
 * A problem that goes away by itself: retry later and keep the change queued.
 * Network failures, gateway and server errors, rate limits, timeouts, an expired
 * token (supabase-js refreshes it), deadlocks and serialization failures.
 */
export function isTransient(e: PgError | Error | unknown, status?: number): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (status !== undefined && (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500)) return true;
  const code = (e as PgError)?.code ?? '';
  if (/^(PGRST00[0-3]|PGRST301|40001|40P01|57014|57P0[1-3]|53\d\d\d|08\d\d\d)$/.test(code)) return true;
  const msg = (e as { message?: string })?.message ?? '';
  return !/^[0-9A-Z]{5}$/.test(code) && /fetch|network|timeout|timed out|load failed|ECONN|gateway|too many requests|rate limit|jwt expired/i.test(msg);
}

/**
 * Trouble with the connection itself (no network, expired token, rate limit, database
 * unreachable): nothing in the queue can go, so the round stops. Any other temporary
 * problem is treated as a problem with that item, which backs off on its own.
 */
export function isConnectionProblem(e: PgError | Error | unknown, status?: number): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (status !== undefined && (status === 0 || status === 401 || status === 429)) return true;
  const code = (e as PgError)?.code ?? '';
  if (/^(PGRST00[0-3]|PGRST301|08\d\d\d)$/.test(code)) return true;
  const msg = (e as { message?: string })?.message ?? '';
  return !/^[0-9A-Z]{5}$/.test(code) && /fetch|network|load failed|ECONN|too many requests|rate limit|jwt expired/i.test(msg);
}

const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 30 * 60_000;
/** Wait before the next try after `attempts` failed tries: 15 s, 30 s, 1 min … at most 30 min. */
export const backoffMs = (attempts: number) => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
/** After this many tries the Sync screen marks an item as needing attention. */
export const ATTENTION_AFTER_ATTEMPTS = 6;

/** The server's reason in plain words (gateway error pages arrive as HTML). */
export function reasonOf(e: PgError | Error | unknown, status?: number): string {
  const raw = [(e as PgError)?.message, (e as PgError)?.hint].filter(Boolean).join(' ');
  const text = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || (status ? `The server answered ${status}.` : 'The server did not answer.');
}

type Stop = { stop: 'connection' | 'server'; reason: string };
type Outcome = 'done' | 'kept' | Stop;
const stopFor = (e: unknown, status?: number): Stop =>
  ({ stop: isConnectionProblem(e, status) ? 'connection' : 'server', reason: reasonOf(e, status) });
const cannotRead: () => Stop = () => (typeof navigator !== 'undefined' && !navigator.onLine)
  ? { stop: 'connection', reason: 'No connection.' }
  : { stop: 'server', reason: 'The server copy could not be read to check this change.' };

const tableOf = (name: string) => (db as unknown as Record<string, import('dexie').Table<Row, unknown>>)[name]!;
const localKey = (cfg: TableConfig, pk: string) => (cfg.name === 'aa_fund_years' ? Number(pk) : pk);

/** The server's copy. `ok: false` means the read itself failed (keep the local row). */
async function fetchServerRow(cfg: TableConfig, pk: string): Promise<{ ok: boolean; row: Row | null }> {
  const res = await client.from(cfg.name).select('*').eq(cfg.pk, pk).maybeSingle();
  if (res.error) return { ok: false, row: null };
  return { ok: true, row: (res.data as Row | null) ?? null };
}

async function laterItemsFor(item: OutboxItem) {
  return db.outbox.where('pk').equals(item.pk!).filter((o) => o.table === item.table && (o.seq ?? 0) > (item.seq ?? 0)).toArray();
}

async function dropLaterItemsFor(item: OutboxItem) {
  const later = await laterItemsFor(item);
  await db.outbox.bulkDelete(later.map((o) => o.seq!));
  return later;
}

/** Put the server copy back on the device. Delete locally only when the server clearly has no such row. */
async function restoreFromServer(cfg: TableConfig, pk: string) {
  const { ok, row } = await fetchServerRow(cfg, pk);
  if (row) await tableOf(cfg.name).put(row);
  else if (ok) await tableOf(cfg.name).delete(localKey(cfg, pk));
  return row;
}

async function rebaseLater(item: OutboxItem, server: Row) {
  for (const o of await laterItemsFor(item)) {
    if (o.row && typeof server.version === 'number') await db.outbox.update(o.seq!, { row: { ...o.row, version: server.version }, isNew: false });
  }
}

const IGNORE_ON_COMPARE = new Set(['version', 'created_at', 'updated_at']);
/** The server already holds exactly what was sent (the reply to an earlier attempt was lost). */
function serverHas(server: Row | null, sent: Row): boolean {
  if (!server) return false;
  return Object.entries(sent).every(([k, v]) => IGNORE_ON_COMPARE.has(k) || JSON.stringify(server[k] ?? null) === JSON.stringify(v ?? null));
}

async function pushWrite(item: OutboxItem): Promise<Outcome> {
  const cfg = TABLE[item.table!];
  if (!cfg) {   // written by an older app version for a table that no longer syncs
    await db.failed.add({ label: item.label, error: 'This change is from an older version of the app and could not be sent.', at: new Date().toISOString(), rows: item.row ? [item.row] : [], userId: item.userId ?? null });
    return 'done';
  }
  const row = item.row!;
  const { [cfg.pk]: pkVal, ...rest } = row;
  let res: Res;
  // isNew is undefined for items queued by app version 1.1: keep their original (upsert) behaviour.
  const asUpdate = cfg.write === 'update' || (cfg.write === 'upsert' && item.isNew === false);
  if (asUpdate) {
    res = await client.from(cfg.name).update(rest).eq(cfg.pk, pkVal as string).select('*');
  } else if (cfg.write === 'insert' || item.isNew === true) {
    res = await client.from(cfg.name).upsert(row, { onConflict: cfg.pk, ignoreDuplicates: true }).select('*');
  } else {
    res = await client.from(cfg.name).upsert(row, { onConflict: cfg.pk }).select('*');
  }
  if (res.error) {
    if (isTransient(res.error, res.status)) return stopFor(res.error, res.status);
    if (res.error.code === 'PT409') {
      const { ok, row: server } = await fetchServerRow(cfg, item.pk!);
      if (!ok) return cannotRead();
      if (serverHas(server, row)) {           // our own earlier attempt went through
        await tableOf(cfg.name).put(server!);
        await rebaseLater(item, server!);
        return 'done';
      }
      const later = await dropLaterItemsFor(item);
      const latestLocal = later.length ? later[later.length - 1]!.row! : row;
      if (server) await tableOf(cfg.name).put(server);
      await db.conflicts.add({ table: cfg.name, pk: item.pk!, local: latestLocal, server, base: item.base ?? null, at: new Date().toISOString(), label: item.label, userId: item.userId ?? null });
    } else {
      const later = await dropLaterItemsFor(item);
      await restoreFromServer(cfg, item.pk!);
      const text = [res.error.message, res.error.hint].filter(Boolean).join(' ');
      await db.failed.add({ label: item.label, error: text, at: new Date().toISOString(), table: cfg.name, pk: item.pk, rows: [row, ...later.map((o) => o.row!).filter(Boolean)], userId: item.userId ?? null });
    }
    return 'done';
  }
  const rows = (res.data as Row[] | null) ?? [];
  if (rows.length === 0) {
    if (cfg.write === 'insert') return 'done';                 // append-only replay: already there
    const { ok, row: server } = await fetchServerRow(cfg, item.pk!);
    if (!ok) return cannotRead();
    if (server && !asUpdate) {                                  // insert replay: the row is already there
      await tableOf(cfg.name).put(server);
      await rebaseLater(item, server);
      return 'done';
    }
    const later = await dropLaterItemsFor(item);
    if (server) await tableOf(cfg.name).put(server); else await tableOf(cfg.name).delete(localKey(cfg, item.pk!));
    await db.failed.add({ label: item.label, error: server ? 'Your role cannot change this record.' : 'This record is not on the server, or your role cannot see it.',
      at: new Date().toISOString(), table: cfg.name, pk: item.pk, rows: [row, ...later.map((o) => o.row!).filter(Boolean)], userId: item.userId ?? null });
    return 'done';
  }
  const server = rows[0]!;
  await tableOf(cfg.name).put(server);
  await rebaseLater(item, server);
  return 'done';
}

async function pushRpc(item: OutboxItem): Promise<Outcome> {
  const res = await client.rpc(item.fn!, item.args ?? {}) as unknown as Res;
  if (res.error) {
    if (isTransient(res.error, res.status)) return stopFor(res.error, res.status);
    await db.failed.add({ label: item.label, error: [res.error.message, res.error.hint].filter(Boolean).join(' '), at: new Date().toISOString(), userId: item.userId ?? null });
  }
  return 'done';
}

/**
 * Send one queued file. `kept` means storage refused it: the item leaves the queue,
 * but the file stays on the device and a held item on the Sync screen offers Retry
 * and Save a copy. A refused upload never deletes the only copy of evidence (1.5.1).
 */
async function pushUpload(item: OutboxItem): Promise<Outcome> {
  const f = await db.files.get(item.fileId!);
  if (!f) return 'done';
  const { error } = await client.storage.from(item.bucket ?? 'evidence').upload(item.path!, f.blob, { contentType: f.type, upsert: false });
  if (error) {
    const msg = error.message ?? '';
    const status = Number((error as { statusCode?: string | number }).statusCode ?? (error as { status?: number }).status ?? NaN);
    if (/exists|duplicate/i.test(msg)) return 'done';       // replayed upload
    if (isTransient(error, Number.isFinite(status) ? status : undefined)) return stopFor(error, Number.isFinite(status) ? status : undefined);
    await db.failed.add({
      label: item.label,
      error: `${msg || 'The server refused the file.'} The file is kept on this device. Retry the upload, or save a copy.`,
      at: new Date().toISOString(),
      fileId: item.fileId, path: item.path, bucket: item.bucket ?? 'evidence', fileName: f.name, userId: item.userId ?? null,
    });
    return 'kept';
  }
  return 'done';
}

/** Changes queued on this device by another account (held, never sent with this session). */
export async function heldForOtherAccounts(userId: string | null): Promise<OutboxItem[]> {
  return (await db.outbox.toArray()).filter((o) => o.userId && o.userId !== userId);
}

/** Why the last push stopped or held items back (null when everything went). */
let lastProblem: Stop | null = null;
export const getPushProblem = () => lastProblem;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids an item writes or refers to, so later items that need it wait with it. */
function keysOf(o: OutboxItem): string[] {
  const keys: string[] = [];
  if (o.pk) keys.push(o.pk);
  if (o.kind === 'rpc') for (const v of Object.values(o.args ?? {})) if (typeof v === 'string' && UUID.test(v)) keys.push(v);
  if (o.kind === 'upload' && o.fileId) keys.push(o.fileId);
  return keys;
}
function dependsOn(o: OutboxItem, waiting: Set<string>): boolean {
  if (waiting.size === 0) return false;
  if (o.pk && waiting.has(o.pk)) return true;
  for (const v of Object.values(o.row ?? {})) if (typeof v === 'string' && waiting.has(v)) return true;
  for (const v of Object.values(o.args ?? {})) if (typeof v === 'string' && waiting.has(v)) return true;
  if (o.kind === 'upload' && o.path) for (const part of o.path.split('/')) if (waiting.has(part)) return true;
  return false;
}

/**
 * Send the queue, oldest first. Only items made by `userId` are sent (items from app
 * version 1.1 carry no account and are sent by whoever is signed in, as before).
 * Returns true when everything this account had queued has gone.
 */
export async function push(userId: string | null = null): Promise<boolean> {
  const items = await db.outbox.orderBy('seq').toArray();
  const waiting = new Set<string>();
  let serverProblems = 0;
  let heldBack = false;
  lastProblem = null;
  const now = Date.now();
  for (const item of items) {
    const fresh = await db.outbox.get(item.seq!);
    if (!fresh) continue;                                     // removed while handling an earlier item
    if (userId && fresh.userId && fresh.userId !== userId) continue;
    // Something this needs is still waiting: keep the order, try again with it.
    if (dependsOn(fresh, waiting)) { keysOf(fresh).forEach((k) => waiting.add(k)); heldBack = true; continue; }
    // Backing off after a server problem.
    if (fresh.nextAttemptAt && Date.parse(fresh.nextAttemptAt) > now) {
      keysOf(fresh).forEach((k) => waiting.add(k)); heldBack = true;
      lastProblem ??= { stop: 'server', reason: fresh.lastError ?? 'Waiting to try again.' };
      continue;
    }
    const outcome = fresh.kind === 'write' ? await pushWrite(fresh) : fresh.kind === 'rpc' ? await pushRpc(fresh) : await pushUpload(fresh);
    if (typeof outcome === 'object') {
      const attempts = fresh.attempts + 1;
      if (outcome.stop === 'connection') {
        await db.outbox.update(fresh.seq!, { attempts, lastError: outcome.reason });
        lastProblem = outcome;
        return false;
      }
      await db.outbox.update(fresh.seq!, { attempts, lastError: outcome.reason, nextAttemptAt: new Date(now + backoffMs(attempts)).toISOString() });
      keysOf(fresh).forEach((k) => waiting.add(k)); heldBack = true;
      lastProblem = outcome;
      serverProblems += 1;
      if (serverProblems >= 2) return false;                  // the server itself is in trouble
      continue;
    }
    await db.outbox.delete(fresh.seq!);
    // Delete the device copy only once the server has the file.
    if (fresh.kind === 'upload' && outcome === 'done') await db.files.delete(fresh.fileId!).catch(() => undefined);
  }
  return !heldBack;
}

/** Try every waiting item of this account again now (Sync now, Retry on the Sync screen). */
export async function retryNow(userId: string | null = null): Promise<void> {
  await db.outbox.toCollection().modify((o) => {
    if (!userId || !o.userId || o.userId === userId) delete o.nextAttemptAt;
  });
}

async function pendingKeys(table: string): Promise<Set<string>> {
  const items = await db.outbox.where('table').equals(table).toArray();
  return new Set(items.map((i) => i.pk!));
}

const quote = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

async function pullTable(cfg: TableConfig, force = false): Promise<void> {
  const t = tableOf(cfg.name);
  if (cfg.cursor === null) {
    const key = `ref:${cfg.name}`;
    const last = await getMeta<number>(key, 0);
    if (!force && Date.now() - last < REFERENCE_TTL_MS) return;
    const all: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(cfg.name).select('*').range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...((data as Row[]) ?? []));
      if (!data || data.length < PAGE) break;
    }
    // An empty answer for a catalogue that ships with the app means "no access yet", not "empty":
    // keep the bundled copy.
    if (all.length > 0) {
      await db.transaction('rw', t, async () => { await t.clear(); await t.bulkPut(all); });
    }
    await setMeta(key, Date.now());
    return;
  }
  const key = `cursor:${cfg.name}`;
  const saved = await getMeta<string | null>(key, null);
  const from = saved ? new Date(new Date(saved).getTime() - PULL_OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z';
  const pending = await pendingKeys(cfg.name);
  let maxTs = saved;
  let after: { ts: string; pk: string } | null = null;
  for (;;) {
    let q = client.from(cfg.name).select('*');
    q = after
      ? q.or(`${cfg.cursor}.gt.${quote(after.ts)},and(${cfg.cursor}.eq.${quote(after.ts)},${cfg.pk}.gt.${quote(after.pk)})`)
      : q.gte(cfg.cursor, from);
    const { data, error } = await q.order(cfg.cursor, { ascending: true }).order(cfg.pk, { ascending: true }).limit(PAGE);
    if (error) throw error;
    const all = (data as Row[]) ?? [];
    const rows = all.filter((r) => !pending.has(String(r[cfg.pk])));
    if (rows.length) await t.bulkPut(rows);
    if (all.length === 0) break;
    const last = all[all.length - 1]!;
    after = { ts: String(last[cfg.cursor]), pk: String(last[cfg.pk]) };
    if (!maxTs || new Date(after.ts) > new Date(maxTs)) maxTs = after.ts;
    if (all.length < PAGE) break;
  }
  if (maxTs) await setMeta(key, maxTs);
}

export async function pull(only?: string[], force = false): Promise<void> {
  for (const cfg of TABLES) {
    if (only && !only.includes(cfg.name)) continue;
    await pullTable(cfg, force);
  }
}

/**
 * Forget everything synced for the previous account or role set and fetch it again:
 * used when a different person signs in on this device, or the person's roles change
 * (rows they can no longer see must not stay readable here). The bundled reference
 * catalogue stays; queued changes stay (they belong to their own account).
 */
export async function resetSyncedData(): Promise<void> {
  const synced = TABLES.filter((t) => t.cursor !== null).map((t) => tableOf(t.name));
  await db.transaction('rw', [...synced, db.meta, db.outbox], async () => {
    const pendingByTable = new Map<string, Set<string>>();
    for (const o of await db.outbox.toArray()) if (o.table && o.pk) (pendingByTable.get(o.table) ?? pendingByTable.set(o.table, new Set()).get(o.table)!).add(o.pk);
    for (const cfg of TABLES.filter((t) => t.cursor !== null)) {
      const keep = pendingByTable.get(cfg.name);
      const t = tableOf(cfg.name);
      if (!keep?.size) await t.clear();
      else await t.filter((r) => !keep.has(String(r[cfg.pk]))).delete();
    }
    const metaKeys = (await db.meta.toArray()).map((m) => m.key).filter((k) => k.startsWith('cursor:') || k.startsWith('ref:') || k === 'lastSyncAt');
    await db.meta.bulkDelete(metaKeys);
  });
  setState({ lastSyncAt: null });
}

/**
 * Clear this device when an account signs out (ADR-009), without touching what other
 * accounts left here (audit 31 Oct 2026, #7). Everything synced is removed, except the
 * local rows that other accounts' queued changes need. Other accounts' queued changes,
 * held files, refusals and conflicts stay, and are sent or shown only when that account
 * signs in again. This account's own items are removed (sign-out refuses while it still
 * has any, unless the person chose to discard them).
 */
export async function clearDeviceAfterSignOut(userId: string | null): Promise<'deleted' | 'kept_for_others'> {
  const others = (u?: string | null) => !!u && u !== userId;
  const keepOutbox = (await db.outbox.toArray()).filter((o) => others(o.userId));
  const keepFailed = (await db.failed.toArray()).filter((f) => others(f.userId));
  const keepConflicts = (await db.conflicts.toArray()).filter((c) => others(c.userId));
  if (!keepOutbox.length && !keepFailed.length && !keepConflicts.length) {
    await db.delete();
    return 'deleted';
  }
  const synced = TABLES.filter((t) => t.cursor !== null);
  await db.transaction('rw', [...synced.map((t) => tableOf(t.name)), db.meta, db.outbox, db.failed, db.conflicts, db.files], async () => {
    const pending = new Map<string, Set<string>>();
    for (const o of keepOutbox) if (o.table && o.pk) (pending.get(o.table) ?? pending.set(o.table, new Set()).get(o.table)!).add(o.pk);
    for (const c of keepConflicts) (pending.get(c.table) ?? pending.set(c.table, new Set()).get(c.table)!).add(c.pk);
    for (const cfg of synced) {
      const keep = pending.get(cfg.name);
      const t = tableOf(cfg.name);
      if (!keep?.size) await t.clear();
      else await t.filter((r) => !keep.has(String(r[cfg.pk]))).delete();
    }
    await db.outbox.filter((o) => !others(o.userId)).delete();
    await db.failed.filter((f) => !others(f.userId)).delete();
    await db.conflicts.filter((c) => !others(c.userId)).delete();
    const files = new Set<string>([...keepOutbox.map((o) => o.fileId), ...keepFailed.map((f) => f.fileId)].filter((x): x is string => !!x));
    await db.files.filter((f) => !files.has(f.id)).delete();
    await db.meta.clear();
  });
  setState({ lastSyncAt: null });
  return 'kept_for_others';
}

/** This account's items that have not reached the server (sign-out warns about these). */
export async function unsentFor(userId: string | null): Promise<number> {
  const mine = (u?: string | null) => !u || u === userId;
  return (await db.outbox.filter((o) => mine(o.userId)).count())
    + (await db.failed.filter((f) => mine(f.userId)).count())
    + (await db.conflicts.filter((c) => mine(c.userId)).count());
}

let running: Promise<void> | null = null;
let rerun = false;

export async function syncNow(opts: { forceReference?: boolean; only?: string[]; retry?: boolean } = {}): Promise<void> {
  if (running) { rerun = true; return running; }
  running = (async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setState({ status: 'offline' }); return; }
      const { data } = await client.auth.getSession();
      if (!data.session) { setState({ status: 'signed_out' }); return; }
      setState({ status: 'syncing', message: null });
      if (opts.retry) await retryNow(data.session.user.id);
      const pushed = await push(data.session.user.id);
      const problem = getPushProblem();
      if (!pushed && problem?.stop === 'connection') { setState({ status: 'offline', message: problem.reason }); return; }
      // Items held back by a server problem do not stop the pull.
      await pull(opts.only, opts.forceReference);
      const at = new Date().toISOString();
      await setMeta('lastSyncAt', at);
      setState(pushed ? { status: 'idle', lastSyncAt: at, message: null } : { status: 'retrying', lastSyncAt: at, message: problem?.reason ?? null });
    } catch (e) {
      setState(isTransient(e) ? { status: 'offline' } : { status: 'error', message: (e as Error).message });
    } finally {
      running = null;
      if (rerun) { rerun = false; void syncNow(); }
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
export function scheduleSync(delayMs = 1500) {
  if (!started) return;                       // nothing is sent before an approved account starts sync
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, delayMs);
}

/** Start background sync: on load, every minute, on reconnect, on focus, and on realtime changes. */
export function startSync(): () => void {
  started = true;
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
    started = false;
    if (timer) { clearTimeout(timer); timer = null; }
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    void client.removeChannel(channel);
  };
}
