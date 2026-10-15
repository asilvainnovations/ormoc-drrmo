import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { cycleResults, evidenceCap } from '@/domain/scoring';
import type { Evidence, Response } from '@/types';

export function useCycleData(cycleId: string | undefined) {
  return useLiveQuery(async () => {
    if (!cycleId) return null;
    const cycle = await db.assessment_cycles.get(cycleId);
    if (!cycle) return null;
    const [domains, indicators, responses] = await Promise.all([
      db.iat_domains.orderBy('sort').toArray(),
      db.iat_indicators.orderBy('sort').toArray(),
      db.responses.where('cycle_id').equals(cycleId).toArray(),
    ]);
    const evidence = await db.evidence.where('response_id').anyOf(responses.map((r) => r.id)).toArray();
    const evByResp = new Map<string, Evidence[]>();
    for (const e of evidence) evByResp.set(e.response_id, [...(evByResp.get(e.response_id) ?? []), e]);
    const byIndicator = new Map<string, Response>(responses.map((r) => [r.indicator_id, r]));
    return {
      cycle, domains, indicators, responses, byIndicator, evByResp,
      capOf: (respId: string | undefined) => evidenceCap(respId ? evByResp.get(respId) ?? [] : []),
      results: cycleResults(indicators, domains, responses),
    };
  }, [cycleId]);
}

export const isEditable = (status: string) => status !== 'final' && status !== 'archived';
