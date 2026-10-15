// Write API used by every screen. Writes land in IndexedDB immediately and are
// queued for Supabase (cloud mode) or stay local (demo mode).
import { db, type OutboxItem } from './db';
import { TABLE } from './tables';
import { env } from './env';
import { supabase } from './supabase';
import { scheduleSync } from './sync';

type Row = Record<string, unknown>;

function payloadFor(table: string, row: Row): Row {
  const cfg = TABLE[table];
  if (!cfg) throw new Error(`Unknown table ${table}`);
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_') || cfg.omit?.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

const now = () => new Date().toISOString();

function dexieTable(table: string) {
  const t = (db as unknown as Record<string, unknown>)[table] as import('dexie').Table<Row, unknown> | undefined;
  if (!t) throw new Error(`No local table ${table}`);
  return t;
}

/** Save one row (insert or update). The row must carry the version last read. */
export async function save<R extends object>(table: string, row: R, label: string): Promise<R> {
  return (await saveMany([{ table, row, label }]))[0] as R;
}

/** Save several rows atomically, in order (order is kept in the outbox). */
export async function saveMany(items: { table: string; row: object; label: string }[]): Promise<object[]> {
  const stamp = now();
  const tables = Array.from(new Set(items.map((i) => i.table))).map(dexieTable);
  const saved: object[] = [];
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const it of items) {
      const cfg = TABLE[it.table]!;
      const r = { ...(it.row as Row) };
      const isNew = Boolean(r._new);
      delete r._new;
      if (cfg.cursor === 'updated_at' || 'updated_at' in r) r.updated_at = stamp;
      if (isNew && !r.created_at) r.created_at = stamp;
      if (isNew && typeof r.version !== 'number' && cfg.cursor === 'updated_at') r.version = 1;
      if (env.demo && !isNew && typeof r.version === 'number') r.version = (r.version as number) + 1;
      await dexieTable(it.table).put(r);
      saved.push(r);
      if (!env.demo) {
        const item: OutboxItem = {
          kind: 'write', table: it.table, pk: String(r[cfg.pk]), row: payloadFor(it.table, isNew && cfg.cursor === 'updated_at' ? { ...r, version: 1 } : r),
          label: it.label, createdAt: stamp, attempts: 0,
        };
        await db.outbox.add(item);
      }
    }
  });
  scheduleSync();
  return saved;
}

/**
 * Server function that is safe to replay (idempotent). `local` applies the same
 * effect to IndexedDB so the screen updates offline; in demo mode only `local` runs.
 */
export async function queueRpc(fn: string, args: Record<string, unknown>, label: string, local: () => Promise<void>): Promise<void> {
  await local();
  if (env.demo) return;
  await db.outbox.add({ kind: 'rpc', fn, args, label, createdAt: now(), attempts: 0 });
  scheduleSync();
}

export class NeedsConnectionError extends Error {
  constructor(what: string) { super(`${what} needs a connection. Try again when you are online.`); }
}

/** Authority actions (EOC level) run only online so two people cannot act on stale state. */
export async function callOnline<T>(fn: string, args: Record<string, unknown>, what: string, demo: () => Promise<T>): Promise<T> {
  if (env.demo) return demo();
  if (!navigator.onLine || !supabase) throw new NeedsConnectionError(what);
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.hint ? `${error.message} ${error.hint}` : error.message);
  scheduleSync(0);
  return data as T;
}

/** Keep a file on the device and queue its upload to the private evidence bucket. */
export async function queueUpload(file: File, path: string, fileId: string): Promise<void> {
  await db.files.put({ id: fileId, blob: file, name: file.name, type: file.type, createdAt: now() });
  if (env.demo) return;
  await db.outbox.add({ kind: 'upload', fileId, path, label: `Upload ${file.name}`, createdAt: now(), attempts: 0 });
  scheduleSync();
}

/**
 * Open an evidence file: the copy on this device if there is one (works offline),
 * otherwise a five-minute signed link from the private bucket.
 */
export async function evidenceFileUrl(evidenceId: string, path: string): Promise<string> {
  const local = await db.files.get(evidenceId);
  if (local) return URL.createObjectURL(local.blob);
  if (env.demo) throw new Error('This file was added on another device.');
  if (!navigator.onLine || !supabase) throw new NeedsConnectionError('Opening this file');
  const { data, error } = await supabase.storage.from('evidence').createSignedUrl(path, 300);
  if (error || !data) throw new Error(error?.message ?? 'The file could not be opened.');
  return data.signedUrl;
}
