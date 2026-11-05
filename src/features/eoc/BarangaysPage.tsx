import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { barangayReportProblem, canOperate, currentLevel, currentReportWindow, latestPerBarangay, parseCount } from '@/domain/eoc';
import { fmtDateTime, relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, EmptyState, Field, Input, List, ListRow, Notice, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { Barangay, BarangayCondition, BarangayReport } from '@/types';
import { CONDITION, CONDITION_TONE, EOC_TABS } from './labels';

export function BarangaysPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'reporting'>('all');
  const [target, setTarget] = useState<Barangay | null>(null);
  const [form, setForm] = useState(blankForm('radio'));
  const [problem, setProblem] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const brgys = await db.barangays.orderBy('name').toArray();
    // Only reports from the current event (or the last 24 hours at White level) count (#16).
    const window = currentReportWindow(await db.eoc_activations.toArray());
    const latest = new Map<string, BarangayReport>(latestPerBarangay(await db.barangay_reports.toArray(), window).map((r) => [r.barangay_psgc, r]));
    return { brgys, latest, window };
  }, []);

  /** Each report starts from a blank form: nothing is carried over from the previous barangay (#17). */
  const openFor = (b: Barangay) => { setForm(blankForm(form.channel)); setProblem(null); setTarget(b); };
  const list = useMemo(() => (data?.brgys ?? []).filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
    .filter((b) => show === 'all' || (data!.latest.get(b.psgc) && data!.latest.get(b.psgc)!.condition !== 'normal')), [data, q, show]);

  const report = async () => {
    if (!target) return;
    const p = barangayReportProblem(form);
    if (p) { setProblem(p); return; }
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const count = (v: string) => { const n = parseCount(v); return typeof n === 'number' ? n : null; };
    const r: BarangayReport & { _new: true } = { _new: true, id: uuid(), barangay_psgc: target.psgc, activation_id: activation?.id ?? null, reported_at: new Date().toISOString(),
      condition: form.condition, families_evacuated: count(form.families), persons_evacuated: count(form.persons), remarks: form.remarks.trim() || null,
      channel: form.channel, created_at: new Date().toISOString() };
    await save('barangay_reports', r, `Status report: ${target.name}`);
    setTarget(null); toast(`Recorded ${target.name}: ${CONDITION[r.condition].toLowerCase()}`);
  };

  return (
    <div className="page">
      <PageHeader title="Barangay Status" subtitle="Latest report per barangay. Counts only: no names of evacuees." />
      <Tabs items={EOC_TABS} />
      {data && data.brgys.length > 0 && (
        <Notice tone="info">{data.window.kind === 'event'
          ? `Showing reports since this activation began, ${fmtDateTime(data.window.from)}. Earlier events are not counted.`
          : 'White level: showing reports from the last 24 hours.'}</Notice>
      )}
      {data && data.brgys.length === 0 ? (
        <EmptyState title="No barangays loaded" body="An administrator imports the barangay list (PSGC code and name) in Settings, then duty officers can record reports here." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
            <Field label="Find a barangay">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
            <Field label="Show">{(id) => <Select id={id} value={show} onChange={(e) => setShow(e.target.value as 'all' | 'reporting')}>
              <option value="all">All barangays</option><option value="reporting">Reporting a condition</option></Select>}</Field>
          </div>
          <List>
            {list.map((b) => {
              const r = data!.latest.get(b.psgc);
              return <ListRow tip={canOperate(roles) ? `Record a new status report for ${b.name}` : undefined} key={b.psgc} onClick={canOperate(roles) ? () => openFor(b) : undefined} title={b.name}
                meta={r ? `${relative(r.reported_at)}${evacText(r)}${r.remarks ? `. ${r.remarks}` : ''}` : 'No report in this period'}
                trailing={r ? <Badge tone={CONDITION_TONE[r.condition]}>{CONDITION[r.condition]}</Badge> : undefined} />;
            })}
          </List>
        </>
      )}
      <Sheet open={!!target} onClose={() => setTarget(null)} title={`Report: ${target?.name ?? ''}`}
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button tip="Save this report. It works offline and sends when you reconnect" onClick={report}>Record report</Button></>}>
        {problem && <Notice tone="bad">{problem}</Notice>}
        <ChoiceGroup legend="Condition" value={form.condition} onChange={(v) => { setForm({ ...form, condition: v }); setProblem(null); }} columns={2}
          options={(Object.keys(CONDITION) as BarangayCondition[]).map((c) => ({ value: c, label: CONDITION[c] }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Families evacuated" optional={form.condition !== 'evacuating'} hint="Leave blank if not reported">{(id) => <Input id={id} type="number" min={0} step={1} inputMode="numeric" value={form.families} onChange={(e) => { setForm({ ...form, families: e.target.value }); setProblem(null); }} />}</Field>
          <Field label="Persons evacuated" optional={form.condition !== 'evacuating'} hint="Leave blank if not reported">{(id) => <Input id={id} type="number" min={0} step={1} inputMode="numeric" value={form.persons} onChange={(e) => { setForm({ ...form, persons: e.target.value }); setProblem(null); }} />}</Field>
        </div>
        <Field label="Received by">{(id) => <Select id={id} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          <option value="radio">Radio</option><option value="sms">SMS</option><option value="call">Phone call</option><option value="app">This app</option><option value="in_person">In person</option></Select>}</Field>
        <Field label="Remarks" optional>{(id) => <Textarea id={id} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />}</Field>
      </Sheet>
    </div>
  );
}

const blankForm = (channel: string) => ({ condition: 'monitoring' as BarangayCondition, families: '', persons: '', remarks: '', channel });

function evacText(r: BarangayReport): string {
  if (r.families_evacuated === null && r.persons_evacuated === null) return r.condition === 'normal' ? '' : ', evacuation counts not reported';
  if (!r.families_evacuated && !r.persons_evacuated) return '';
  return `, ${r.families_evacuated ?? 'not reported'} families / ${r.persons_evacuated ?? 'not reported'} persons evacuated`;
}
