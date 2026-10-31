// Small per-account store for the readiness tools (exercise history, self-assessments, PSCP drafts).
// Kept in this browser only: these are working drafts and training records the person exports or
// prints. Browser storage can be cleared or blocked, so every read falls back and every write is
// best-effort. Signing out clears it with the rest of the device (see auth.tsx signOut).
const PREFIX = 'ormoc-tools';

const key = (userId: string | null, name: string) => `${PREFIX}:${userId ?? 'anon'}:${name}`;

export function loadTool<T>(userId: string | null, name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(userId, name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

export function saveTool<T>(userId: string | null, name: string, value: T): boolean {
  try { localStorage.setItem(key(userId, name), JSON.stringify(value)); return true; } catch { return false; }
}

/** Remove every tools entry on this device (called on sign-out). */
export function clearTools(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${PREFIX}:`)) localStorage.removeItem(k);
    }
  } catch { /* storage blocked */ }
}

/** Download a JSON or text file made in the browser. */
export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
