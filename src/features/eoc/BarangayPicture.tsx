// The 85 barangays as a tile grid coloured by their latest reported condition. Silent barangays (no report in this period) are
// outlined and empty so the gaps are the first thing the eye finds.
import { useMemo } from 'react';
import { relative } from '@/lib/time';
import { BarangayTile, type Cond } from './kit';
import type { PictureRow } from './useBarangayPicture';

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-2';

export function BarangayGrid({ rows, onPick, linkTo, groupByCluster, only }: {
  rows: PictureRow[]; onPick?: (r: PictureRow) => void; linkTo?: (r: PictureRow) => string; groupByCluster?: boolean; only?: Cond[];
}) {
  const shown = useMemo(() => rows.filter((r) => !only || only.includes(r.cond)), [rows, only]);
  const tile = (r: PictureRow) => (
    <BarangayTile key={r.b.psgc} name={r.b.name} cond={r.cond}
      sub={r.report ? (r.report.persons_evacuated ? `${r.report.persons_evacuated} evac. · ${relative(r.report.reported_at)}` : relative(r.report.reported_at)) : undefined}
      onClick={onPick ? () => onPick(r) : undefined} to={linkTo?.(r)} />
  );
  if (!groupByCluster) return <div className={GRID}>{shown.map(tile)}</div>;
  const groups = new Map<string, { title: string; rows: PictureRow[] }>();
  for (const r of shown) {
    const key = r.cluster?.code ?? '~';
    if (!groups.has(key)) groups.set(key, { title: r.cluster ? `${r.cluster.code} ${r.cluster.name}` : 'Not in a cluster yet', rows: [] });
    groups.get(key)!.rows.push(r);
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => {
        const reporting = g.rows.filter((r) => r.cond !== 'silent').length;
        return (
          <div key={k}>
            <p className="mb-2 flex items-baseline gap-2 text-sm font-extrabold text-ink">{g.title}<span className="font-data text-xs font-bold text-muted">{reporting} of {g.rows.length} reporting</span></p>
            <div className={GRID}>{g.rows.map(tile)}</div>
          </div>
        );
      })}
    </div>
  );
}
