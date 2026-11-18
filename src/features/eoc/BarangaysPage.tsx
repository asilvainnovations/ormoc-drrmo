// Barangay status as a picture (1.25.0): all 85 barangays as tiles coloured by their latest report, grouped by cluster
// (this screen replaces the separate Liaison desk). Tap a tile, tap the condition, count evacuees, done.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { barangayReportProblem, canOperate, currentLevel, parseCount } from '@/domain/eoc';
import { getBarangayFloodExposure } from '@/domain/floodExposure';
import { fmtDateTime, relative } from '@/lib/time';
import { Badge, Button, EmptyState, Field, Input, Notice, PageHeader, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { BarangayCondition, BarangayReport } from '@/types';
import { COND_LABEL, COND_ORDER, COND_STYLE, Chips, Legend, Stepper, type Cond } from './kit';
import { BarangayGrid } from './BarangayPicture';
import { useBarangayPicture, type PictureRow } from './useBarangayPicture';
import { EOC_TABS } from './labels';

const CHANNELS = [{ value: 'radio', label: 'Radio' }, { value: 'sms', label: 'SMS' }, { value: 'call', label: 'Call' }, { value: 'app', label: 'This app' }, { value: 'in_person', label: 'In person' }];
const CONDITIONS: BarangayCondition[] = ['normal', 'monitoring', 'affected', 'evacuating', 'isolated'];
const blank = (channel: string) => ({ condition: 'monitoring' as BarangayCondition, families: '', persons: '', remarks: '', channel });

export function BarangaysPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const pic = useBarangayPicture();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Cond | null>(null);
  const [target, setTarget] = useState<PictureRow | null>(null);
  const [form, setForm] = useState(blank('radio'));
  const [problem, setProblem] = useState<string | null>(null);
  const operator = canOperate(roles);

  // Deep link from the Board: /eoc/barangays?b=<psgc> opens that barangay's report.
  const wanted = params.get('b');
  useEffect(() => {
    if (!wanted || !pic || !operator) return;
    const row = pic.rows.find((r) => r.b.psgc === wanted);
    if (row) { open(row); setParams({}, { replace: true }); }
  }, [wanted, pic?.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (r: PictureRow) => {
    setForm({ ...blank(form.channel), condition: r.report && r.cond !== 'silent' ? r.report.condition : 'monitoring' });
    setProblem(null); setTarget(r);
  };
  const rows = useMemo(() => (pic?.rows ?? []).filter((r) => r.b.name.toLowerCase().includes(q.toLowerCase())).filter((r) => !filter || r.cond === filter), [pic, q, filter]);

  const record = async () => {
    if (!target) return;
    const p = barangayReportProblem(form);
    if (p) { setProblem(p); return; }
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const count = (v: string) => { const n = parseCount(v); return typeof n === 'number' ? n : null; };
    const r: BarangayReport & { _new: true } = { _new: true, id: uuid(), barangay_psgc: target.b.psgc, activation_id: activation?.id ?? null, reported_at: new Date().toISOString(),
      condition: form.condition, families_evacuated: count(form.families), persons_evacuated: count(form.persons), remarks: form.remarks.trim() || null, channel: form.channel, created_at: new Date().toISOString() };
    await save('barangay_reports', r, `Status report: ${target.b.name}`);
    setTarget(null); toast(`${target.b.name}: ${COND_LABEL[r.condition].toLowerCase()}`);
  };

  const silentPriority = (pic?.rows ?? []).filter((r) => r.cond === 'silent' && r.priority != null).sort((a, b) => a.priority! - b.priority!).slice(0, 6);
  const num = (s: string) => Number(s) || 0;

  return (
    <div className="page">
      <PageHeader title="Barangays" subtitle={pic ? (pic.window.kind === 'event' ? `Latest report per barangay since this activation began, ${fmtDateTime(pic.window.from)}.` : 'White level: latest report per barangay in the last 24 hours.') : ''} />
      <Tabs items={EOC_TABS} />
      {pic && pic.rows.length === 0 ? <EmptyState title="No barangays loaded" body="An administrator imports the barangay list (PSGC code and name) in Settings." /> : pic && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="group" aria-label="Filter by condition" className="flex flex-wrap gap-2">
              {COND_ORDER.map((c) => (
                <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(filter === c ? null : c)}
                  className={clsx('flex min-h-tap items-center gap-2 rounded-full border px-3 text-sm font-bold', filter === c ? 'border-ink ring-2 ring-ink' : 'border-line', 'bg-surface')}>
                  <span className={clsx('inline-block h-3.5 w-3.5 rounded-sm border', COND_STYLE[c])} />{COND_LABEL[c]}<span className="font-data">{pic.counts[c]}</span>
                </button>
              ))}
            </div>
            <Field label="Find a barangay">{(id) => <Input id={id} type="search" className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          {silentPriority.length > 0 && pic.activation && (
            <Notice tone="warn" title="High-risk barangays still silent">
              {silentPriority.map((r) => `${r.b.name} (#${r.priority})`).join(', ')}. Call these first; the number is the DDRiVE priority rank.
            </Notice>
          )}
          <BarangayGrid rows={rows} groupByCluster onPick={operator ? open : undefined} />
          {rows.length === 0 && <p className="py-6 text-center text-muted">No barangay matches.</p>}
          {!operator && <p className="mt-4 text-sm text-muted">Reports are recorded by the EOC duty team.</p>}
          <div className="mt-6"><Legend /></div>
        </>
      )}

      <Sheet open={!!target} onClose={() => setTarget(null)} title={target ? `${target.b.name}${target.cluster ? ` · ${target.cluster.code}` : ''}` : ''}
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button tip="Save this report. It works offline and sends when you reconnect" onClick={record}>Record report</Button></>}>
        {target && (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              {target.report ? `Last report ${relative(target.report.reported_at)}: ${COND_LABEL[target.cond].toLowerCase()}.` : 'No report yet in this period.'}
              {(() => { const f = getBarangayFloodExposure(target.b.psgc); return f ? ` Flood-prone: ${f.pronePopulation.toLocaleString('en-PH')} of ${f.denominator.toLocaleString('en-PH')} people.` : ''; })()}
              {target.priority != null && <Badge tone="info" className="ml-2">DDRiVE #{target.priority}</Badge>}
            </p>
            {problem && <Notice tone="bad">{problem}</Notice>}
            <div>
              <p className="mb-2 text-sm font-bold">Condition</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CONDITIONS.map((c) => (
                  <button key={c} type="button" aria-pressed={form.condition === c} onClick={() => { setForm({ ...form, condition: c, ...(c === 'evacuating' && form.persons === '' ? { families: '0', persons: '0' } : {}) }); setProblem(null); }}
                    className={clsx('min-h-[3.25rem] rounded-control border text-sm font-extrabold', COND_STYLE[c], form.condition === c ? 'ring-4 ring-ink/70' : 'opacity-80')}>{COND_LABEL[c]}</button>
                ))}
              </div>
            </div>
            {form.condition === 'evacuating' && (
              <div className="space-y-3">
                <div><p className="mb-1 text-sm font-bold">Families evacuated</p><Stepper label="families evacuated" value={num(form.families)} onChange={(n) => setForm({ ...form, families: String(n) })} jumps={[1, 5, 10, 50]} /></div>
                <div><p className="mb-1 text-sm font-bold">Persons evacuated</p><Stepper label="persons evacuated" value={num(form.persons)} onChange={(n) => setForm({ ...form, persons: String(n) })} jumps={[1, 5, 10, 50]} /></div>
                <button type="button" className="text-sm font-semibold text-info underline" onClick={() => setForm({ ...form, families: '', persons: '' })}>Counts not reported yet</button>
              </div>
            )}
            <div><p className="mb-2 text-sm font-bold">Received by</p><Chips label="Received by" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS} /></div>
            <Field label="Remarks" optional>{(id) => <Textarea id={id} rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />}</Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
