// What the page knows about one barangay's flood picture: DDRiVE class and exposure, the City's source report where one
// exists, and the latest barangay report. Reference data, not a forecast.
import { Link } from 'react-router-dom';
import { Badge, Notice, Select } from '@/components/ui';
import { CLASS_STYLE } from '@/features/eoc/map/themes';
import { COND_LABEL, COND_STYLE } from '@/features/eoc/kit';
import { useBarangayPicture } from '@/features/eoc/useBarangayPicture';
import { getBarangayFloodExposure } from '@/domain/floodExposure';
import type { FloodRow } from '@/domain/floodScreen';
import type { DdriveFlood } from '@/types';
import clsx from 'clsx';

const n = (v: number | null | undefined) => (v == null ? 'Not reported' : v.toLocaleString('en-PH'));

export function BarangayPanel({ rows, flood, selected, onSelect }: { rows: FloodRow[]; flood: Map<string, DdriveFlood>; selected: string | null; onSelect: (psgc: string | null) => void }) {
  const pic = useBarangayPicture();
  const row = rows.find((r) => r.psgc === selected) ?? null;
  const picker = (
    <label className="block text-sm font-semibold">Barangay
      <Select className="mt-1" value={selected ?? ''} onChange={(e) => onSelect(e.target.value || null)} aria-label="Barangay">
        <option value="">Choose a barangay, or click the map</option>
        {rows.map((r) => <option key={r.psgc} value={r.psgc}>{r.name}</option>)}
      </Select>
    </label>
  );
  if (!row) return <div className="space-y-3 rounded-control border border-line bg-surface p-4">{picker}<p className="text-sm text-muted">Click a barangay to see its flood class, how many people live in flood-prone area, and whether it has reported.</p></div>;

  const f = flood.get(row.psgc);
  const src = getBarangayFloodExposure(row.psgc);
  const rep = pic?.rows.find((p) => p.b.psgc === row.psgc);
  return (
    <div className="space-y-3 rounded-control border border-line bg-surface p-4">
      {picker}
      <div className="flex items-center gap-2">
        <h3 className="font-display text-xl font-extrabold">{row.name}</h3>
        <span className="rounded-full px-3 py-0.5 text-xs font-extrabold text-black" style={{ background: CLASS_STYLE[row.cls]?.color }}>{row.cls}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div><dt className="text-xs text-muted">People in flood-prone area</dt><dd className="font-bold tabular-nums">{n(row.exposedPop)}</dd></div>
        <div><dt className="text-xs text-muted">Share of barangay</dt><dd className="font-bold tabular-nums">{row.exposurePct == null ? 'Not reported' : `${row.exposurePct.toFixed(1)}%`}</dd></div>
        <div><dt className="text-xs text-muted">Population, 2024</dt><dd className="font-bold tabular-nums">{n(row.pop2024)}</dd></div>
        <div><dt className="text-xs text-muted">Proposed priority rank</dt><dd className="font-bold tabular-nums">{row.priority ?? 'Not ranked'}</dd></div>
        {f?.prone_pct != null && <div><dt className="text-xs text-muted">Land area flood-prone</dt><dd className="font-bold tabular-nums">{f.prone_pct.toFixed(1)}%</dd></div>}
        {f?.validation_status && <div><dt className="text-xs text-muted">Validation</dt><dd className="font-bold">{f.validation_status}</dd></div>}
      </dl>
      {f?.hazard_source && <p className="text-xs text-muted">Source: {f.hazard_source}</p>}
      {rep && <div className={clsx('flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm font-bold', COND_STYLE[rep.cond])}>
        <span>Barangay report: {COND_LABEL[rep.cond]}</span><Link className="underline" to={`/eoc/barangays?b=${row.psgc}`}>Open</Link></div>}
      {src && <details className="rounded-control border border-line bg-sunken p-3 text-sm">
        <summary className="cursor-pointer font-semibold">City source report</summary>
        <p className="mt-2 text-xs text-muted">{src.source}. Base {src.denominator.toLocaleString('en-PH')} people (2020 CPH reference), kept apart from the 2024 population.</p>
        <div className="mt-2 flex flex-wrap gap-1">{src.classes.map((c) => <Badge key={c.name}>{c.name}: {c.population.toLocaleString('en-PH')}</Badge>)}</div>
        {src.ageSexStatus === 'available' && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[26rem] text-xs">
          <thead className="text-left text-muted"><tr><th className="py-1">Age</th><th className="text-right">Male prone</th><th className="text-right">Female prone</th></tr></thead>
          <tbody>{src.ageSex.map((a) => <tr key={a.ageGroup} className="border-t border-line"><td className="py-1">{a.ageGroup}</td><td className="text-right tabular-nums">{n(a.maleProne)}</td><td className="text-right tabular-nums">{n(a.femaleProne)}</td></tr>)}</tbody></table></div>}
        {src.ageSexStatus !== 'available' && <Notice tone="info" title="Age and sex table">The uploaded file was not a valid workbook, so no age and sex table is shown or inferred. Class and exposure figures come from the DDRiVE source record.</Notice>}
      </details>}
    </div>
  );
}
