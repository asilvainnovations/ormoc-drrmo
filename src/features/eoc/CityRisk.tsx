// City Risk Picture (1.35.0): the QRE 5×5 matrix as the City configured it (likelihood bands × severity bands, cells VL1–VH9),
// each hazard placed in its own cell, the reasoning behind each rank, and the integrated risk register. Figures come from the
// DDRiVE workbook (sheets 12–14) and are desk scores until the QRE workshop validates them.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { tip } from '@/components/Tooltip';
import { Badge } from '@/components/ui';
import { CLASS_LABEL, bandsOf, cellOf, explain, riskClass, type RegisterEntry, type RiskClass } from '@/domain/cityRisk';
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';
import { PLAN_STATUS, PLAN_TONE } from './labels';

const CELL: Record<RiskClass, string> = {
  VL: 'bg-emerald-600 text-white', L: 'bg-lime-500 text-slate-900', M: 'bg-amber-400 text-slate-900', H: 'bg-orange-600 text-white', VH: 'bg-red-700 text-white',
};
const CHIP: Record<RiskClass, string> = {
  VL: 'bg-emerald-100 text-emerald-900', L: 'bg-lime-100 text-lime-900', M: 'bg-amber-100 text-amber-900', H: 'bg-orange-100 text-orange-900', VH: 'bg-red-100 text-red-900',
};
const short = (h: string) => h.replace(/\s*\(.*\)\s*/, '').replace(' / wave action', '');
const fmtBand = (b: [number, number]) => `${b[0] === 0.1 ? 0 : b[0]}–${b[1]}`;

export function ClassChip({ band }: { band: string }) {
  const c = riskClass(band);
  return <span className={clsx('inline-flex rounded-control px-2 py-0.5 text-xs font-bold', CHIP[c])}>{band} · {CLASS_LABEL[c]}</span>;
}

/** The matrix, drawn on the City's own bands, with each hazard in the cell its scores put it. */
export function CityRiskPicture({ risks, matrix }: { risks: DdriveCityRisk[]; matrix: DdriveRiskMatrixRow[] }) {
  const [pick, setPick] = useState<string | null>(risks[0]?.hazard_event ?? null);
  const { likelihood, severity } = useMemo(() => bandsOf(matrix), [matrix]);
  const at = (ri: number) => risks.filter((r) => r.ranking === ri);
  const chosen = risks.find((r) => r.hazard_event === pick) ?? risks[0] ?? null;
  const ex = chosen ? explain(chosen, matrix) : null;
  if (!matrix.length) return <p className="text-sm text-muted">The QRE matrix arrives with the DDRiVE reference data.</p>;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
      <div>
        <h3 className="text-base font-extrabold text-ink">City Risk Matrix</h3>
        <p className="mb-3 text-xs text-muted">UNDRR Quick Risk Estimation, as configured by the CDRRMO (Nov 2026). Each hazard sits where its likelihood band meets its severity band. Select one to see why.</p>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <span className="self-center text-[10px] font-bold text-muted [writing-mode:vertical-rl] rotate-180">Likelihood (0–10) →</span>
          <div>
            <div className="grid grid-cols-[3.2rem_repeat(5,minmax(0,1fr))] gap-1" role="table" aria-label="City risk matrix: likelihood bands by severity bands">
              {[...likelihood.keys()].reverse().map((li) => (
                <div key={li} role="row" className="contents">
                  <span role="rowheader" className="self-center text-right font-data text-[10px] font-bold text-muted">{fmtBand(likelihood[li]!)}</span>
                  {severity.map((_, si) => {
                    const cell = cellOf(matrix, li, si);
                    if (!cell) return <span key={si} role="cell" />;
                    const here = at(cell.ranking);
                    return (
                      <div key={si} role="cell" aria-label={`${cell.band}: likelihood ${fmtBand(likelihood[li]!)}, severity ${fmtBand(severity[si]!)}${here.length ? `; ${here.map((h) => h.hazard_event).join(', ')}` : ''}`}
                        className={clsx('flex min-h-[4.25rem] flex-col gap-1 rounded-lg p-1.5', CELL[riskClass(cell.band)], !here.length && 'opacity-70')}>
                        <span className="text-[10px] font-extrabold opacity-90">{cell.band}</span>
                        {here.map((h) => (
                          <button key={h.hazard_event} type="button" onClick={() => setPick(h.hazard_event)} {...tip(`Why ${h.hazard_event} is ${h.band}`)}
                            className={clsx('min-h-[1.75rem] rounded bg-white/90 px-1 text-left text-[10px] font-bold leading-tight text-slate-900 shadow-sm', pick === h.hazard_event && 'ring-2 ring-ink')}>
                            {short(h.hazard_event)}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <span />
              {severity.map((s, si) => <span key={si} className="text-center font-data text-[10px] font-bold text-muted">{fmtBand(s)}</span>)}
            </div>
            <p className="mt-1 text-center text-[10px] font-bold text-muted">Severity (0–100) →</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          {(['VL', 'L', 'M', 'H', 'VH'] as RiskClass[]).map((c) => <li key={c} className="flex items-center gap-1.5"><span className={clsx('inline-block h-3 w-3 rounded-sm', CELL[c])} />{CLASS_LABEL[c]}</li>)}
        </ul>
      </div>

      {chosen && ex && (
        <section aria-label={`Why ${chosen.hazard_event} ranks ${chosen.band}`} className="rounded-panel border border-line bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Why this rank</p>
          <h3 className="mt-1 flex flex-wrap items-center gap-2 text-base font-extrabold text-ink">{chosen.hazard_event} <ClassChip band={chosen.band} /></h3>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          {!ex.consistent && <p className="mt-2 rounded-control bg-warn/10 p-2 text-xs font-semibold text-warn">The stored severity ({ex.severity}) does not equal (likelihood − response) × 10 = {ex.computedSeverity}. Check the row in 14_QRE_Scoring.</p>}
          <h4 className="mt-4 text-xs font-bold text-muted">Exposure and vulnerability (shown beside the rank, not inside it)</h4>
          <div className="mt-1 space-y-1">
            {ex.exposures.map((e) => <Bar key={e.label} label={e.label} value={e.rating} max={10} />)}
            <Bar label="Total vulnerability" value={ex.vulnerability} max={100} strong />
          </div>
          {chosen.evidence_anchor && <p className="mt-3 text-xs leading-relaxed text-muted"><b className="text-ink">Evidence:</b> {chosen.evidence_anchor}</p>}
          <p className="mt-2 text-xs text-muted">{chosen.validation_status ?? 'Desk score'}.</p>
        </section>
      )}
    </div>
  );
}

function Bar({ label, value, max, strong }: { label: string; value: number | null; max: number; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-xs">
      <span className={clsx(strong ? 'font-extrabold text-ink' : 'font-semibold text-muted')}>{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${label}: ${value ?? 'not rated'} of ${max}`}>
        {value != null && <span className={clsx('block h-full rounded-full', strong ? 'bg-ink' : 'bg-sky')} style={{ width: `${(100 * value) / max}%` }} />}
      </span>
      <span className="text-right font-data">{value ?? '—'}</span>
    </div>
  );
}

/** How to read the matrix, and how it fits the Ten-Year Plan's damages chart beside it. */
export function HowToRead({ entries }: { entries: RegisterEntry[] }) {
  const top = entries[0];
  const sleeper = entries.filter((e) => e.damagesBn != null && (e.explanation.cls === 'VL' || e.explanation.cls === 'L'))
    .sort((a, b) => (b.damagesBn ?? 0) - (a.damagesBn ?? 0))[0];
  return (
    <section aria-label="How to read the City Risk Picture" className="mt-5 rounded-panel border border-line bg-sunken/40 p-4 text-sm leading-relaxed">
      <h3 className="text-base font-extrabold text-ink">How to read the City Risk Picture</h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li><b>Likelihood (0–10)</b> is how often the hazard has struck Ormoc (record 1991–2022): very high means three or more times in five years; very low means none on record.</li>
        <li><b>Response measures (0–10)</b> rate what the City already has in place: warning, plans, structures, stocks, trained people.</li>
        <li><b>Severity = (likelihood − response measures) × 10.</b> It is the part of the hazard the City's measures do not yet cover. A frequent hazard with weak measures scores high; better measures pull it down.</li>
        <li><b>The rank</b> is the cell where the severity band meets the likelihood band: VL1–VL2 very low, L3–L4 low, M5–M6 moderate, H7–H8 high, VH9 very high.</li>
        <li><b>Vulnerability</b> (the four exposure ratings averaged) is shown beside the rank, not inside it. It says how much is in harm's way if the hazard comes.</li>
      </ol>
      <p className="mt-3"><b>Reading it with the Ten-Year Plan's damages chart below.</b> The damages chart answers "how much could we lose if it happens"; the matrix answers "how likely is it, and how much of it are we not yet ready for".
        {top && <> {top.risk.hazard_event} leads both: it is near-annual and only {top.explanation.response ?? '?'} of 10 in measures.</>}
        {sleeper && <> {sleeper.risk.hazard_event} could cost about ₱{sleeper.damagesBn}B yet ranks {sleeper.risk.band}: it is rare in the record (likelihood {sleeper.risk.likelihood}). Rare is not safe: keep its warning and evacuation routes in the plans.</>}
      </p>
      <p className="mt-2 text-xs text-muted">Desk scores from the DDRiVE workbook (9 Nov 2026), pending the QRE workshop. They guide attention and the PDRA. They are not warning, evacuation or activation triggers.</p>
    </section>
  );
}

/** One row per scored hazard, joined to its barangays, contingency plans and the Plan's damages. */
export function RiskRegister({ entries }: { entries: RegisterEntry[] }) {
  const [cls, setCls] = useState<RiskClass | 'all'>('all');
  const shown = entries.filter((e) => cls === 'all' || e.explanation.cls === cls);
  const present = [...new Set(entries.map((e) => e.explanation.cls))];
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Each scored hazard with its rank and reasoning, where it lands by barangay, the contingency plan that covers it, and what would lower it. Highest rank first.</p>
      <div role="radiogroup" aria-label="Risk class" className="mb-3 flex flex-wrap gap-2">
        {(['all', 'VH', 'H', 'M', 'L', 'VL'] as const).filter((c) => c === 'all' || present.includes(c)).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cls === c} onClick={() => setCls(c)} {...tip(c === 'all' ? 'Every scored hazard' : `Only ${CLASS_LABEL[c].toLowerCase()} risks`)}
            className={clsx('min-h-tap rounded-full border px-3 text-sm font-semibold', cls === c ? 'border-action bg-sky-soft text-ink ring-1 ring-action' : 'border-line bg-surface text-muted')}>
            {c === 'all' ? `All · ${entries.length}` : `${CLASS_LABEL[c]} · ${entries.filter((e) => e.explanation.cls === c).length}`}
          </button>
        ))}
      </div>
      <ol className="space-y-3">
        {shown.map((e) => {
          const r = e.risk; const ex = e.explanation;
          return (
            <li key={r.hazard_event} className="rounded-panel border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-data text-xs text-muted">R-{String(entries.indexOf(e) + 1).padStart(2, '0')}</span>
                <h3 className="text-base font-extrabold text-ink">{r.hazard_event}</h3>
                <ClassChip band={r.band} />
                <span className="text-xs text-muted">{r.hazard_family}</span>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-bold text-muted">Score</p>
                  <p className="font-data text-sm">L {ex.likelihood} · R {ex.response ?? '—'} · S {ex.severity} · cell {ex.ranking}/25</p>
                  <div className="mt-1"><Bar label="Vulnerability" value={ex.vulnerability} max={100} /></div>
                  <p className="mt-1 text-xs text-muted">{e.lowers}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted">Where it lands</p>
                  {!e.barangays ? <p className="text-sm text-muted">No barangay layer for this hazard yet.</p>
                    : e.barangays.citywide ? <p className="text-sm">All {e.barangays.flagged} barangays{e.barangays.population ? ` · ${e.barangays.population.toLocaleString('en-PH')} people (2024)` : ''}</p>
                    : <>
                      <p className="text-sm"><b>{e.barangays.flagged}</b> barangays flagged{e.barangays.population ? ` · ${e.barangays.population.toLocaleString('en-PH')} people (2024)` : ''}</p>
                      {e.barangays.notAssessed > 0 && <p className="text-xs text-warn">{e.barangays.notAssessed} not yet assessed (not "safe")</p>}
                      {e.barangays.names.length > 0 && <p className="mt-1 text-xs text-muted">{e.barangays.names.slice(0, 8).join(', ')}{e.barangays.names.length > 8 ? ` and ${e.barangays.names.length - 8} more` : ''}</p>}
                    </>}
                  {e.damagesBn != null && <p className="mt-1 text-xs text-muted">Plan damages estimate: ₱{e.damagesBn}B</p>}
                </div>
                <div>
                  <p className="text-xs font-bold text-muted">Covered by</p>
                  {e.plans.length === 0 ? <p className="text-sm text-warn">No contingency plan linked</p>
                    : <ul className="space-y-1">{e.plans.map((p) => <li key={p.code} className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-data text-xs">{p.code}</span><Badge tone={PLAN_TONE[p.status]}>{PLAN_STATUS[p.status]}</Badge></li>)}</ul>}
                  {e.trigger && <p className="mt-1 text-xs text-muted">Usually set off by: {e.trigger.toLowerCase()}.</p>}
                </div>
              </div>
              {r.evidence_anchor && <p className="mt-3 border-t border-line pt-2 text-xs leading-relaxed text-muted"><b className="text-ink">Evidence:</b> {r.evidence_anchor} · {r.validation_status ?? 'Desk score'}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
