// Barangay condition tiles shared by the EOC Board and Barangays workspace.
// Operational clusters and CSWD social-welfare districts are intentionally
// separate dimensions; callers opt into the grouping they need.
import { useMemo } from 'react';
import { relative } from '@/lib/time';
import { BarangayTile, type Cond } from './kit';
import type { PictureRow } from './useBarangayPicture';
import type { CSWDDistrict } from './cswdDistricts';

export type CSWDPictureRow = PictureRow & {
  cswdDistrict?: CSWDDistrict | null;
};

const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-2';

interface BarangayGridProps {
  rows: PictureRow[];
  onPick?: (row: PictureRow) => void;
  linkTo?: (row: PictureRow) => string;
  groupByCluster?: boolean;
  groupByCSWDDistrict?: boolean;
  only?: Cond[];
}

export function BarangayGrid({
  rows,
  onPick,
  linkTo,
  groupByCluster,
  groupByCSWDDistrict,
  only,
}: BarangayGridProps) {
  const shown = useMemo(
    () => rows.filter((row) => !only || only.includes(row.cond)),
    [rows, only],
  );

  const tile = (row: PictureRow) => (
    <BarangayTile
      key={row.b.psgc}
      name={row.b.name}
      cond={row.cond}
      sub={
        row.report
          ? row.report.persons_evacuated != null
            ? `${row.report.persons_evacuated.toLocaleString('en-PH')} evac. · ${relative(row.report.reported_at)}`
            : relative(row.report.reported_at)
          : undefined
      }
      onClick={onPick ? () => onPick(row) : undefined}
      to={linkTo?.(row)}
    />
  );

  if (groupByCSWDDistrict) {
    const groups = new Map<
      string,
      { title: string; rows: CSWDPictureRow[]; order: number }
    >();

    for (const row of shown as CSWDPictureRow[]) {
      const district = row.cswdDistrict;
      const key = district?.code ?? 'unassigned';

      if (!groups.has(key)) {
        groups.set(key, {
          title: district?.name ?? 'CSWD district not matched',
          rows: [],
          order: district
            ? Number(district.code.replace(/\D/g, ''))
            : Number.MAX_SAFE_INTEGER,
        });
      }

      groups.get(key)!.rows.push(row);
    }

    return (
      <div className="space-y-5">
        {[...groups.entries()]
          .sort((a, b) => a[1].order - b[1].order)
          .map(([key, group]) => {
            const reporting = group.rows.filter(
              (row) => row.cond !== 'silent',
            ).length;
            const total = group.rows.length;
            const percent = total
              ? Math.round((reporting / total) * 100)
              : 0;

            return (
              <section
                key={key}
                aria-labelledby={`cswd-grid-${key.replace(/\s+/g, '-').toLowerCase()}`}
                className="overflow-hidden rounded-sheet border border-line bg-surface"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sunken/50 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <h3
                      id={`cswd-grid-${key.replace(/\s+/g, '-').toLowerCase()}`}
                      className="font-extrabold text-ink"
                    >
                      {group.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {reporting} of {total} reporting · {percent}% coverage
                    </p>
                  </div>

                  <div
                    className="h-2 w-24 overflow-hidden rounded-full bg-line sm:w-32"
                    role="progressbar"
                    aria-label={`${group.title} reporting coverage`}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={reporting}
                  >
                    <div
                      className="h-full rounded-full bg-info transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 sm:p-4">
                  <div className={GRID}>{group.rows.map(tile)}</div>
                </div>
              </section>
            );
          })}
      </div>
    );
  }

  if (!groupByCluster) {
    return <div className={GRID}>{shown.map(tile)}</div>;
  }

  // Existing CDRRMO operational-cluster grouping, unchanged for other callers.
  const groups = new Map<
    string,
    { title: string; rows: PictureRow[] }
  >();

  for (const row of shown) {
    const key = row.cluster?.code ?? '~';

    if (!groups.has(key)) {
      groups.set(key, {
        title: row.cluster
          ? `${row.cluster.code} ${row.cluster.name}`
          : 'Not in a cluster yet',
        rows: [],
      });
    }

    groups.get(key)!.rows.push(row);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => {
          const reporting = group.rows.filter(
            (row) => row.cond !== 'silent',
          ).length;

          return (
            <section key={key}>
              <p className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-extrabold text-ink">
                {group.title}
                <span className="font-data text-xs font-bold text-muted">
                  {reporting} of {group.rows.length} reporting
                </span>
              </p>
              <div className={GRID}>{group.rows.map(tile)}</div>
            </section>
          );
        })}
    </div>
  );
}
