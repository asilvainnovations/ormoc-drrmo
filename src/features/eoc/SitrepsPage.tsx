import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, Plus, Printer, Wand2 } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canChangeLevel, canOperate, currentLevel, cutoffForLevel, latestPerBarangay, LEVEL_INFO, sitrepReportWindow } from '@/domain/eoc';
import { campTotals, latestPerCentre } from '@/domain/echo';
import { composeSitrep, LIFELINE_STATES, LIFELINES, lifelinesText, parseLifelines, type ComposedSitrep, type Lifeline, type LifelineState } from '@/domain/sitrepCompose';
import { Chips } from './kit';
import { fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { downloadXlsx } from '@/lib/xlsx';
import { Badge, Button, EmptyState, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { Sitrep } from '@/types';
import { EOC_TABS, SITREP_REPORT_TYPE, SITREP_STATUS } from './labels';


/** Gather what the EOC has recorded for this period and compose the SitRep text and figures from it (nothing invented). */
async function composeFor(period: { activation_id: string | null; period_start: string; period_end: string }): Promise<ComposedSitrep> {
  const activations = await db.eoc_activations.toArray();
  const window = sitrepReportWindow(activations, period);
  const { level } = currentLevel(activations);
  const names = new Map((await db.barangays.toArray()).map((b) => [b.psgc, b.name]));
  const latest = latestPerBarangay(await db.barangay_reports.toArray(), window);
  const hazards = new Map((await db.hazards.toArray()).map((h) => [h.code, h.name]));
  const act = activations.find((a) => a.id === period.activation_id);
  const camps = campTotals(latestPerCentre(await db.camp_reports.toArray(), window.from, window.to), new Map((await db.evacuation_centers.toArray()).map((c) => [c.id, c.capacity_persons])));
  const reqs = await db.resource_requests.toArray();
  const inPeriod = (iso: string | null) => !!iso && iso >= period.period_start && iso <= period.period_end;
  return composeSitrep({
    level, hazardName: act?.hazard_code ? hazards.get(act.hazard_code) ?? act.hazard_code : null, hasActivation: !!act, periodStart: period.period_start, periodEnd: period.period_end,
    totalBarangays: names.size, latest, names, camps,
    openRequests: reqs.filter((r) => ['requested', 'approved', 'mobilized'].includes(r.status)),
    deliveredInPeriod: reqs.filter((r) => inPeriod(r.delivered_at)),
    log: (await db.logbook_entries.toArray()).filter((l) => inPeriod(l.occurred_at)),
  });
}

export function SitrepsPage() {
  const { roles } = useAuth();
  const nav = useNavigate();
  const rows = useLiveQuery(() => db.sitreps.orderBy('period_end').reverse().toArray(), [], []);
  const create = async () => {
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const last = rows[0];
    const period = { activation_id: activation?.id ?? null, period_start: last?.period_end ?? new Date(Date.now() - 6 * 3600_000).toISOString(), period_end: new Date().toISOString() };
    const c = await composeFor(period);
    const s: Sitrep & { _new: true } = { _new: true, id: uuid(), ...period, seq: null, status: 'draft',
      situation: c.situation, actions_taken: c.actions_taken, needs: c.needs, affected_families: null, affected_persons: null, evacuated_families: c.evacuated_families, evacuated_persons: c.evacuated_persons,
      dead: null, injured: null, missing: null, submitted_at: null, approved_at: null,
      report_type: c.report_type, incident_type: c.incident_type, affected_barangays: c.affected_barangays, damaged_houses_totally: null, damaged_houses_partially: null,
      lifelines_status: null, assistance_provided: c.assistance_provided, cost_of_assistance: null, version: 1 };
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

  /** Re-read the EOC's records and rewrite the composed parts. Lifelines, casualty counts, damage and cost stay as you typed them. */
  const refresh = async () => {
    const c = await composeFor(form);
    setForm({ ...form, situation: c.situation, actions_taken: c.actions_taken, needs: c.needs, assistance_provided: c.assistance_provided, affected_barangays: c.affected_barangays,
      evacuated_families: c.evacuated_families, evacuated_persons: c.evacuated_persons, incident_type: form.incident_type ?? c.incident_type });
    toast('Refreshed from the barangay reports, camp reports, requests and logbook', 'info');
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
        {editable && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sheet border border-sky/40 bg-sky-soft p-4">
            <p className="max-w-md text-sm text-ink">This report was filled in from the barangay reports, camp reports, requests and logbook. Check it, set the lifelines, add casualties and damage, then submit.</p>
            <Button tip="Re-read the EOC records and rewrite the situation, actions, needs and evacuee counts" variant="secondary" icon={Wand2} onClick={refresh}>Refresh from live data</Button>
          </div>
        )}
        <Section title="Reporting Period">
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
        <Section title="DILG VIII Harmonized Fields">
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
            <LifelinesField disabled={!editable} value={form.lifelines_status} onChange={(v) => setForm({ ...form, lifelines_status: v })} />
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
        <Section title="Figures">
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

function LifelinesField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled: boolean }) {
  const { state, note } = parseLifelines(value);
  const write = (st: Partial<Record<Lifeline, LifelineState>>, n: string) => onChange(lifelinesText(st, n) || null);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-bold">Status of lifelines</legend>
      {LIFELINES.map((l) => (
        <div key={l.key} className="grid items-center gap-2 sm:grid-cols-[9rem_1fr]">
          <span className="text-sm font-semibold">{l.label}</span>
          <Chips label={l.label} disabled={disabled} value={state[l.key] ?? null} onChange={(v) => write({ ...state, [l.key]: v }, note)} options={LIFELINE_STATES} />
        </div>
      ))}
      <Field label="Details" optional hint="Which roads, which barangays, expected restoration.">{(i) => <Textarea id={i} rows={2} disabled={disabled} value={note} onChange={(e) => write(state, e.target.value)} />}</Field>
    </fieldset>
  );
}
