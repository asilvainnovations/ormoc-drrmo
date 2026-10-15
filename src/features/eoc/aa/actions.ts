import { db } from '@/lib/db';
import { queueRpc } from '@/lib/store';
import { uuidv5 } from '@/lib/ids';
import type { AaAction } from '@/types';

/** Load the IRR Rule IV checklist for a declaration or an early-action PDRA (idempotent, offline-capable). */
export async function loadChecklist(target: { declarationId?: string; pdraId?: string }, hazard: string): Promise<number> {
  const ns = (target.declarationId ?? target.pdraId)!;
  const templates = (await db.aa_action_templates.orderBy('seq').toArray()).filter((t) => t.hazard_code === null || t.hazard_code === hazard);
  const rows: AaAction[] = await Promise.all(templates.map(async (t) => ({
    id: await uuidv5(t.id, ns), declaration_id: target.declarationId ?? null, pdra_id: target.pdraId ?? null, template_id: t.id,
    sector: t.sector, title: t.title, lead_office: t.lead_office, timing: t.timing, status: 'pending' as const, note: null, done_at: null, version: 1,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })));
  let added = 0;
  await queueRpc('load_aa_checklist', { p_declaration: target.declarationId ?? null, p_pdra: target.pdraId ?? null }, 'Load anticipatory action checklist', async () => {
    const existing = new Set((await db.aa_actions.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((r) => r!.id));
    const fresh = rows.filter((r) => !existing.has(r.id));
    added = fresh.length;
    await db.aa_actions.bulkPut(fresh);
  });
  return added;
}
