import { db } from '@/lib/db';
import { callOnline, save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { currentLevel, LEVEL_INFO, levelChangeProblem } from '@/domain/eoc';
import type { EocLevel, LogCategory, LogEntry } from '@/types';

/** Change the activation level. Online only in cloud mode (ADR-003). */
export async function setEocLevel(level: EocLevel, reason: string, hazard: string | null, authority: string | null, userId: string | null) {
  const { level: cur, activation } = currentLevel(await db.eoc_activations.toArray());
  const problem = levelChangeProblem(cur, level, reason);
  if (problem) throw new Error(problem);
  return callOnline('set_eoc_level', { p_level: level, p_reason: reason, p_hazard: hazard, p_authority: authority }, 'Changing the EOC level', async () => {
    const now = new Date().toISOString();
    let id = activation?.id ?? null;
    await db.transaction('rw', db.eoc_activations, db.logbook_entries, async () => {
      if (activation) await db.eoc_activations.put({ ...activation, ended_at: now, version: activation.version + 1 });
      if (level !== 'white') {
        id = uuid();
        await db.eoc_activations.put({ id, level, reason, hazard_code: hazard, authority_ref: authority, started_by: userId, started_at: now, ended_at: null, version: 1, created_at: now, updated_at: now });
      }
      await db.logbook_entries.put({ id: uuid(), activation_id: id, occurred_at: now, category: 'level_change',
        entry: `EOC level changed ${LEVEL_INFO[cur].name.toUpperCase()} → ${LEVEL_INFO[level].name.toUpperCase()}. Reason: ${reason}`, corrects_id: null, author: userId, created_at: now });
    });
    return id;
  });
}

export async function addLog(entry: string, category: LogCategory, userId: string | null, corrects: string | null = null) {
  const { activation } = currentLevel(await db.eoc_activations.toArray());
  const row: LogEntry & { _new: true } = { _new: true, id: uuid(), activation_id: activation?.id ?? null, occurred_at: new Date().toISOString(), category,
    entry: entry.trim(), corrects_id: corrects, author: userId, created_at: new Date().toISOString() };
  await save('logbook_entries', row, `Logbook: ${entry.slice(0, 40)}`);
}
