// Results board (1.15.0): a large-screen view for the workshop room. It updates as validators record decisions
// (live from the synced data). Figures follow the same scoring as the cycle overview (src/domain/scoring.ts).
import { useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize } from 'lucide-react';
import { Button, Loading, Meter, PageHeader } from '@/components/ui';
import { agreement, totals, validationProgress } from '@/domain/validation';
import { useCycleData } from './data';

const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(2));
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

export function ResultsBoard() {
  const { cycleId } = useParams();
  const data = useCycleData(cycleId);
  const box = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => (data ? validationProgress(data.indicators, data.domains, data.responses) : []), [data]);
  if (data === undefined) return <Loading />;
  if (data === null) return <div className="page"><PageHeader title="Cycle not found" back="/assess" /></div>;
  const r = data.results;
  const ab = totals(rows, ['A', 'B']);
  const all = totals(rows);
  const agree = agreement(all.confirmed, all.revised);
  const tiles: [string, string, string][] = [
    ['Institutional Maturity Index (A+B)', `${fmt(r.imi.maturityIndex)} / 4`, r.imi.band ?? ''],
    ['Part A, CDRRMO', fmt(r.partA.maturityIndex), r.partA.band ?? ''],
    ['Part B, EOC', fmt(r.partB.maturityIndex), r.partB.band ?? ''],
    ['Interface Index (Part C)', fmt(r.interface.maturityIndex), r.interface.band ?? ''],
    ['Mandatory compliance', pct(r.imi.mandatoryCompliance), 'scored mandatory items at 3 or 4'],
    ['High-priority gaps', String(r.imi.highGaps + r.interface.highGaps), 'Parts A, B and C'],
  ];

  return (
    <div className="page">
      <PageHeader title="Results Board" back={`/assess/${data.cycle.id}/validate`} subtitle={`${data.cycle.name}. Updates as validators record their decisions.`}
        actions={<Button variant="secondary" icon={Maximize} tip="Show the board on the whole screen (press Esc to leave)" onClick={() => box.current?.requestFullscreen?.()}>Full screen</Button>} />
      <div ref={box} className="rounded-card bg-surface p-6 text-ink [&:fullscreen]:overflow-auto [&:fullscreen]:p-10">
        <p className="mb-4 text-sm uppercase tracking-wide text-muted">Ormoc City CDRRMO and EOC · Institutional assessment · {data.cycle.name}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(([label, value, note]) => (
            <div key={label} className="rounded-card border border-line p-5">
              <p className="text-base text-muted">{label}</p>
              <p className="font-data text-5xl font-bold leading-tight">{value}</p>
              <p className="text-base">{note}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-card border border-line p-5">
          <p className="text-lg font-semibold">Validation: {ab.validated} of {ab.indicators} core indicators validated
            <span className="font-normal text-muted"> · {all.revised} revised · agreement {agree === null ? '—' : `${Math.round(agree * 100)}%`}</span></p>
          <div className="mt-3"><Meter value={ab.validated} max={ab.indicators} label="Core indicators validated" tone="ok" /></div>
          <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((x) => (
              <div key={x.domain}>
                <p className="truncate text-sm" title={x.name}><span className="font-data font-semibold">{x.domain}</span> {x.name}</p>
                <p className="flex justify-between text-xs text-muted"><span className="tabular-nums">{x.validated} of {x.indicators} validated</span>
                  <span className="tabular-nums">index {fmt(r.domains[x.domain]?.maturityIndex ?? null)}</span></p>
                <Meter value={x.validated} max={x.indicators} label={`${x.domain} validated`} tone="ok" />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">Scores are provisional until validated. The index bands the unrounded value (Methodology v1.1 section 5).</p>
      </div>
    </div>
  );
}
