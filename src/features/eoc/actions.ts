import { db } from '@/lib/db';
import { callOnline, save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { syncNow } from '@/lib/sync';
import { currentLevel, levelChangeProblem } from '@/domain/eoc';
import type { EocLevel, LogCategory, LogEntry } from '@/types';

/** Change the activation level. Online only, so two people cannot act on stale state (ADR-003). */
export async function setEocLevel(level: EocLevel, reason: string, hazard: string | null, authority: string | null) {
  const { level: cur } = currentLevel(await db.eoc_activations.toArray());
  const problem = levelChangeProblem(cur, level, reason);
  if (problem) throw new Error(problem);
  const id = await callOnline<string | null>('set_eoc_level', { p_level: level, p_reason: reason, p_hazard: hazard, p_authority: authority }, 'Changing the EOC level');
  // Bring the new activation and its logbook line to this device at once.
  await syncNow({ only: ['eoc_activations', 'logbook_entries'] });
  return id;
}

export async function addLog(entry: string, category: LogCategory, userId: string | null, corrects: string | null = null) {
  const { activation } = currentLevel(await db.eoc_activations.toArray());
  const row: LogEntry & { _new: true } = { _new: true, id: uuid(), activation_id: activation?.id ?? null, occurred_at: new Date().toISOString(), category,
    entry: entry.trim(), corrects_id: corrects, author: userId, created_at: new Date().toISOString() };
  await save('logbook_entries', row, `Logbook: ${entry.slice(0, 40)}`);
}
