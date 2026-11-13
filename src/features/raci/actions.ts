// Authority edits to RACI assignments (ADR-033, ADR-006): the CDRRMO Head (or admin) changes
// who holds a duty. These go straight to the server, never the outbox; the local copy follows.
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { NeedsConnectionError } from '@/lib/store';
import type { RaciAssignment, RaciDuty } from '@/types';

const WHAT = 'Change a RACI assignment';

function online() {
  if (!navigator.onLine) throw new NeedsConnectionError(WHAT);
}
function rethrow(error: { message: string; hint?: string | null }): never {
  if (/fetch|network|load failed/i.test(error.message)) throw new NeedsConnectionError(WHAT);
  throw new Error(error.hint ? `${error.message} ${error.hint}` : error.message);
}

export async function addRaciAssignment(input: { activity_id: string; actor: string; duty: RaciDuty; qualifier: string | null }): Promise<RaciAssignment> {
  online();
  const { data, error } = await supabase.from('raci_assignments').insert(input).select('*').single();
  if (error) rethrow(error);
  await db.raci_assignments.put(data as RaciAssignment);
  return data as RaciAssignment;
}

export async function editRaciAssignment(row: RaciAssignment, patch: Partial<Pick<RaciAssignment, 'actor' | 'duty' | 'qualifier'>>): Promise<RaciAssignment> {
  online();
  const { data, error } = await supabase.from('raci_assignments')
    .update({ ...patch, version: row.version }).eq('id', row.id).select('*').single();
  if (error) {
    if (error.code === 'PT409') throw new Error('Someone changed this assignment a moment ago. Look again and try once more.');
    rethrow(error);
  }
  await db.raci_assignments.put(data as RaciAssignment);
  return data as RaciAssignment;
}

export async function removeRaciAssignment(row: RaciAssignment): Promise<void> {
  online();
  const { error } = await supabase.from('raci_assignments').delete().eq('id', row.id);
  if (error) rethrow(error);
  await db.raci_assignments.delete(row.id);
}
