import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Check, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { useAaParams, useNow } from '@/lib/hooks';
import { advanceDeclaration, disbursementProblem, fmtPeso, hoursBetween, nextDeadline, trancheOf } from '@/domain/aa';
import { duration, fmtDateTime, fromLocalInput, toLocalInput } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Select, Textarea, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { AaDisbursement, Declaration, DeclarationStatus, FundSource } from '@/types';
import { ChecklistSection } from './Checklist';
import { loadChecklist } from './actions';
import { DECL_STATUS, SOURCE } from './labels';

function Step({ n, title, state, children }: { n: number; title: string; state: 'done' | 'current' | 'future' | 'skipped'; children?: ReactNode }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span className={clsx('z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        state === 'done' ? 'bg-ok text-on-strong' : state === 'current' ? 'bg-ink text-paper' : 'bg-sunken text-muted')} aria-hidden>
        {state === 'done' ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className={clsx('font-bold', state === 'future' && 'text-muted')}>{title}<span className="sr-only">: {state}</span></p>
        {children && <div className="mt-2 space-y-3">{children}</div>}
      </div>
    </li>
  );
}

export function DeclarationPage() {
  const { id } = useParams();
  const { has } = useAuth();
  const toast = useToast();
  const params = useAaParams();
  const now = useNow();
  const data = useLiveQuery(async () => {
    const d = id ? await db.declarations.get(id) : undefined;
    if (!d) return null;
    return {
      d, hazard: await db.hazards.get(d.hazard_code), pdra: d.pdra_id ? await db.pdra_sessions.get(d.pdra_id) : undefined,
      actions: await db.aa_actions.where('declaration_id').equals(d.id).toArray(),
      disb: await db.aa_disbursements.where('declaration_id').equals(d.id).toArray(),
      allDisb: await db.aa_disbursements.toArray(), years: await db.aa_fund_years.toArray(),
    };
  }, [id]);
  const [input, setInput] = useState<Partial<Declaration>>({});
  const [error, setError] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  if (!data) return <Loading />;
  const { d } = data;
  const actor = has('cdrrmo_head', 'eoc_manager');
  const dl = nextDeadline(d, now);
  const order: DeclarationStatus[] = ['draft', 'requested', 'recommended', 'declared', 'lifted'];
  const reached = (s: DeclarationStatus) => order.indexOf(d.status) >= order.indexOf(s) && d.status !== 'withdrawn' && d.status !== 'not_recommended';
  const adopted = d.origin !== 'city_request';

  const go = async (to: DeclarationStatus, extra: Partial<Declaration> = {}) => {
    setError(null);
    try {
      const base = { ...d, ...extra } as Declaration;      // e.g. origin changes when adopting a provincial declaration
      const patch = advanceDeclaration(base, to, { ...input, ...extra }, new Date(), params);
      await save('declarations', { ...base, ...patch }, `Declaration: ${DECL_STATUS[to]}`);
      if (to === 'declared') {
        const n = await loadChecklist({ declarationId: d.id }, d.hazard_code);
        toast(`Declared. ${n} anticipatory actions loaded.`);
      } else toast(DECL_STATUS[to]);
      setInput({});
    } catch (e) { setError((e as Error).message); }
  };
  const recordReport = async () => {
    if (!input.report_reference?.trim()) { setError('Record the reference of the report sent to OCD.'); return; }
    await save('declarations', { ...d, report_submitted_at: new Date().toISOString(), report_reference: input.report_reference.trim(), costs_minimized_note: input.costs_minimized_note?.trim() || null }, 'Record 45-day report');
    toast('Report recorded'); setInput({});
  };
  const field = (k: keyof Declaration, label: string, hint?: string, area = false) => (
    <Field label={label} hint={hint}>{(fid, desc) => area
      ? <Textarea id={fid} aria-describedby={desc} value={(input[k] as string) ?? ''} onChange={(e) => setInput({ ...input, [k]: e.target.value })} />
      : <Input id={fid} aria-describedby={desc} value={(input[k] as string) ?? ''} onChange={(e) => setInput({ ...input, [k]: e.target.value })} />}</Field>
  );
  const used = data.disb.reduce((s, x) => s + Number(x.amount), 0);

  return (
    <div className="page">
      <PageHeader title={`State of Imminent Disaster: ${data.hazard?.name ?? d.hazard_code}`} back="/eoc/aa"
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={d.status === 'declared' ? 'bad' : 'info'}>{DECL_STATUS[d.status]}</Badge>
          Expected impact {fmtDateTime(d.expected_impact_at)}{hoursBetween(now, d.expected_impact_at) > 0 && `, in ${duration(hoursBetween(now, d.expected_impact_at))}`}</span>} />
      {dl && <Notice tone={dl.overdue ? 'bad' : 'warn'} title={dl.label}>{fmtDateTime(dl.due)}: {dl.overdue ? `overdue by ${duration(dl.hoursLeft)}` : `${duration(dl.hoursLeft)} left`}.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-10">
        <ol className="relative before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-line" aria-label="Declaration steps">
          <Step n={1} title="Pre-disaster risk assessment" state="done">
            {data.pdra ? <p className="text-sm"><TextLink tip="Open the PDRA this declaration is based on" to={`/eoc/aa/pdra/${data.pdra.id}`}>{data.pdra.forecast_source}</TextLink>, {fmtDateTime(data.pdra.conducted_at)}</p>
              : <p className="text-sm text-muted">{adopted ? 'Adopted from a higher-level declaration.' : 'No PDRA linked.'}</p>}
          </Step>
          <Step n={2} title="Request to RDRRMC VIII" state={adopted ? 'skipped' : d.requested_at ? 'done' : d.status === 'draft' ? 'current' : 'future'}>
            {d.requested_at && <p className="text-sm">Sent {fmtDateTime(d.requested_at)}. Recommendation due {fmtDateTime(d.rdrrmc_due_at)}.</p>}
            {d.status === 'draft' && actor && <>
              <p className="text-sm text-muted">The CDRRMC coordinates with RDRRMC VIII, which must recommend within {params.rdrrmc_reply_hours} hours (IRR Rule III Sec. 2).</p>
              <div className="flex flex-wrap gap-2"><Button tip="Record that the CDRRMC request went to RDRRMC VIII. Starts the 24-hour reply clock" onClick={() => go('requested')}>Record request sent</Button>
                <Button tip="Use the Province of Leyte or Region VIII declaration that already covers Ormoc" variant="secondary" onClick={() => go('declared', { origin: 'adopted_provincial', eo_number: input.eo_number ?? null })}>Adopt the provincial declaration</Button></div>
            </>}
          </Step>
          <Step n={3} title="RDRRMC recommendation" state={adopted ? 'skipped' : d.rdrrmc_responded_at ? 'done' : d.status === 'requested' ? 'current' : 'future'}>
            {d.rdrrmc_reference && <p className="text-sm">{d.status === 'not_recommended' ? 'Not recommended' : 'Recommended'}: {d.rdrrmc_reference}, {fmtDateTime(d.rdrrmc_responded_at)}</p>}
            {d.status === 'requested' && actor && <>
              {field('rdrrmc_reference', 'Recommendation reference', 'Resolution or memo number.')}
              <div className="flex flex-wrap gap-2"><Button tip="Record that RDRRMC VIII recommends the declaration" onClick={() => go('recommended')}>Recommended</Button><Button tip="Record that RDRRMC VIII does not recommend it. The City may still act early under its own authority" variant="secondary" onClick={() => go('not_recommended')}>Not recommended</Button></div>
            </>}
          </Step>
          <Step n={4} title="Mayor's Executive Order" state={reached('declared') ? 'done' : d.status === 'recommended' ? 'current' : 'future'}>
            {d.declared_at && <p className="text-sm">{d.eo_number ? `${d.eo_number}, ` : ''}declared {fmtDateTime(d.declared_at)}.</p>}
            {d.status === 'recommended' && actor && <>{field('eo_number', 'Executive Order number')}<Button tip="Record the Mayor’s Executive Order declaring the State of Imminent Disaster" onClick={() => go('declared')}>Record declaration</Button></>}
          </Step>
          <Step n={5} title="Anticipatory actions and funds" state={d.status === 'declared' ? 'current' : reached('lifted') ? 'done' : 'future'}>
            {reached('declared') && <p className="text-sm">{data.actions.filter((a) => a.status !== 'pending' && a.status !== 'in_progress').length} of {data.actions.length} actions closed. ₱{fmtPeso(used)} disbursed.</p>}
          </Step>
          <Step n={6} title="Lifting" state={d.lifted_at ? 'done' : d.status === 'declared' ? 'current' : 'future'}>
            {d.lifted_at && <p className="text-sm">{d.lifting_ground === 'hazard_occurred' ? 'Hazard occurred' : 'Projected impacts not met'}, {fmtDateTime(d.lifted_at)}. {d.lifting_basis}</p>}
            {d.status === 'declared' && actor && <>
              <ChoiceGroup legend="Ground for lifting" value={input.lifting_ground ?? null} onChange={(v) => setInput({ ...input, lifting_ground: v })}
                options={[{ value: 'hazard_occurred', label: 'The hazard occurred', detail: 'Shift to response and early recovery.' },
                  { value: 'impacts_not_met', label: 'Projected impacts not met', detail: 'Per the latest PDRA. Unused LDRRMF AA funds return to the Special Trust Fund.' }]} />
              {field('lifting_basis', 'Basis', 'Advisory, incident report, SitRep or PDRA reference.')}
              <Button tip="Record the lifting. Starts the 45-day deadline for the report to OCD" onClick={() => go('lifted')}>Record lifting</Button>
            </>}
          </Step>
          <Step n={7} title={`Report to OCD within ${params.report_days} days`} state={d.report_submitted_at ? 'done' : d.status === 'lifted' ? 'current' : 'future'}>
            {d.report_submitted_at && <p className="text-sm">Submitted {fmtDateTime(d.report_submitted_at)}: {d.report_reference}</p>}
            {d.status === 'lifted' && !d.report_submitted_at && actor && <>
              <p className="text-sm text-muted">Cover the declaration status, AA fund use and estimated economic and social costs minimized (RA 12287 Sec. 8).</p>
              {field('costs_minimized_note', 'Estimated costs minimized', undefined, true)}
              {field('report_reference', 'Report reference')}
              <Button tip="Record that the post-declaration report was sent to OCD" onClick={recordReport}>Record report sent</Button>
            </>}
          </Step>
          {['draft', 'requested', 'recommended', 'not_recommended'].includes(d.status) && actor && (
            <li className="pl-12 pt-2"><Button tip="Withdraw this request, for example when the forecast changes" variant="quiet" onClick={() => go('withdrawn')}>Withdraw this request</Button></li>
          )}
        </ol>

        <div>
          {data.actions.length > 0 ? <ChecklistSection actions={data.actions} /> : reached('declared') ? (
            <Section title="Anticipatory actions"><Button tip="Add the anticipatory action checklist (from IRR Rule IV) for this hazard" onClick={async () => toast(`${await loadChecklist({ declarationId: d.id }, d.hazard_code)} actions loaded`)}>Load the checklist</Button></Section>
          ) : <Section title="Anticipatory actions"><p className="text-muted">The IRR Rule IV checklist loads when the declaration is recorded.</p></Section>}
          <Section title="Funds released" action={d.status === 'declared' && has('cdrrmo_head') && <Button tip="Record a release of anticipatory action funds. The tranche limits are checked" variant="secondary" icon={Plus} onClick={() => setFundOpen(true)}>Record disbursement</Button>}>
            {data.disb.length === 0 ? <p className="text-muted">No disbursement recorded.</p> : (
              <List>{data.disb.map((x) => <ListRow key={x.id} title={`₱${fmtPeso(Number(x.amount))} ${x.purpose}`}
                meta={`${SOURCE[x.source]}. Intervention ${fmtDateTime(x.intervention_at)}`}
                trailing={x.source === 'ldrrmf_aa' && <Badge>{x.tranche === 'beyond_threshold' ? 'Beyond 3 days' : 'Within 3 days'}</Badge>} />)}</List>
            )}
            <p className="mt-2 text-sm"><TextLink tip="Open the fund status for the year" to="/eoc/aa/funds">See the fund status for the year</TextLink></p>
          </Section>
        </div>
      </div>
      <FundSheet open={fundOpen} onClose={() => setFundOpen(false)} decl={d} existing={data.allDisb} years={data.years} />
    </div>
  );
}

function FundSheet({ open, onClose, decl, existing, years }: { open: boolean; onClose: () => void; decl: Declaration; existing: AaDisbursement[]; years: import('@/types').AaFundYear[] }) {
  const params = useAaParams();
  const toast = useToast();
  const [f, setF] = useState({ source: 'ldrrmf_aa' as FundSource, amount: '', purpose: '', intervention_at: toLocalInput(), obligation_ref: '' });
  // The fiscal year follows the intervention date in Manila time (the server derives it the same way).
  const fiscalYear = Number(f.intervention_at.slice(0, 4));
  const amount = Number(f.amount);
  const year = years.find((y) => y.fiscal_year === fiscalYear);
  const iso = fromLocalInput(f.intervention_at);
  const { lead, tranche } = trancheOf(decl.expected_impact_at, iso, params);
  const problem = f.amount ? disbursementProblem({ source: f.source, amount, intervention_at: iso, fiscal_year: fiscalYear }, decl, year, existing, params) : null;
  const add = async () => {
    if (problem || !f.purpose.trim()) return;
    const row: AaDisbursement & { _new: true } = { _new: true, id: uuid(), declaration_id: decl.id, fiscal_year: fiscalYear, source: f.source, amount, purpose: f.purpose.trim(),
      intervention_at: iso, lead_hours: lead, tranche, obligation_ref: f.obligation_ref.trim() || null, version: 1 };
    await save('aa_disbursements', row, `Disbursement ₱${fmtPeso(amount)}`);
    onClose(); toast('Disbursement recorded');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Record disbursement"
      footer={<><Button tip="Close without recording" variant="secondary" onClick={onClose}>Cancel</Button><Button tip="Record this disbursement" disabled={!!problem || !(amount > 0) || !f.purpose.trim()} onClick={add}>Record disbursement</Button></>}>
      <Field label="Source">{(id) => <Select id={id} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as FundSource })}>
        {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₱)">{(id) => <Input id={id} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
        <Field label="Fiscal year" hint="From the intervention date.">{(id, d) => <Input id={id} aria-describedby={d} value={String(fiscalYear || '')} readOnly />}</Field>
      </div>
      <Field label="Purpose">{(id) => <Input id={id} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />}</Field>
      <Field label="When the intervention is carried out" hint={lead >= 0 ? `${duration(lead)} before expected impact: ${tranche === 'beyond_threshold' ? 'beyond' : 'within'} the 3-day threshold.` : 'After the expected impact.'}>
        {(id, d) => <Input id={id} aria-describedby={d} type="datetime-local" value={f.intervention_at} onChange={(e) => setF({ ...f, intervention_at: e.target.value })} />}</Field>
      <Field label="Obligation or voucher reference" optional>{(id) => <Input id={id} value={f.obligation_ref} onChange={(e) => setF({ ...f, obligation_ref: e.target.value })} />}</Field>
      {f.source !== 'ldrrmf_aa' && <p className="text-sm text-muted">The 30%/70% graduation applies only to the LDRRMF anticipatory action allocation (RA 12287 Sec. 10).</p>}
      {problem && <p role="alert" className="font-semibold text-bad">{problem}</p>}
    </Sheet>
  );
}
