import { db } from '@/lib/db';
import { queueRpc } from '@/lib/store';
import { uuid, uuidv5 } from '@/lib/ids';
import type { ProtocolRun, ProtocolRunStep, ProtocolTemplate } from '@/types';

/** Start a run. Works offline: steps get the same UUIDv5 ids the server will assign. */
export async function startProtocol(t: ProtocolTemplate, userId: string | null, context?: { type: string; id: string | null }, title: string = t.title): Promise<string> {
  const runId = uuid();
  const now = new Date();
  const steps = await db.protocol_steps.where('template_id').equals(t.id).sortBy('seq');
  const run: ProtocolRun = {
    id: runId, template_id: t.id, template_rev: t.template_rev, title, context_type: context?.type ?? 'none', context_id: context?.id ?? null,
    status: 'running', started_by: userId, started_at: now.toISOString(), completed_at: null, abort_reason: null, version: 1,
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };
  const runSteps: ProtocolRunStep[] = await Promise.all(steps.map(async (s) => ({
    id: await uuidv5(String(s.seq), runId), run_id: runId, step_id: s.id, seq: s.seq, instruction: s.instruction,
    is_critical: s.is_critical, requires_note: s.requires_note,
    due_at: s.due_offset_minutes !== null ? new Date(now.getTime() + s.due_offset_minutes * 60_000).toISOString() : null,
    status: 'pending' as const, done_by: null, done_at: null, note: null, version: 1, created_at: now.toISOString(), updated_at: now.toISOString(),
  })));
  await queueRpc('start_protocol', { p_template: t.id, p_title: title, p_context_type: context?.type ?? 'none', p_context_id: context?.id ?? null, p_run_id: runId },
    `Start protocol: ${title}`,
    async () => { await db.transaction('rw', db.protocol_runs, db.protocol_run_steps, async () => { await db.protocol_runs.put(run); await db.protocol_run_steps.bulkPut(runSteps); }); });
  return runId;
}
