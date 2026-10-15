import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canOperate, currentLevel } from '@/domain/eoc';
import { relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, EmptyState, Field, Input, List, ListRow, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
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
  const [form, setForm] = useState({ condition: 'monitoring' as BarangayCondition, families: '0', persons: '0', remarks: '', channel: 'radio' });
  const data = useLiveQuery(async () => {
    const brgys = await db.barangays.orderBy('name').toArray();
    const reports = await db.barangay_reports.orderBy('reported_at').reverse().toArray();
    const latest = new Map<string, BarangayReport>();
    for (const r of reports) if (!latest.has(r.barangay_psgc)) latest.set(r.barangay_psgc, r);
    return { brgys, latest };
  }, []);
  const list = useMemo(() => (data?.brgys ?? []).filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
    .filter((b) => show === 'all' || (data!.latest.get(b.psgc) && data!.latest.get(b.psgc)!.condition !== 'normal')), [data, q, show]);

  const report = async () => {
    if (!target) return;
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const r: BarangayReport & { _new: true } = { _new: true, id: uuid(), barangay_psgc: target.psgc, activation_id: activation?.id ?? null, reported_at: new Date().toISOString(),
      condition: form.condition, families_evacuated: Number(form.families) || 0, persons_evacuated: Number(form.persons) || 0, remarks: form.remarks.trim() || null,
      channel: form.channel, created_at: new Date().toISOString() };
    await save('barangay_reports', r, `Status report: ${target.name}`);
    setTarget(null); setForm({ ...form, remarks: '' }); toast(`${target.name}: ${CONDITION[r.condition].toLowerCase()}`);
  };

  return (
    <div className="page">
      <PageHeader title="Barangay status" subtitle="Latest report per barangay. Counts only: no names of evacuees." />
      <Tabs items={EOC_TABS} />
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
              return <ListRow key={b.psgc} onClick={canOperate(roles) ? () => setTarget(b) : undefined} title={b.name}
                meta={r ? `${relative(r.reported_at)}${r.persons_evacuated ? `, ${r.families_evacuated} families / ${r.persons_evacuated} persons evacuated` : ''}${r.remarks ? `. ${r.remarks}` : ''}` : 'No report'}
                trailing={r ? <Badge tone={CONDITION_TONE[r.condition]}>{CONDITION[r.condition]}</Badge> : undefined} />;
            })}
          </List>
        </>
      )}
      <Sheet open={!!target} onClose={() => setTarget(null)} title={`Report: ${target?.name ?? ''}`}
        footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button onClick={report}>Record report</Button></>}>
        <ChoiceGroup legend="Condition" value={form.condition} onChange={(v) => setForm({ ...form, condition: v })} columns={2}
          options={(Object.keys(CONDITION) as BarangayCondition[]).map((c) => ({ value: c, label: CONDITION[c] }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Families evacuated">{(id) => <Input id={id} type="number" min={0} inputMode="numeric" value={form.families} onChange={(e) => setForm({ ...form, families: e.target.value })} />}</Field>
          <Field label="Persons evacuated">{(id) => <Input id={id} type="number" min={0} inputMode="numeric" value={form.persons} onChange={(e) => setForm({ ...form, persons: e.target.value })} />}</Field>
        </div>
        <Field label="Received by">{(id) => <Select id={id} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          <option value="radio">Radio</option><option value="sms">SMS</option><option value="call">Phone call</option><option value="app">This app</option><option value="in_person">In person</option></Select>}</Field>
        <Field label="Remarks" optional>{(id) => <Textarea id={id} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />}</Field>
      </Sheet>
    </div>
  );
}
