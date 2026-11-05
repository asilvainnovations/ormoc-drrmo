// Error reports (audit 31 Oct 2026, #19). A crash shows a recovery screen and sends a
// short report to the City's own project (table client_errors, migration
// 20261105001500): no third-party service and no change to the CSP.
//
// A report holds the app version, the screen path, the message and stack, and the browser
// name. Never form contents or record data. Email addresses and long numbers (phone or ID
// numbers) are blanked out of the message and stack before sending (RA 10173).
import { env } from './env';
import { supabase } from './supabase';
import { PRODUCT } from './product';

export type ErrorKind = 'render' | 'error' | 'unhandled_rejection' | 'chunk_load';
export interface ErrorReport { app_version: string; route: string | null; kind: ErrorKind; message: string; stack: string | null; user_agent: string | null }

const MAX_PER_SESSION = 10;
let sentThisSession = 0;
const seen = new Set<string>();

/** Blank out what could identify a person: email addresses and runs of 7 or more digits. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number]' : m));
}

/** A page that loaded before a new version was deployed asks for code that no longer exists. */
export function isChunkLoadError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? String(e ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}

export function buildReport(kind: ErrorKind, e: unknown, path: string | null): ErrorReport {
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })());
  const route = path ? path.split('?')[0]!.split('#')[0]!.slice(0, 200) : null;
  return {
    app_version: env.appVersion.slice(0, 20),
    route,
    kind: isChunkLoadError(err) ? 'chunk_load' : kind,
    message: scrub(err.message || err.name || 'Unknown error').slice(0, 500),
    stack: err.stack ? scrub(err.stack).slice(0, 4000) : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  };
}

/** Send a report, best effort: never throws, at most ten per session, each problem once. */
export async function reportError(kind: ErrorKind, e: unknown): Promise<void> {
  try {
    const report = buildReport(kind, e, typeof location !== 'undefined' ? location.pathname : null);
    const key = `${report.kind}:${report.message}`;
    if (seen.has(key) || sentThisSession >= MAX_PER_SESSION) return;
    seen.add(key);
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    sentThisSession += 1;
    await supabase.from('client_errors').insert(report);   // no select: only the administrator reads reports
  } catch { /* reporting must never cause a second failure */ }
}

/** Errors outside React (event handlers, timers, promises nobody awaited). */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (ev) => { if (ev.error) void reportError('error', ev.error); });
  window.addEventListener('unhandledrejection', (ev) => { void reportError('unhandled_rejection', ev.reason); });
}

/** Text for "Copy details" on the recovery screen. */
export function detailsText(e: unknown): string {
  const r = buildReport('render', e, typeof location !== 'undefined' ? location.pathname : null);
  return [`${PRODUCT.short} ${r.app_version}`, `Screen: ${r.route ?? '-'}`, `When: ${new Date().toISOString()}`, `Error: ${r.message}`, r.stack ?? ''].join('\n');
}
