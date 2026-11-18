// Planning screen: compare flood measures by benefit-cost ratio from figures the planner types in. Nothing is pre-filled
// with a cost or benefit; "Load example numbers" fills clearly labelled illustrative values so the screen can be tried.
// It ranks options. It is not an appraisal and does not replace CPDO, City Engineer or DPWH estimates.
import { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { Badge, Button, Input, Notice, Select } from '@/components/ui';
import { Block } from '@/features/eoc/kit';
import { MEASURE_TYPE, leadStrategy, missingAssumptions, screenAll, type Assumptions, type Measure, type MeasureType } from '@/domain/floodScreen';

interface Draft { id: string; name: string; type: MeasureType; capital: string; reduction: string; economic: string; social: string }
const blank = (name: string, type: MeasureType): Draft => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, type, capital: '', reduction: '', economic: '', social: '' });
const START: Draft[] = [blank('Wetland restoration', 'nbs'), blank('Riparian buffer', 'nbs'), blank('Green infrastructure', 'nbs'), blank('Detention basin', 'hybrid'),
  blank('Drainage upgrade', 'grey'), blank('Pump station', 'grey'), blank('Dike or revetment', 'grey')];
const EXAMPLE: Record<string, [string, string, string, string]> = {
  'wetland-restoration': ['40', '15', '2', '3'], 'riparian-buffer': ['25', '12', '1', '2'], 'green-infrastructure': ['60', '18', '2', '3'],
  'detention-basin': ['90', '30', '1', '1'], 'drainage-upgrade': ['120', '35', '0', '0'], 'pump-station': ['150', '30', '0', '0'], 'dike-or-revetment': ['200', '40', '0', '0'],
};
const EXAMPLE_A = { assets: '500', damage: '30', events: '1', horizon: '30', discount: '5', om: '3' };
const f = (s: string) => { const v = Number(s); return Number.isFinite(v) && v > 0 ? v : 0; };
const peso = (v: number) => `₱${v.toLocaleString('en-PH', { maximumFractionDigits: 1 })}M`;
const TONE: Record<MeasureType, string> = { nbs: 'bg-ok', hybrid: 'bg-sky', grey: 'bg-muted' };

function Num({ label, value, onChange, suffix, wide }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; wide?: boolean }) {
  return (
    <label className={clsx('block text-xs font-semibold text-muted', wide && 'col-span-2')}>{label}
      <span className="mt-1 flex items-center gap-1"><Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-10 text-ink" />{suffix && <span className="text-xs">{suffix}</span>}</span>
    </label>
  );
}

export function PlanTab() {
  const [a, setA] = useState({ assets: '', damage: '', events: '', horizon: '30', discount: '5', om: '3' });
  const [ms, setMs] = useState<Draft[]>(START);
  const setM = (id: string, p: Partial<Draft>) => setMs((cur) => cur.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const as: Assumptions = useMemo(() => ({ assets: f(a.assets), damage: f(a.damage) / 100, events: f(a.events), horizon: f(a.horizon), discount: f(a.discount) / 100, om: f(a.om) / 100 }), [a]);
  const measures: Measure[] = useMemo(() => ms.map((m) => ({ id: m.id, name: m.name, type: m.type, capital: f(m.capital), reduction: Math.min(1, f(m.reduction) / 100), economic: f(m.economic), social: f(m.social) })), [ms]);
  const res = useMemo(() => screenAll(as, measures), [as, measures]);
  const lead = leadStrategy(res);
  const missing = missingAssumptions(as);
  const top = Math.max(1, ...res.map((r) => r.bcr ?? 0));

  function example() {
    setA(EXAMPLE_A);
    setMs((cur) => cur.map((m) => { const e = EXAMPLE[m.id]; return e ? { ...m, capital: e[0], reduction: e[1], economic: e[2], social: e[3] } : m; }));
  }
  return (
    <div className="space-y-4">
      <Notice tone="warn" title="A screen, not an appraisal">Enter figures from CPDO, the City Engineer, DPWH or your own estimate. The screen ranks the options by benefit-cost ratio and shows the sum behind each. It ships with no costs of its own.</Notice>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Fill the assumptions, then the cost and effect of each measure you want to compare.</p>
        <Button variant="secondary" icon={Wand2} tip="Fill illustrative numbers so you can see how the screen works. They are not sourced: replace them." onClick={example}>Load example numbers</Button>
      </div>
      <Block title="Assumptions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Num label="Assets exposed" suffix="₱M" value={a.assets} onChange={(v) => setA({ ...a, assets: v })} />
          <Num label="Damage per event" suffix="%" value={a.damage} onChange={(v) => setA({ ...a, damage: v })} />
          <Num label="Flood events a year" value={a.events} onChange={(v) => setA({ ...a, events: v })} />
          <Num label="Years assessed" value={a.horizon} onChange={(v) => setA({ ...a, horizon: v })} />
          <Num label="Discount rate" suffix="%" value={a.discount} onChange={(v) => setA({ ...a, discount: v })} />
          <Num label="Upkeep a year" suffix="% of cost" value={a.om} onChange={(v) => setA({ ...a, om: v })} />
        </div>
      </Block>
      <Block title="Measures" action={<Button variant="quiet" icon={Plus} tip="Add a measure to compare" onClick={() => setMs((c) => [...c, { ...blank('New measure', 'hybrid'), id: `m${c.length + 1}-${Date.now()}` }])}>Add</Button>}>
        <div className="space-y-3">
          {ms.map((m) => (
            <div key={m.id} className="grid grid-cols-2 items-end gap-2 rounded-control border border-line p-3 sm:grid-cols-4 lg:grid-cols-[1.4fr_8rem_repeat(4,1fr)_auto]">
              <label className="col-span-2 block text-xs font-semibold text-muted sm:col-span-4 lg:col-span-1">Measure<Input aria-label="Measure name" className="mt-1 h-10 text-ink" value={m.name} onChange={(e) => setM(m.id, { name: e.target.value })} /></label>
              <label className="block text-xs font-semibold text-muted">Kind<Select aria-label={`${m.name} kind`} className="mt-1 h-10 text-ink" value={m.type} onChange={(e) => setM(m.id, { type: e.target.value as MeasureType })}>
                {(Object.keys(MEASURE_TYPE) as MeasureType[]).map((t) => <option key={t} value={t}>{MEASURE_TYPE[t]}</option>)}</Select></label>
              <Num label="Cost ₱M" value={m.capital} onChange={(v) => setM(m.id, { capital: v })} />
              <Num label="Damage prevented %" value={m.reduction} onChange={(v) => setM(m.id, { reduction: v })} />
              <Num label="Economic ₱M/yr" value={m.economic} onChange={(v) => setM(m.id, { economic: v })} />
              <Num label="Social and environmental ₱M/yr" value={m.social} onChange={(v) => setM(m.id, { social: v })} />
              <Button variant="quiet" icon={Trash2} tip={`Remove ${m.name}`} aria-label={`Remove ${m.name}`} onClick={() => setMs((c) => c.filter((x) => x.id !== m.id))} />
            </div>))}
        </div>
      </Block>
      <Block title="Result">
        {missing.length > 0 && <p className="text-sm text-muted">Still needed: {missing.join(', ')}.</p>}
        {missing.length === 0 && !res.length && <p className="text-sm text-muted">Enter a cost for at least one measure.</p>}
        {res.length > 0 && missing.length === 0 && <div className="space-y-4">
          {lead && <p className="text-sm">Top three by benefit-cost ratio lean <Badge tone={lead.key === 'grey' ? 'neutral' : 'ok'}>{lead.label}</Badge></p>}
          <ul className="space-y-2">{res.map((r) => (
            <li key={r.measure.id} className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-sm">
              <span className="truncate font-semibold" title={r.measure.name}>{r.measure.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-sunken"><span className={clsx('block h-full rounded-full', TONE[r.measure.type])} style={{ width: `${Math.max(2, ((r.bcr ?? 0) / top) * 100)}%` }} /></span>
              <span className="text-right font-bold tabular-nums">{r.bcr == null ? '—' : `${r.bcr.toFixed(1)} : 1`}</span>
            </li>))}</ul>
          <div className="overflow-x-auto rounded-control border border-line">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-sunken text-left"><tr><th className="p-2">Measure</th><th className="p-2 text-right">Cost (with upkeep)</th><th className="p-2 text-right">Avoided losses</th><th className="p-2 text-right">Economic</th><th className="p-2 text-right">Social, environmental</th><th className="p-2 text-right">Net value</th></tr></thead>
              <tbody>{res.map((r) => <tr key={r.measure.id} className="border-t border-line"><td className="p-2 font-semibold">{r.measure.name}<span className="block text-xs font-normal text-muted">{MEASURE_TYPE[r.measure.type]}</span></td>
                <td className="p-2 text-right tabular-nums">{peso(r.cost)}</td><td className="p-2 text-right tabular-nums">{peso(r.avoided)}</td><td className="p-2 text-right tabular-nums">{peso(r.economic)}</td>
                <td className="p-2 text-right tabular-nums">{peso(r.social)}</td><td className={clsx('p-2 text-right font-bold tabular-nums', r.npv < 0 && 'text-bad')}>{peso(r.npv)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Present values over the years assessed at the discount rate. Avoided losses = assets × damage per event × events a year × damage prevented. Cost = capital + yearly upkeep. Ratio = all benefits ÷ cost.</p>
        </div>}
      </Block>
    </div>
  );
}
