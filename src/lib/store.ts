// Write API used by every screen. Writes land in IndexedDB immediately and are
// queued in the outbox for Supabase (ADR-003).
import { db, type OutboxItem } from './db';
import { TABLE } from './tables';
import { supabase } from './supabase';
import { scheduleSync } from './sync';

type Row = Record<string, unknown>;

/** The signed-in account. Every queued change is stamped with it (set by AuthProvider). */
let actingUser: string | null = null;
export function setActingUser(id: string | null) { actingUser = id; }
export const getActingUser = () => actingUser;

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
      const pk = r[cfg.pk];
      const before = isNew ? null : ((await dexieTable(it.table).get(cfg.name === 'aa_fund_years' ? Number(pk) : pk as string)) ?? null);
      if (cfg.cursor === 'updated_at' || 'updated_at' in r) r.updated_at = stamp;
      if (isNew && !r.created_at) r.created_at = stamp;
      if (isNew && typeof r.version !== 'number' && cfg.cursor === 'updated_at') r.version = 1;
      await dexieTable(it.table).put(r);
      saved.push(r);
      const item: OutboxItem = {
        kind: 'write', table: it.table, pk: String(pk), row: payloadFor(it.table, isNew && cfg.cursor === 'updated_at' ? { ...r, version: 1 } : r),
        label: it.label, createdAt: stamp, attempts: 0, userId: actingUser, isNew,
        base: before ? payloadFor(it.table, before) : null,
      };
      await db.outbox.add(item);
    }
  });
  scheduleSync();
  return saved;
}

/**
 * Server function that is safe to replay (idempotent). `local` applies the same
 * effect to IndexedDB so the screen updates offline.
 */
export async function queueRpc(fn: string, args: Record<string, unknown>, label: string, local: () => Promise<void>): Promise<void> {
  await local();
  await db.outbox.add({ kind: 'rpc', fn, args, label, createdAt: now(), attempts: 0, userId: actingUser });
  scheduleSync();
}

export class NeedsConnectionError extends Error {
  constructor(what: string) { super(`${what} needs a connection. Try again when you are online.`); }
}

/** Authority actions (EOC level) run only online so two people cannot act on stale state. */
export async function callOnline<T>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  if (!navigator.onLine) throw new NeedsConnectionError(what);
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (/fetch|network|load failed/i.test(error.message)) throw new NeedsConnectionError(what);
    throw new Error(error.hint ? `${error.message} ${error.hint}` : error.message);
  }
  return data as T;
}

/** Storage buckets accept these types only (migrations …_storage.sql and …_document_vault.sql). */
export const UPLOAD_TYPES: Record<'evidence' | 'vault', { types: string[]; maxMb: number; label: string }> = {
  evidence: {
    types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxMb: 15, label: 'PDF, Word (.docx), Excel (.xlsx) or a JPEG, PNG, WebP or HEIC photo',
  },
  vault: {
    types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'],
    maxMb: 25, label: 'PDF, image, Word, Excel, PowerPoint or plain text',
  },
};

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain',
};
/** The file's type, from its name when the browser does not say (common for HEIC and Office files). */
export function fileType(file: File): string {
  return file.type || BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] || '';
}

/** Why this file cannot be uploaded to the bucket, or null. Checked before anything is saved. */
export function uploadProblem(file: File, bucket: 'evidence' | 'vault'): string | null {
  const rule = UPLOAD_TYPES[bucket];
  if (!rule.types.includes(fileType(file))) return `${file.name} is not a file type the City's storage accepts. Use ${rule.label}.`;
  if (file.size > rule.maxMb * 1024 * 1024) return `${file.name} is larger than ${rule.maxMb} MB.`;
  return null;
}

/** Keep a file on the device and queue its upload to the private bucket. */
export async function queueUpload(file: File, path: string, fileId: string, bucket: 'evidence' | 'vault' = 'evidence'): Promise<void> {
  const problem = uploadProblem(file, bucket);
  if (problem) throw new Error(problem);
  await db.files.put({ id: fileId, blob: file, name: file.name, type: fileType(file), createdAt: now() });
  await db.outbox.add({ kind: 'upload', fileId, path, bucket, label: `Upload ${file.name}`, createdAt: now(), attempts: 0, userId: actingUser });
  scheduleSync();
}

/**
 * Queue a refused upload again (Sync screen → Retry upload). The file never left the
 * device; the retry keeps its path, bucket and the account that made it.
 */
export async function retryHeldUpload(failedId: number): Promise<void> {
  const f = await db.failed.get(failedId);
  if (!f?.fileId || !f.path) return;
  if (!(await db.files.get(f.fileId))) throw new Error('The file is no longer on this device.');
  await db.transaction('rw', db.outbox, db.failed, async () => {
    await db.outbox.add({ kind: 'upload', fileId: f.fileId, path: f.path, bucket: f.bucket ?? 'evidence',
      label: f.label, createdAt: now(), attempts: 0, userId: f.userId ?? actingUser });
    await db.failed.delete(failedId);
  });
  scheduleSync();
}

/** The held file itself, for "Save a copy". */
export async function heldFile(fileId: string) {
  return db.files.get(fileId);
}

/**
 * Remove a refused item from the Sync screen. For a refused upload this also deletes
 * the file from the device, so the screen asks first.
 */
export async function discardFailed(failedId: number): Promise<void> {
  await db.transaction('rw', db.failed, db.files, db.outbox, async () => {
    const f = await db.failed.get(failedId);
    if (f?.fileId) {
      const stillQueued = await db.outbox.filter((o) => o.kind === 'upload' && o.fileId === f.fileId).count();
      if (!stillQueued) await db.files.delete(f.fileId);
    }
    await db.failed.delete(failedId);
  });
}

/**
 * Open an evidence file: the copy on this device if there is one (works offline),
 * otherwise a five-minute signed link from the private bucket.
 */
export async function evidenceFileUrl(evidenceId: string, path: string, bucket: 'evidence' | 'vault' = 'evidence'): Promise<string> {
  const local = await db.files.get(evidenceId);
  if (local) return URL.createObjectURL(local.blob);
  if (!navigator.onLine) throw new NeedsConnectionError('Opening this file');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) throw new Error(error?.message ?? 'The file could not be opened.');
  return data.signedUrl;
}
