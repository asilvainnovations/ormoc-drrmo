// City risk picture: a likelihood x severity heat grid with each DDRiVE hazard plotted, a ranked list beside it, and the
// evidence for the selected hazard underneath. Desk scores only; every one is pending working-session validation.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { buildMatrix } from '@/domain/riskMatrix';
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';

const CELL: Record<string, string> = {
  'Very Low': 'bg-ok-soft text-ok', Low: 'bg-sky-soft text-sky', Moderate: 'bg-warn-soft text-warn', High: 'bg-bad-soft text-bad', 'Very High': 'bg-bad/30 text-bad',
};
const PILL: Record<string, string> = { 'Very Low': 'bg-ok-soft text-ok', Low: 'bg-sky-soft text-sky', Moderate: 'bg-warn-soft text-warn', High: 'bg-bad-soft text-bad', 'Very High': 'bg-bad text-on-strong' };
const range = (min: number, max: number) => (min === 0 ? `0–${max}` : `${min}–${max}`);

export function RiskMatrixChart({ risks, matrix }: { risks: DdriveCityRisk[]; matrix: DdriveRiskMatrixRow[] }) {
  const grid = useMemo(() => buildMatrix(matrix, risks), [matrix, risks]);
  const ranked = useMemo(() => [...risks].sort((a, b) => b.ranking - a.ranking || b.severity - a.severity), [risks]);
  const [sel, setSel] = useState<string | null>(null);
  const selected = ranked.find((r) => r.hazard_event === sel) ?? null;
  const num = (r: DdriveCityRisk) => ranked.indexOf(r) + 1;
  if (!risks.length || !matrix.length) return <p className="text-muted">The DDRiVE city scores arrive with the next reference-data sync.</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div>
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1" role="group" aria-label="Risk matrix: likelihood against severity">
          {grid.cells.map((row, ri) => (
            <div key={ri} className="contents">
              <div className="flex items-center justify-end pr-2 text-right text-[11px] font-bold text-muted">{range(grid.likelihood[ri]!.min, grid.likelihood[ri]!.max)}</div>
              {row.map((cell, ci) => (
                <div key={ci} className={clsx('flex min-h-[4.5rem] flex-col justify-between rounded-control p-1.5', CELL[cell.label] ?? 'bg-sunken text-muted')}>
                  <span className="text-[10px] font-extrabold opacity-80">{cell.band}</span>
                  <div className="flex flex-wrap gap-1">
                    {cell.hazards.map((h) => (
                      <button key={h.hazard_event} type="button" onClick={() => setSel(h.hazard_event === sel ? null : h.hazard_event)} aria-label={`${h.hazard_event}, ${h.label} risk`} aria-pressed={sel === h.hazard_event}
                        className={clsx('inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-extrabold', sel === h.hazard_event ? 'border-ink bg-ink text-paper' : 'border-ink/70 bg-surface text-ink')}>{num(h)}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div />
          {grid.severity.map((s) => <div key={s.min} className="pt-1 text-center text-[11px] font-bold text-muted">{range(s.min, s.max)}</div>)}
        </div>
        <p className="mt-2 text-center text-xs font-bold text-muted">Severity (0–100) →</p>
        <p className="text-xs font-bold text-muted">↑ Likelihood (0–10)</p>
      </div>

      <div>
        <ol className="space-y-1" aria-label="Hazards, highest risk first">
          {ranked.map((r) => (
            <li key={r.hazard_event}>
              <button type="button" onClick={() => setSel(r.hazard_event === sel ? null : r.hazard_event)} aria-pressed={sel === r.hazard_event}
                className={clsx('flex min-h-tap w-full items-center gap-3 rounded-control px-2 text-left hover:bg-sky-soft/60', sel === r.hazard_event && 'bg-sky-soft')}>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink/70 text-xs font-extrabold text-ink">{num(r)}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-ink">{r.hazard_event}</span>
                <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold', PILL[r.label] ?? 'bg-sunken text-muted')}>{r.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {selected && (
          <div className="mt-4 rounded-sheet border border-line bg-surface p-4 text-sm" aria-live="polite">
            <p className="font-extrabold text-ink">{selected.hazard_event} <span className="font-normal text-muted">· {selected.hazard_family}</span></p>
            <p className="mt-1 text-muted">Likelihood {selected.likelihood} of 10, severity {selected.severity} of 100, vulnerability {selected.vulnerability_rating ?? 'not rated'}. Band {selected.band}.</p>
            {selected.evidence_anchor && <p className="mt-2 leading-relaxed text-ink">{selected.evidence_anchor}</p>}
            {selected.response_measures && <p className="mt-2 text-xs text-muted">Response measures: {selected.response_measures}</p>}
            {selected.validation_status && <p className="mt-1 text-xs text-muted">Status: {selected.validation_status}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
