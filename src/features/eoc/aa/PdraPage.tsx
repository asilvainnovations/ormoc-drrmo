import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save, saveMany } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { useAaParams } from '@/lib/hooks';
import { hoursBetween, pdraDecisionProblem } from '@/domain/aa';
import { duration, fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { Badge, Button, Checkbox, ChoiceGroup, Field, Input, KeyValue, Loading, Notice, PageHeader, Section, Select, Textarea, TextLink } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { Declaration, ImpactClass, Pdra, PdraDecision } from '@/types';
import { loadChecklist } from './actions';
import { DECISION, IMPACT, SECTORS } from './labels';
import { ChecklistSection } from './Checklist';

export function PdraNewPage() {
  const { has } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const params = useAaParams();
  const ref = useLiveQuery(async () => ({ hazards: (await db.hazards.orderBy('sort').toArray()).filter((h) => h.forecastable), brgys: await db.barangays.orderBy('name').toArray() }), []);
  const [f, setF] = useState({
    hazard_code: 'tropical_cyclone', forecast_source: '', forecast_issued_at: toLocalInput(), expected_impact_at: toLocalInput(new Date(Date.now() + 96 * 3600_000)),
    impact_class: 'severe' as ImpactClass, cascading_risks: '', summary: '', decision: 'monitor' as PdraDecision, decision_basis: '',
    sectors: [] as string[], barangays: [] as string[],
  });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const conductedAt = useMemo(() => new Date().toISOString(), []);
  const lead = hoursBetween(conductedAt, fromLocalInput(f.expected_impact_at));
  const hazard = ref?.hazards.find((h) => h.code === f.hazard_code);
  const problem = pdraDecisionProblem({ impact_class: f.impact_class, decision: f.decision, expected_impact_at: fromLocalInput(f.expected_impact_at), conducted_at: conductedAt, decision_basis: f.decision_basis }, params);
  const eligible = f.impact_class === 'severe' && lead >= params.min_declaration_lead_hours;

  if (!has('cdrrmo_head', 'eoc_manager', 'eoc_staff')) return <div className="page"><PageHeader title="New PDRA" back="/eoc/aa" /><Notice>Only the CDRRMO Head and EOC staff record PDRAs.</Notice></div>;

  const submit = async () => {
    if (problem) { toast(problem, 'bad'); return; }
    if (new Date(fromLocalInput(f.expected_impact_at)) <= new Date(fromLocalInput(f.forecast_issued_at))) { toast('The expected impact must be after the forecast was issued.', 'bad'); return; }
    setBusy(true);
    const p: Pdra & { _new: true } = { _new: true, id: uuid(), hazard_code: f.hazard_code, forecast_source: f.forecast_source.trim(), forecast_issued_at: fromLocalInput(f.forecast_issued_at),
      expected_impact_at: fromLocalInput(f.expected_impact_at), conducted_at: conductedAt, impact_class: f.impact_class, affected_barangays: f.barangays,
      cascading_risks: f.cascading_risks.trim() || null, sectors_at_risk: f.sectors, summary: f.summary.trim() || null, decision: f.decision,
      decision_basis: f.decision_basis.trim() || null, version: 1 };
    if (f.decision === 'request_declaration') {
      const d: Declaration & { _new: true } = { _new: true, id: uuid(), pdra_id: p.id, hazard_code: p.hazard_code, scope_barangays: p.affected_barangays, expected_impact_at: p.expected_impact_at,
        origin: 'city_request', status: 'draft', requested_at: null, rdrrmc_due_at: null, rdrrmc_responded_at: null, rdrrmc_reference: null, eo_number: null, declared_at: null,
        lifted_at: null, lifting_ground: null, lifting_basis: null, report_due_at: null, report_submitted_at: null, report_reference: null, costs_minimized_note: null, version: 1 };
      await saveMany([{ table: 'pdra_sessions', row: p, label: 'Record PDRA' }, { table: 'declarations', row: d, label: 'Draft declaration request' }]);
      toast('PDRA recorded. Prepare the request to RDRRMC VIII.'); nav(`/eoc/aa/d/${d.id}`);
    } else {
      await save('pdra_sessions', p, 'Record PDRA');
      if (f.decision === 'local_early_action') await loadChecklist({ pdraId: p.id }, p.hazard_code);
      toast('PDRA recorded'); nav(`/eoc/aa/pdra/${p.id}`);
    }
    setBusy(false);
  };

  const toggle = (k: 'sectors' | 'barangays', v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });

  return (
    <div className="page">
      <PageHeader title="Pre-disaster risk assessment" back="/eoc/aa" subtitle="Record the forecast, the exposure and the decision. The lead time is counted from now." />
      <div className="max-w-3xl">
        <Section title="Forecast">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hazard">{(id) => <Select id={id} value={f.hazard_code} onChange={(e) => setF({ ...f, hazard_code: e.target.value })}>
              {ref?.hazards.map((h) => <option key={h.code} value={h.code}>{h.name}</option>)}</Select>}</Field>
            <Field label="Forecast source" hint="Issuer and bulletin number.">{(id, d) => <Input id={id} aria-describedby={d} value={f.forecast_source} onChange={(e) => setF({ ...f, forecast_source: e.target.value })} />}</Field>
            <Field label="Forecast issued">{(id) => <Input id={id} type="datetime-local" value={f.forecast_issued_at} onChange={(e) => setF({ ...f, forecast_issued_at: e.target.value })} />}</Field>
            <Field label="Expected impact">{(id) => <Input id={id} type="datetime-local" value={f.expected_impact_at} onChange={(e) => setF({ ...f, expected_impact_at: e.target.value })} />}</Field>
          </div>
          {hazard?.note && <p className="mt-2 text-sm text-muted">{hazard.note}</p>}
        </Section>
        <Section title="Projected impact">
          <ChoiceGroup legend="Impact classification" value={f.impact_class} onChange={(v) => setF({ ...f, impact_class: v })} columns={2}
            options={(Object.keys(IMPACT) as ImpactClass[]).map((k) => ({ value: k, label: IMPACT[k], detail: k === 'severe' ? 'Major, large-scale, possibly catastrophic damage or disruption (RA 12287 Sec. 3(h))' : undefined }))} />
          <fieldset className="mt-4">
            <legend className="font-semibold">Sectors at risk</legend>
            <div className="mt-2 flex flex-wrap gap-2">{SECTORS.map((s) => (
              <Checkbox tip={`Tick if the ${s} sector is exposed`} key={s} checked={f.sectors.includes(s)} onChange={() => toggle('sectors', s)}>{s}</Checkbox>))}</div>
          </fieldset>
          <div className="mt-4 space-y-4">
            <Field label="Cascading or compound hazards" optional>{(id) => <Textarea id={id} value={f.cascading_risks} onChange={(e) => setF({ ...f, cascading_risks: e.target.value })} />}</Field>
            <Field label="Summary of exposure" optional hint="Barangays, vulnerable groups, critical facilities.">{(id, d) => <Textarea id={id} aria-describedby={d} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />}</Field>
          </div>
          {ref && ref.brgys.length > 0 && (
            <fieldset className="mt-4">
              <legend className="font-semibold">Barangays forecast to be affected ({f.barangays.length})</legend>
              <Input className="mt-2" type="search" placeholder="Filter barangays" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter barangays" />
              <div className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {ref.brgys.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).map((b) => (
                  <label key={b.psgc} className="flex min-h-tap items-center gap-3 px-1"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" checked={f.barangays.includes(b.psgc)} onChange={() => toggle('barangays', b.psgc)} />{b.name}</label>))}
              </div>
            </fieldset>
          )}
        </Section>
        <Section title="Decision">
          <div className="mb-4 rounded-control bg-sunken p-4">
            <p className="font-semibold">Lead time left: {lead > 0 ? duration(lead) : 'none'}</p>
            <p className="text-sm text-muted">{eligible ? 'Severe impact with at least 3 days of lead time: a declaration can be requested.'
              : f.impact_class !== 'severe' ? 'A declaration needs impacts classified as severe.'
                : `A declaration needs at least ${params.min_declaration_lead_hours} hours. Use city early action.`}</p>
          </div>
          <ChoiceGroup legend="Decision" value={f.decision} onChange={(v) => setF({ ...f, decision: v })}
            options={(Object.keys(DECISION) as PdraDecision[]).map((k) => ({ value: k, label: DECISION[k].label, detail: DECISION[k].detail,
              disabled: k === 'request_declaration' && !eligible, disabledReason: 'Needs severe impact and at least 3 days of lead time' }))} />
          {f.decision === 'request_declaration' && <div className="mt-4"><Field label="Basis for the request">{(id) => <Textarea id={id} value={f.decision_basis} onChange={(e) => setF({ ...f, decision_basis: e.target.value })} />}</Field></div>}
          {f.decision === 'local_early_action' && <Notice tone="info" title="City early action">The anticipatory action checklist will load for this PDRA. For flash floods and landslides, also run the flash flood early action protocol.</Notice>}
          {problem && f.decision === 'request_declaration' && <p role="alert" className="mt-2 font-semibold text-bad">{problem}</p>}
        </Section>
        <Button tip="Save the PDRA and its decision. A declaration request opens if you chose one" size="lg" busy={busy} disabled={!f.forecast_source.trim()} onClick={submit}>Record PDRA</Button>
      </div>
    </div>
  );
}

export function PdraViewPage() {
  const { id } = useParams();
  const data = useLiveQuery(async () => {
    const p = id ? await db.pdra_sessions.get(id) : undefined;
    if (!p) return null;
    return { p, hazard: await db.hazards.get(p.hazard_code), decl: await db.declarations.where('status').notEqual('withdrawn').filter((d) => d.pdra_id === p.id).first(),
      actions: await db.aa_actions.where('pdra_id').equals(p.id).toArray() };
  }, [id]);
  if (!data) return <Loading />;
  const { p } = data;
  return (
    <div className="page">
      <PageHeader title={`PDRA: ${data.hazard?.name ?? p.hazard_code}`} back="/eoc/aa" subtitle={<Badge>{DECISION[p.decision].label}</Badge>} />
      <div className="max-w-3xl space-y-6">
        <KeyValue items={[['Forecast', p.forecast_source], ['Issued', fmtDateTime(p.forecast_issued_at)], ['Expected impact', fmtDateTime(p.expected_impact_at)],
          ['Conducted', fmtDateTime(p.conducted_at)], ['Impact', IMPACT[p.impact_class]], ['Lead time at PDRA', duration(hoursBetween(p.conducted_at, p.expected_impact_at))],
          ['Sectors at risk', p.sectors_at_risk.join(', ') || '—'], ['Barangays', p.affected_barangays.length ? `${p.affected_barangays.length} selected` : '—']]} />
        {p.summary && <p className="max-w-prose">{p.summary}</p>}
        {data.decl && <Notice tone="info" title="Declaration">This PDRA led to a declaration request. <TextLink tip="Open the declaration that came from this PDRA" to={`/eoc/aa/d/${data.decl.id}`}>Open it</TextLink>.</Notice>}
        {data.actions.length > 0 && <ChecklistSection actions={data.actions} />}
      </div>
    </div>
  );
}

