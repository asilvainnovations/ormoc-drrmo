// One read of the barangay picture for the Board and the Barangays screen: every barangay with its latest report in the
// current period (or none = silent), its cluster, and the totals. Counts only, no names of persons.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { currentLevel, currentReportWindow, cutoffForLevel, latestPerBarangay } from '@/domain/eoc';
import type { Barangay, BarangayCluster, BarangayReport } from '@/types';
import type { Cond } from './kit';

export interface PictureRow { b: Barangay; report: BarangayReport | null; cond: Cond; cluster: BarangayCluster | null; priority: number | null }

export function useBarangayPicture() {
  return useLiveQuery(async () => {
    const activations = await db.eoc_activations.toArray();
    const window = currentReportWindow(activations);
    const { level, activation } = currentLevel(activations);
    const latest = new Map<string, BarangayReport>(latestPerBarangay(await db.barangay_reports.toArray(), window).map((r) => [r.barangay_psgc, r]));
    const clusters = new Map((await db.barangay_clusters.toArray()).map((c) => [c.id, c]));
    const priority = new Map((await db.ddrive_priority.toArray()).map((p) => [p.psgc, p.priority_rank]));
    const cutoff = cutoffForLevel(await db.sitrep_cutoffs.toArray(), level);
    const rows: PictureRow[] = (await db.barangays.orderBy('name').toArray()).map((b) => {
      const report = latest.get(b.psgc) ?? null;
      return { b, report, cond: report ? report.condition : 'silent', cluster: b.cluster_id ? clusters.get(b.cluster_id) ?? null : null, priority: priority.get(b.psgc) ?? null };
    });
    const counts: Record<Cond, number> = { silent: 0, normal: 0, monitoring: 0, affected: 0, evacuating: 0, isolated: 0 };
    for (const r of rows) counts[r.cond] += 1;
    return { rows, counts, window, level, activation, cutoff, clusters: [...clusters.values()].sort((a, b) => a.code.localeCompare(b.code)) };
  }, []);
}
