import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, Plus, Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canChangeLevel, canOperate, currentLevel, cutoffForLevel, evacuationTotals, latestPerBarangay, LEVEL_INFO, sitrepReportWindow } from '@/domain/eoc';
import { campTotals, latestPerCentre, sitrepCampText } from '@/domain/echo';
import { fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { downloadXlsx } from '@/lib/xlsx';
import { Badge, Button, EmptyState, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { Sitrep } from '@/types';
import { EOC_TABS, SITREP_REPORT_TYPE, SITREP_STATUS } from './labels';

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
      dead: null, injured: null, missing: null, submitted_at: null, approved_at: null,
      report_type: 'during_disaster', incident_type: null, affected_barangays: null, damaged_houses_totally: null, damaged_houses_partially: null,
      lifelines_status: null, assistance_provided: null, cost_of_assistance: null, version: 1 };
    await save('sitreps', s, 'New SitRep draft');
    nav(`/eoc/sitreps/${s.id}`);
  };
  return (
    <div className="page">
      <PageHeader title="Situation Reports" subtitle="Numbered when submitted. Approved SitReps are locked."
        actions={canOperate(roles) && <Button tip="Start a new situation report draft for this operational period" icon={Plus} onClick={create}>New SitRep</Button>} />
      <Tabs items={EOC_TABS} />
      {rows.length === 0 ? <EmptyState title="No SitReps yet" body="Start one each operational period during an activation." /> : (
        <List>{rows.map((s) => <ListRow tip="Open this situation report" key={s.id} to={`/eoc/sitreps/${s.id}`} title={s.seq ? `SitRep No. ${s.seq}` : 'Draft SitRep'}
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
  // 1.21.0 (ADR-038): the reporting times for the current alert level (DILG VIII SOP Table 3).
  const cutoff = useLiveQuery(async () => {
    const { level } = currentLevel(await db.eoc_activations.toArray());
    return { cutoff: cutoffForLevel(await db.sitrep_cutoffs.toArray(), level), level };
  }, []);
  const [form, setForm] = useState<Sitrep | null>(null);
  useEffect(() => { if (s) setForm(s); }, [s?.id, s?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !form) return <Loading />;
  const editable = s.status !== 'approved' && canOperate(roles);
  const reportType = form.report_type ?? 'during_disaster';

  const exportXlsx = () => {
    const meta: [string, string | number | null][] = [
      ['Report type', SITREP_REPORT_TYPE[reportType]],
      ['Incident type', form.incident_type ?? '—'],
      ['SitRep No.', form.seq ?? '(unnumbered draft)'],
      ['Status', SITREP_STATUS[form.status]],
      ['Reporting period', `${fmtDateTime(form.period_start)} to ${fmtDateTime(form.period_end)}`],
    ];
    const figures: [string, string | number | null][] = [
      ['Affected barangays', form.affected_barangays], ['Affected families', form.affected_families], ['Affected persons', form.affected_persons],
      ['Dead', form.dead], ['Injured', form.injured], ['Missing', form.missing],
      ['Damaged houses — totally', form.damaged_houses_totally], ['Damaged houses — partially', form.damaged_houses_partially],
      ['Evacuated families (outside centres)', form.evacuated_families], ['Evacuated persons (outside centres)', form.evacuated_persons],
      ['Cost of assistance (PHP)', form.cost_of_assistance],
    ];
    const rows: (string | number | null)[][] = [
      ['SITUATION REPORT', null, null, null],
      ['CDRRMO Ormoc City — DILG VIII harmonized template', null, null, null],
      ...meta.map(([k, v]) => [k, v, null, null]),
      [null, null, null, null],
      ['I. Situation overview', null, null, null], [form.situation ?? '—', null, null, null],
      ['II. Figures', null, null, null],
      ...figures.map(([k, v]) => [k, v, null, null]),
      ['III. Status of lifelines (power, water, communications, roads)', null, null, null], [form.lifelines_status ?? '—', null, null, null],
      ['IV. Actions taken', null, null, null], [form.actions_taken ?? '—', null, null, null],
      ['V. Assistance provided', null, null, null], [form.assistance_provided ?? '—', null, null, null],
      ['VI. Needs and gaps', null, null, null], [form.needs ?? '—', null, null, null],
    ];
    const day = form.period_end.slice(0, 10).replaceAll('-', '');
    downloadXlsx(`CDRRMO-Ormoc_SitRep-No-${form.seq ?? 'draft'}_${day}_${reportType}.xlsx`, { name: form.seq ? `SitRep No. ${form.seq}` : 'Draft SitRep', widths: [42, 34, 12, 12], rows });
    toast('Excel workbook downloaded.');
  };

  const pullEvac = async () => {
    // Only this SitRep's event, up to the end of its period (#16).
    const window = sitrepReportWindow(await db.eoc_activations.toArray(), form);
    const t = evacuationTotals(latestPerBarangay(await db.barangay_reports.toArray(), window));
    setForm({ ...form, evacuated_families: t.families, evacuated_persons: t.persons });
    toast(t.notReported > 0
      ? `Evacuation totals filled from this event's barangay reports. ${t.notReported} barangay${t.notReported > 1 ? 's have' : ' has'} not reported counts.`
      : "Evacuation totals filled from this event's barangay reports", 'info');
  };
  /** ECHO (1.16.0): add the inside-centre figures as text; the evacuated totals stay from the barangay reports. */
  const pullCamps = async () => {
    const window = sitrepReportWindow(await db.eoc_activations.toArray(), form);
    const t = campTotals(latestPerCentre(await db.camp_reports.toArray(), window.from, window.to),
      new Map((await db.evacuation_centers.toArray()).map((c) => [c.id, c.capacity_persons])));
    if (t.centresOpen === 0) { toast('No open centre in ECHO for this period', 'info'); return; }
    const text = sitrepCampText(t, []).situation;
    setForm({ ...form, situation: form.situation ? `${form.situation}\n\n${text}` : text });
    toast('Camp figures added to the situation overview', 'info');
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
        actions={<>
          <Button tip="Download this SitRep as an Excel workbook in the DILG VIII layout" variant="secondary" icon={FileSpreadsheet} onClick={exportXlsx}>Excel</Button>
          <Button tip="Print this SitRep or save it as PDF" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </>} />
      {s.status === 'approved' && <Notice tone="ok" title="Approved">{`Approved ${fmtDateTime(s.approved_at)}. Issue the next SitRep for new information.`}</Notice>}
      <div className="max-w-3xl">
        <Section title="Reporting period">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">{(i) => <Input id={i} type="datetime-local" disabled={!editable} value={toLocalInput(form.period_start)} onChange={(e) => setForm({ ...form, period_start: fromLocalInput(e.target.value) })} />}</Field>
            <Field label="To">{(i) => <Input id={i} type="datetime-local" disabled={!editable} value={toLocalInput(form.period_end)} onChange={(e) => setForm({ ...form, period_end: fromLocalInput(e.target.value) })} />}</Field>
          </div>
          {cutoff?.cutoff && (
            <p className="mt-3 text-sm text-muted">
              {LEVEL_INFO[cutoff.level].name} level reporting times (DILG VIII SOP Table 3): barangay reports due at the EOC by{' '}
              <strong>{cutoff.cutoff.barangay_am.slice(0, 5)}</strong> and <strong>{cutoff.cutoff.barangay_pm.slice(0, 5)}</strong>;
              the city submits by <strong>{cutoff.cutoff.submission_am.slice(0, 5)}</strong> and <strong>{cutoff.cutoff.submission_pm.slice(0, 5)}</strong>.
            </p>
          )}
        </Section>
        <Section title="DILG VIII harmonized fields">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Report type" tip="The harmonized template has four report types">{(i) => (
                <Select id={i} disabled={!editable} value={reportType} onChange={(e) => setForm({ ...form, report_type: e.target.value as Sitrep['report_type'] })}>
                  {(Object.keys(SITREP_REPORT_TYPE) as Sitrep['report_type'][]).map((t) => <option key={t} value={t}>{SITREP_REPORT_TYPE[t]}</option>)}
                </Select>
              )}</Field>
              <Field label="Incident type" optional hint="e.g. Typhoon, flooding, fire, earthquake">{(i) => <Input id={i} disabled={!editable} value={form.incident_type ?? ''} onChange={(e) => setForm({ ...form, incident_type: e.target.value || null })} />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Affected barangays">{(i) => <Input id={i} type="number" min={0} inputMode="numeric" disabled={!editable} value={num('affected_barangays')}
                onChange={(e) => setForm({ ...form, affected_barangays: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />}</Field>
              <Field label="Damaged houses — totally">{(i) => <Input id={i} type="number" min={0} inputMode="numeric" disabled={!editable} value={num('damaged_houses_totally')}
                onChange={(e) => setForm({ ...form, damaged_houses_totally: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />}</Field>
              <Field label="Damaged houses — partially">{(i) => <Input id={i} type="number" min={0} inputMode="numeric" disabled={!editable} value={num('damaged_houses_partially')}
                onChange={(e) => setForm({ ...form, damaged_houses_partially: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />}</Field>
            </div>
            <Field label="Status of lifelines" optional hint="Power, water, communications and road access — the DILG VIII checklist item">{(i) => <Textarea id={i} rows={3} disabled={!editable} value={form.lifelines_status ?? ''} onChange={(e) => setForm({ ...form, lifelines_status: e.target.value || null })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <Field label="Assistance provided" optional hint="Food and non-food items, services delivered">{(i) => <Textarea id={i} rows={3} disabled={!editable} value={form.assistance_provided ?? ''} onChange={(e) => setForm({ ...form, assistance_provided: e.target.value || null })} />}</Field>
              <Field label="Cost of assistance (PHP)">{(i) => <Input id={i} type="number" min={0} inputMode="numeric" disabled={!editable} value={num('cost_of_assistance')}
                onChange={(e) => setForm({ ...form, cost_of_assistance: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />}</Field>
            </div>
          </div>
        </Section>
        <Section title="Situation">
          <div className="space-y-4">
            <Field label="Situation overview">{(i) => <Textarea id={i} rows={5} disabled={!editable} value={form.situation ?? ''} onChange={(e) => setForm({ ...form, situation: e.target.value })} />}</Field>
            <Field label="Actions taken">{(i) => <Textarea id={i} rows={4} disabled={!editable} value={form.actions_taken ?? ''} onChange={(e) => setForm({ ...form, actions_taken: e.target.value })} />}</Field>
            <Field label="Needs and gaps">{(i) => <Textarea id={i} rows={3} disabled={!editable} value={form.needs ?? ''} onChange={(e) => setForm({ ...form, needs: e.target.value })} />}</Field>
          </div>
        </Section>
        <Section title="Figures" action={editable && <span className="flex flex-wrap gap-1"><Button tip="Fill the evacuation figures from the latest barangay reports" variant="quiet" onClick={pullEvac}>Fill from barangay reports</Button>
          <Button tip="Add the inside-evacuation-centre figures from ECHO camp reports to the situation overview" variant="quiet" onClick={pullCamps}>Add ECHO camp figures</Button></span>}>
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
            <Button tip="Save your changes to this draft" onClick={() => persist()}>Save</Button>
            {s.status === 'draft' && <Button tip="Submit for the EOC Manager to approve. It gets its SitRep number now" variant="secondary" onClick={() => persist('submitted')}>Submit</Button>}
            {s.status === 'submitted' && canChangeLevel(roles) && <Button tip="Approve this SitRep for sending. Approved SitReps cannot be changed" variant="secondary" onClick={() => persist('approved')}>Approve</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
