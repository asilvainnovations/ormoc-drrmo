import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canChangeLevel, canOperate, currentLevel } from '@/domain/eoc';
import { fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { Badge, Button, EmptyState, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Tabs, Textarea } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { BarangayReport, Sitrep } from '@/types';
import { EOC_TABS, SITREP_STATUS } from './labels';

export function SitrepsPage() {
  const { roles } = useAuth();
  const nav = useNavigate();
  const rows = useLiveQuery(() => db.sitreps.orderBy('period_end').reverse().toArray(), [], []);
  const create = async () => {
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const last = rows[0];
    const s: Sitrep & { _new: true } = { _new: true, id: uuid(), activation_id: activation?.id ?? null, seq: null,
      period_start: last?.period_end ?? new Date(Date.now() - 6 * 3600_000).toISOString(), period_end: new Date().toISOString(), status: 'draft',
      situation: null, actions_taken: null, needs: null, affected_families: null, affected_persons: null, evacuated_families: null, evacuated_persons: null,
      dead: null, injured: null, missing: null, submitted_at: null, approved_at: null, version: 1 };
    await save('sitreps', s, 'New SitRep draft');
    nav(`/eoc/sitreps/${s.id}`);
  };
  return (
    <div className="page">
      <PageHeader title="Situation reports" subtitle="Numbered when submitted. Approved SitReps are locked."
        actions={canOperate(roles) && <Button icon={Plus} onClick={create}>New SitRep</Button>} />
      <Tabs items={EOC_TABS} />
      {rows.length === 0 ? <EmptyState title="No SitReps yet" body="Start one each operational period during an activation." /> : (
        <List>{rows.map((s) => <ListRow key={s.id} to={`/eoc/sitreps/${s.id}`} title={s.seq ? `SitRep No. ${s.seq}` : 'Draft SitRep'}
          meta={`${fmtDateTime(s.period_start)} to ${fmtDateTime(s.period_end)}`}
          trailing={<Badge tone={s.status === 'approved' ? 'ok' : s.status === 'submitted' ? 'info' : 'neutral'}>{SITREP_STATUS[s.status]}</Badge>} />)}</List>
      )}
    </div>
  );
}

const COUNTS: [keyof Sitrep, string][] = [
  ['affected_families', 'Affected families'], ['affected_persons', 'Affected persons'], ['evacuated_families', 'Evacuated families'],
  ['evacuated_persons', 'Evacuated persons'], ['dead', 'Dead'], ['injured', 'Injured'], ['missing', 'Missing'],
];

export function SitrepEditor() {
  const { id } = useParams();
  const { roles } = useAuth();
  const toast = useToast();
  const s = useLiveQuery(() => (id ? db.sitreps.get(id) : undefined), [id]);
  const [form, setForm] = useState<Sitrep | null>(null);
  useEffect(() => { if (s) setForm(s); }, [s?.id, s?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !form) return <Loading />;
  const editable = s.status !== 'approved' && canOperate(roles);

  const pullEvac = async () => {
    const reports = await db.barangay_reports.where('reported_at').belowOrEqual(form.period_end).reverse().sortBy('reported_at');
    const latest = new Map<string, BarangayReport>();
    for (const r of reports) if (!latest.has(r.barangay_psgc)) latest.set(r.barangay_psgc, r);
    const v = Array.from(latest.values());
    setForm({ ...form, evacuated_families: v.reduce((a, r) => a + r.families_evacuated, 0), evacuated_persons: v.reduce((a, r) => a + r.persons_evacuated, 0) });
    toast('Evacuation totals filled from the latest barangay reports', 'info');
  };
  const persist = async (status?: Sitrep['status']) => {
    let seq = form.seq;
    if (status === 'submitted' && seq === null) {   // the server assigns the official number; this is the offline preview
      seq = (await db.sitreps.toArray()).reduce((m, x) => Math.max(m, x.activation_id === form.activation_id ? x.seq ?? 0 : 0), 0) + 1;
    }
    const next = { ...form, seq, status: status ?? form.status, ...(status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}) };
    await save('sitreps', next, status === 'approved' ? 'Approve SitRep' : status === 'submitted' ? 'Submit SitRep' : 'Save SitRep');
    toast(status === 'approved' ? 'SitRep approved' : status === 'submitted' ? 'SitRep submitted' : 'SitRep saved');
  };
  const num = (k: keyof Sitrep) => (form[k] as number | null) ?? '';

  return (
    <div className="page">
      <PageHeader title={s.seq ? `SitRep No. ${s.seq}` : 'Draft SitRep'} back="/eoc/sitreps"
        subtitle={<Badge tone={s.status === 'approved' ? 'ok' : s.status === 'submitted' ? 'info' : 'neutral'}>{SITREP_STATUS[s.status]}</Badge>}
        actions={<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>} />
      {s.status === 'approved' && <Notice tone="ok" title="Approved">{`Approved ${fmtDateTime(s.approved_at)}. Issue the next SitRep for new information.`}</Notice>}
      <div className="max-w-3xl">
        <Section title="Reporting period">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">{(i) => <Input id={i} type="datetime-local" disabled={!editable} value={toLocalInput(form.period_start)} onChange={(e) => setForm({ ...form, period_start: fromLocalInput(e.target.value) })} />}</Field>
            <Field label="To">{(i) => <Input id={i} type="datetime-local" disabled={!editable} value={toLocalInput(form.period_end)} onChange={(e) => setForm({ ...form, period_end: fromLocalInput(e.target.value) })} />}</Field>
          </div>
        </Section>
        <Section title="Situation">
          <div className="space-y-4">
            <Field label="Situation overview">{(i) => <Textarea id={i} rows={5} disabled={!editable} value={form.situation ?? ''} onChange={(e) => setForm({ ...form, situation: e.target.value })} />}</Field>
            <Field label="Actions taken">{(i) => <Textarea id={i} rows={4} disabled={!editable} value={form.actions_taken ?? ''} onChange={(e) => setForm({ ...form, actions_taken: e.target.value })} />}</Field>
            <Field label="Needs and gaps">{(i) => <Textarea id={i} rows={3} disabled={!editable} value={form.needs ?? ''} onChange={(e) => setForm({ ...form, needs: e.target.value })} />}</Field>
          </div>
        </Section>
        <Section title="Figures" action={editable && <Button variant="quiet" onClick={pullEvac}>Fill from barangay reports</Button>}>
          <p className="mb-3 text-sm text-muted">Aggregate counts only. Leave blank if not yet known; enter 0 only when confirmed.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNTS.map(([k, label]) => (
              <Field key={k} label={label}>{(i) => <Input id={i} type="number" min={0} inputMode="numeric" disabled={!editable} value={num(k)}
                onChange={(e) => setForm({ ...form, [k]: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />}</Field>
            ))}
          </div>
        </Section>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => persist()}>Save</Button>
            {s.status === 'draft' && <Button variant="secondary" onClick={() => persist('submitted')}>Submit</Button>}
            {s.status === 'submitted' && canChangeLevel(roles) && <Button variant="secondary" onClick={() => persist('approved')}>Approve</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
