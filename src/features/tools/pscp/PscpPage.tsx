import { useMemo, useState } from 'react';
import { Download, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';
import { Markdown } from '@/features/library/Markdown';
import { Badge, Button, Field, Input, Notice, PageHeader, Section, Select, Textarea } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { download, loadTool, saveTool } from '../storage';
import { pscpChecks, pscpMarkdown, riskBand, riskScore, starterPscp, type EssentialFunction, type Pscp } from './pscp';

const TABS = [
  { id: 'policy', label: 'Policy and team' }, { id: 'bia', label: 'Essential functions (BIA)' }, { id: 'risk', label: 'Risk assessment' },
  { id: 'strategy', label: 'Continuity strategies' }, { id: 'activation', label: 'Activation' }, { id: 'plan', label: 'Plan document' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** Public Service Continuity Plan workbench for the CDRRMO and EOC (CSC MC No. 2, s. 2021; OCD PSCP Guidebook). */
export function PscpPage() {
  const { userId } = useAuth();
  const [plan, setPlan] = useState<Pscp>(() => loadTool(userId, 'pscp', starterPscp()));
  const [tab, setTab] = useState<Tab>('policy');
  const set = (p: Pscp) => { setPlan(p); saveTool(userId, 'pscp', p); };
  const checks = useMemo(() => pscpChecks(plan), [plan]);
  const md = useMemo(() => pscpMarkdown(plan), [plan]);

  return (
    <div className="page">
      <PageHeader title="Public Service Continuity Plan" back="/tools"
        subtitle="Keep warning, coordination and response running when people, premises, power or ICT are disrupted. Starts from a CDRRMO draft; change everything to fit." />
      <Notice tone="info">
        Basis: CSC Memorandum Circular No. 2, s. 2021 (every agency has a PSCP) and the NDRRMC–OCD PSCP Guidebook, with ISO 22301 terms. This evidences IAT A3.4 and B2.7 once approved and tested. The draft is kept on this device; export it or copy the plan document into the Library.
      </Notice>
      <div role="tablist" aria-label="PSCP sections" className="mb-4 flex flex-wrap gap-1 print:hidden">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} {...tip(`Open: ${t.label}`)}
            className={clsx('min-h-tap rounded-control px-3 font-semibold', tab === t.id ? 'bg-sky-soft ring-1 ring-action' : 'hover:bg-sky-soft/60')}>{t.label}</button>
        ))}
      </div>
      {checks.length > 0 && tab !== 'plan' && (
        <Notice tone="warn" title={`${checks.length} thing${checks.length === 1 ? '' : 's'} to fix`}>
          <ul className="list-disc pl-5">{checks.slice(0, 6).map((c) => <li key={c}>{c}</li>)}</ul>{checks.length > 6 && <p>…and {checks.length - 6} more on the Plan document tab.</p>}
        </Notice>
      )}

      {tab === 'policy' && (
        <>
          <Section title="Policy and scope">
            <div className="grid max-w-3xl gap-4">
              <Field label="Office">{(id) => <Input id={id} value={plan.office} onChange={(e) => set({ ...plan, office: e.target.value })} />}</Field>
              <Field label="Continuity policy">{(id) => <Textarea id={id} value={plan.policy} onChange={(e) => set({ ...plan, policy: e.target.value })} />}</Field>
              <Field label="Scope">{(id) => <Textarea id={id} value={plan.scope} onChange={(e) => set({ ...plan, scope: e.target.value })} />}</Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Version">{(id) => <Input id={id} value={plan.version} onChange={(e) => set({ ...plan, version: e.target.value })} />}</Field>
                <Field label="Approved by" optional>{(id) => <Input id={id} value={plan.approvedBy} onChange={(e) => set({ ...plan, approvedBy: e.target.value })} />}</Field>
                <Field label="Next review" optional>{(id) => <Input id={id} type="date" value={plan.reviewDate} onChange={(e) => set({ ...plan, reviewDate: e.target.value })} />}</Field>
              </div>
            </div>
          </Section>
          <Section title="Continuity Management Team">
            <Rows rows={plan.team} onChange={(team) => set({ ...plan, team })} blank={{ role: '', position: '', alternate: '' }}
              cols={[{ k: 'role', l: 'Role' }, { k: 'position', l: 'Position (not names)' }, { k: 'alternate', l: 'Alternate' }]} />
          </Section>
        </>
      )}

      {tab === 'bia' && (
        <Section title="Essential functions and business impact analysis">
          <p className="mb-3 max-w-prose text-sm text-muted">Priority 1 is mission-critical. MTPD: the longest the function can stop before the harm is unacceptable. RTO: when it must be running again (must not exceed the MTPD). RPO: how much data loss is tolerable. All in hours.</p>
          <div className="space-y-3">
            {plan.functions.map((f, i) => <FunctionCard key={f.id} f={f} onChange={(nf) => set({ ...plan, functions: plan.functions.map((x, k) => (k === i ? nf : x)) })}
              onRemove={() => set({ ...plan, functions: plan.functions.filter((_, k) => k !== i) })} />)}
          </div>
          <Button className="mt-3" variant="secondary" icon={Plus} tip="Add an essential function"
            onClick={() => set({ ...plan, functions: [...plan.functions, { id: `F${Date.now()}`, name: '', owner: '', priority: 2, mtpdHours: null, rtoHours: null, rpoHours: null, minStaff: null, dependencies: '', impact: { life: 1, legal: 1, service: 1, financial: 1 } }] })}>Add function</Button>
        </Section>
      )}

      {tab === 'risk' && (
        <Section title="Risk assessment">
          <RiskMatrix plan={plan} />
          <div className="mt-4 space-y-2">
            {plan.risks.map((r, i) => (
              <div key={r.id} className="grid items-end gap-2 rounded-control border border-line bg-surface p-3 sm:grid-cols-[minmax(0,2fr)_6rem_6rem_minmax(0,2fr)_auto]">
                <Field label="Hazard or disruption">{(id) => <Input id={id} value={r.hazard} onChange={(e) => set({ ...plan, risks: plan.risks.map((x, k) => (k === i ? { ...x, hazard: e.target.value } : x)) })} />}</Field>
                <Field label="Likelihood">{(id) => <Select id={id} value={r.likelihood} onChange={(e) => set({ ...plan, risks: plan.risks.map((x, k) => (k === i ? { ...x, likelihood: +e.target.value } : x)) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
                <Field label="Impact">{(id) => <Select id={id} value={r.impact} onChange={(e) => set({ ...plan, risks: plan.risks.map((x, k) => (k === i ? { ...x, impact: +e.target.value } : x)) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
                <Field label="Treatment">{(id) => <Input id={id} value={r.treatment} onChange={(e) => set({ ...plan, risks: plan.risks.map((x, k) => (k === i ? { ...x, treatment: e.target.value } : x)) })} />}</Field>
                <span className="pb-2"><Badge tone={riskBand(riskScore(r)) === 'High' ? 'bad' : riskBand(riskScore(r)) === 'Medium' ? 'warn' : 'ok'}>{riskScore(r)} {riskBand(riskScore(r))}</Badge></span>
              </div>
            ))}
          </div>
          <Button className="mt-3" variant="secondary" icon={Plus} tip="Add a hazard or disruption" onClick={() => set({ ...plan, risks: [...plan.risks, { id: `R${Date.now()}`, hazard: '', likelihood: 3, impact: 3, treatment: '' }] })}>Add risk</Button>
        </Section>
      )}

      {tab === 'strategy' && (
        <>
          <Section title="Primary and alternate sites">
            <Rows rows={plan.sites} onChange={(sites) => set({ ...plan, sites })} blank={{ kind: 'alternate' as const, name: '', address: '', readiness: 'warm' as const, capacity: '', notes: '' }}
              cols={[{ k: 'kind', l: 'Site', options: ['primary', 'alternate'] }, { k: 'name', l: 'Name' }, { k: 'address', l: 'Address' }, { k: 'readiness', l: 'Readiness', options: ['hot', 'warm', 'cold'] }, { k: 'capacity', l: 'Capacity' }, { k: 'notes', l: 'Notes' }]} />
            <p className="mt-2 text-sm text-muted">Hot: ready at once. Warm: partly equipped. Cold: space only. Check the alternate site against HazardHunterPH before designating it.</p>
          </Section>
          <Section title="Orders of succession">
            <Rows rows={plan.succession} onChange={(succession) => set({ ...plan, succession })} blank={{ position: '', first: '', second: '', third: '' }}
              cols={[{ k: 'position', l: 'Position' }, { k: 'first', l: 'First successor' }, { k: 'second', l: 'Second' }, { k: 'third', l: 'Third' }]} />
          </Section>
          <Section title="Delegations of authority">
            <Rows rows={plan.delegations} onChange={(delegations) => set({ ...plan, delegations })} blank={{ authority: '', delegate: '', conditions: '', limits: '' }}
              cols={[{ k: 'authority', l: 'Authority' }, { k: 'delegate', l: 'Delegate' }, { k: 'conditions', l: 'When it applies' }, { k: 'limits', l: 'Limits' }]} />
          </Section>
          <Section title="Vital records">
            <Rows rows={plan.records} onChange={(records) => set({ ...plan, records })} blank={{ record: '', location: '', backup: '', custodian: '' }}
              cols={[{ k: 'record', l: 'Record' }, { k: 'location', l: 'Where kept' }, { k: 'backup', l: 'Backup (3-2-1: three copies, two media, one off site)' }, { k: 'custodian', l: 'Custodian' }]} />
          </Section>
        </>
      )}

      {tab === 'activation' && (
        <>
          {plan.phases.map((ph, pi) => (
            <Section key={ph.id} title={ph.name}>
              <Field label="Trigger">{(id) => <Input id={id} value={ph.trigger} onChange={(e) => set({ ...plan, phases: plan.phases.map((x, k) => (k === pi ? { ...x, trigger: e.target.value } : x)) })} />}</Field>
              <ul className="mt-3 space-y-2">
                {ph.steps.map((s, si) => (
                  <li key={si} className="flex items-center gap-2">
                    <input type="checkbox" aria-label={`Done: ${s.text}`} className="h-4 w-4" checked={s.done}
                      onChange={() => set({ ...plan, phases: plan.phases.map((x, k) => (k === pi ? { ...x, steps: x.steps.map((y, j) => (j === si ? { ...y, done: !y.done } : y)) } : x)) })} />
                    <Input aria-label="Step" value={s.text} onChange={(e) => set({ ...plan, phases: plan.phases.map((x, k) => (k === pi ? { ...x, steps: x.steps.map((y, j) => (j === si ? { ...y, text: e.target.value } : y)) } : x)) })} />
                  </li>
                ))}
              </ul>
              <Button className="mt-2" variant="secondary" icon={Plus} tip="Add a step to this phase"
                onClick={() => set({ ...plan, phases: plan.phases.map((x, k) => (k === pi ? { ...x, steps: [...x.steps, { text: '', done: false }] } : x)) })}>Add step</Button>
            </Section>
          ))}
          <Section title="Testing and maintenance">
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Field label="Last test">{(id) => <Input id={id} type="date" value={plan.testing.lastTest} onChange={(e) => set({ ...plan, testing: { ...plan.testing, lastTest: e.target.value } })} />}</Field>
              <Field label="Next test">{(id) => <Input id={id} type="date" value={plan.testing.nextTest} onChange={(e) => set({ ...plan, testing: { ...plan.testing, nextTest: e.target.value } })} />}</Field>
              <Field label="Exercise type">{(id) => <Input id={id} value={plan.testing.exerciseType} onChange={(e) => set({ ...plan, testing: { ...plan.testing, exerciseType: e.target.value } })} />}</Field>
              <Field label="Notes" optional>{(id) => <Input id={id} value={plan.testing.notes} onChange={(e) => set({ ...plan, testing: { ...plan.testing, notes: e.target.value } })} />}</Field>
            </div>
          </Section>
        </>
      )}

      {tab === 'plan' && (
        <>
          {checks.length > 0 && <Notice tone="warn" title="Before approval"><ul className="list-disc pl-5">{checks.map((c) => <li key={c}>{c}</li>)}</ul></Notice>}
          <div className="mb-4 flex flex-wrap gap-2 print:hidden">
            <Button onClick={() => window.print()} icon={Printer} tip="Print or save the plan as PDF">Print</Button>
            <Button variant="secondary" icon={FileText} onClick={() => download('PSCP_CDRRMO_Ormoc.md', md, 'text/markdown')} tip="Download the plan as Markdown, to paste into a new Library version">Download Markdown</Button>
            <Button variant="secondary" icon={Download} onClick={() => download('PSCP_CDRRMO_Ormoc.json', JSON.stringify(plan, null, 2))} tip="Download the workbench data">Export data</Button>
            <Button variant="secondary" icon={Trash2} onClick={() => { if (window.confirm('Replace this draft with the starting CDRRMO draft?')) set(starterPscp()); }} tip="Start again from the CDRRMO starting draft">Reset</Button>
          </div>
          <article className="rounded-sheet border border-line bg-surface p-5"><Markdown source={md} /></article>
        </>
      )}
    </div>
  );
}

function FunctionCard({ f, onChange, onRemove }: { f: EssentialFunction; onChange: (f: EssentialFunction) => void; onRemove: () => void }) {
  const num = (v: string) => (v === '' ? null : Math.max(0, Number(v)));
  const bad = f.rtoHours != null && f.mtpdHours != null && f.rtoHours > f.mtpdHours;
  return (
    <div className={clsx('rounded-control border bg-surface p-3', bad ? 'border-bad' : 'border-line')}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_9rem]">
        <Field label="Function">{(id) => <Input id={id} value={f.name} onChange={(e) => onChange({ ...f, name: e.target.value })} />}</Field>
        <Field label="Owner">{(id) => <Input id={id} value={f.owner} onChange={(e) => onChange({ ...f, owner: e.target.value })} />}</Field>
        <Field label="Priority">{(id) => <Select id={id} value={f.priority} onChange={(e) => onChange({ ...f, priority: +e.target.value as 1 | 2 | 3 })}>
          <option value={1}>1 Mission-critical</option><option value={2}>2 Essential</option><option value={3}>3 Deferrable</option></Select>}</Field>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="MTPD (h)">{(id) => <Input id={id} type="number" min={0} step="0.5" value={f.mtpdHours ?? ''} onChange={(e) => onChange({ ...f, mtpdHours: num(e.target.value) })} />}</Field>
        <Field label="RTO (h)" error={bad ? 'Longer than the MTPD' : undefined}>{(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="0.5" value={f.rtoHours ?? ''} onChange={(e) => onChange({ ...f, rtoHours: num(e.target.value) })} />}</Field>
        <Field label="RPO (h)">{(id) => <Input id={id} type="number" min={0} step="0.5" value={f.rpoHours ?? ''} onChange={(e) => onChange({ ...f, rpoHours: num(e.target.value) })} />}</Field>
        <Field label="Minimum staff">{(id) => <Input id={id} type="number" min={0} value={f.minStaff ?? ''} onChange={(e) => onChange({ ...f, minStaff: num(e.target.value) })} />}</Field>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1"><Field label="Dependencies (people, power, ICT, facilities, suppliers)">{(id) => <Input id={id} value={f.dependencies} onChange={(e) => onChange({ ...f, dependencies: e.target.value })} />}</Field></div>
        <Button variant="secondary" icon={Trash2} onClick={onRemove} tip="Remove this function">Remove</Button>
      </div>
    </div>
  );
}

function RiskMatrix({ plan }: { plan: Pscp }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-center text-xs" aria-label="Risk matrix: likelihood across, impact down">
        <thead><tr><th className="p-1" />{[1, 2, 3, 4, 5].map((l) => <th key={l} className="p-1 font-semibold">L{l}</th>)}</tr></thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((imp) => (
            <tr key={imp}>
              <th className="p-1 font-semibold">I{imp}</th>
              {[1, 2, 3, 4, 5].map((l) => {
                const s = l * imp; const here = plan.risks.filter((r) => r.likelihood === l && r.impact === imp);
                return <td key={l} className={clsx('h-14 w-20 border border-line p-1 align-top', s >= 15 ? 'bg-bad-soft' : s >= 8 ? 'bg-warn-soft' : 'bg-ok-soft')}>
                  {here.map((r) => <span key={r.id} className="block truncate" title={r.hazard}>{r.hazard.split(/[ (]/)[0]}</span>)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ColDef<T> = { k: keyof T & string; l: string; options?: string[] };
function Rows<T extends Record<keyof T, string>>({ rows, onChange, blank, cols }: { rows: T[]; onChange: (rows: T[]) => void; blank: T; cols: ColDef<T>[] }) {
  // Selects only ever offer the column's own options, so the edited value keeps the row's type.
  const edit = (i: number, k: keyof T, v: string) => onChange(rows.map((x, j) => (j === i ? ({ ...x, [k]: v } as T) : x)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-control border border-line bg-surface p-2">
          {cols.map((c) => (
            <div key={c.k} className="min-w-[10rem] flex-1"><Field label={c.l}>{(id) => c.options
              ? <Select id={id} value={r[c.k]} onChange={(e) => edit(i, c.k, e.target.value)}>{c.options.map((o) => <option key={o}>{o}</option>)}</Select>
              : <Input id={id} value={r[c.k]} onChange={(e) => edit(i, c.k, e.target.value)} />}</Field></div>
          ))}
          <Button variant="secondary" icon={Trash2} onClick={() => onChange(rows.filter((_, k) => k !== i))} tip="Remove this row" aria-label="Remove row" />
        </div>
      ))}
      <Button variant="secondary" icon={Plus} onClick={() => onChange([...rows, { ...blank }])} tip="Add a row">Add</Button>
    </div>
  );
}
