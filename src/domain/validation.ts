// Validation workshop (1.15.0; Methodology v1.1 section 6). Computed on the device from synced responses, so the
// queue, sheets and results board work offline. Counts mirror the view public.v_validation_progress.
import type { Domain, EvidenceCheck, Indicator, Response } from '@/types';

export interface ProgressRow {
  domain: string; part: Domain['part']; name: string; indicators: number; draft: number; submitted: number;
  validated: number; confirmed: number; revised: number; evidenceVerified: number; evidencePending: number;
}

/** Per-domain progress, in domain order; an indicator with no response counts as draft and pending evidence. */
export function validationProgress(indicators: Indicator[], domains: Domain[], responses: Response[]): ProgressRow[] {
  const byInd = new Map(responses.map((r) => [r.indicator_id, r]));
  return domains.map((d) => {
    const row: ProgressRow = { domain: d.code, part: d.part, name: d.name, indicators: 0, draft: 0, submitted: 0, validated: 0,
      confirmed: 0, revised: 0, evidenceVerified: 0, evidencePending: 0 };
    for (const i of indicators) {
      if (i.domain !== d.code) continue;
      const r = byInd.get(i.id);
      row.indicators += 1;
      if (!r || r.status === 'draft') row.draft += 1;
      else if (r.status === 'provisional') row.submitted += 1;
      else row.validated += 1;
      if (r?.validation_decision === 'confirmed') row.confirmed += 1;
      if (r?.validation_decision === 'revised') row.revised += 1;
      const ev = r?.evidence_check ?? 'pending';
      if (ev === 'verified') row.evidenceVerified += 1;
      if (ev === 'pending') row.evidencePending += 1;
    }
    return row;
  }).filter((r) => r.indicators > 0);
}

export function totals(rows: ProgressRow[], parts: Domain['part'][] = ['A', 'B', 'C']): Omit<ProgressRow, 'domain' | 'part' | 'name'> {
  const t = { indicators: 0, draft: 0, submitted: 0, validated: 0, confirmed: 0, revised: 0, evidenceVerified: 0, evidencePending: 0 };
  for (const r of rows) if (parts.includes(r.part)) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += r[k];
  return t;
}

/** Share of validated scores the validator kept as submitted (null before any validation). */
export const agreement = (confirmed: number, revised: number): number | null => (confirmed + revised ? confirmed / (confirmed + revised) : null);

export type QueueStatus = 'all' | 'submitted' | 'validated' | 'draft';
export interface QueueFilter { part: Domain['part'] | 'all'; status: QueueStatus; evidence: EvidenceCheck | 'all'; text: string }

/** Indicators for the validation queue, in indicator order. */
export function queue(indicators: Indicator[], domains: Domain[], responses: Response[], f: QueueFilter) {
  const partOf = new Map(domains.map((d) => [d.code, d.part]));
  const byInd = new Map(responses.map((r) => [r.indicator_id, r]));
  const term = f.text.trim().toLowerCase();
  return indicators.map((i) => ({ indicator: i, response: byInd.get(i.id), part: partOf.get(i.domain)! }))
    .filter(({ indicator: i, response: r, part }) => {
      if (f.part !== 'all' && part !== f.part) return false;
      const st = !r ? 'draft' : r.status === 'provisional' ? 'submitted' : r.status;
      if (f.status !== 'all' && st !== f.status) return false;
      if (f.evidence !== 'all' && (r?.evidence_check ?? 'pending') !== f.evidence) return false;
      return !term || `${i.id} ${i.statement}`.toLowerCase().includes(term);
    });
}
