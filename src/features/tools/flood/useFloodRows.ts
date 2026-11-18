// One read of the flood picture: every barangay with its DDRiVE flood class, exposed people and proposed priority.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { floodClassOf, type FloodRow } from '@/domain/floodScreen';
import type { DdriveFlood } from '@/types';

export function useFloodRows() {
  return useLiveQuery(async () => {
    const [bs, fl, ex, pr] = await Promise.all([db.barangays.orderBy('name').toArray(), db.ddrive_flood.toArray(), db.ddrive_exposure.toArray(), db.ddrive_priority.toArray()]);
    const flood = new Map<string, DdriveFlood>(fl.map((r) => [r.psgc, r]));
    const pop = new Map(ex.map((r) => [r.psgc, r.population_2024]));
    const prio = new Map(pr.map((r) => [r.psgc, r.priority_rank]));
    const rows: FloodRow[] = bs.map((b) => {
      const f = flood.get(b.psgc);
      return { psgc: b.psgc, name: b.name, cls: floodClassOf(f?.susceptibility_class), exposedPop: f?.exposed_population ?? null, exposurePct: f?.exposure_pct ?? null,
        pop2024: pop.get(b.psgc) ?? b.population ?? null, priority: prio.get(b.psgc) ?? null };
    });
    return { rows, flood };
  }, []);
}
