/**
 * EOC modules on now (1.33.0): the current activation's row of Figure 1.7 (MOO Consolidated Draft 1.0), as the server holds it,
 * with the clusters seated and the plan behind it. The EOC Manager or the CDRRMO Head activates a plan on the Responsible
 * Official's authority (NDRP; NDRRMC Memorandum No. 131, s. 2018, sec. 9.2): online only, two taps, logged.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Layers } from 'lucide-react';
import { db } from '@/lib/db';
import { callOnline } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { Badge, Button, Field, Input, Notice } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { canChangeLevel, LEVEL_INFO } from '@/domain/eoc';
import { manilaToday } from '@/domain/structure';
import {
  hasModuleSet, liveModules, MODULE_HEADING, MODULE_ORDER, planStatusNote, seatedClusters, suggestPlans, type LiveState,
} from '@/domain/scenarios';
import type { Activation, ContingencyPlan } from '@/types';
import { Block } from './kit';
import { PLAN_STATUS, PLAN_TONE } from './labels';

/** Tile colours follow Figure 1.7: navy for on, light blue for lead clusters, outlined for standby, grey dash for not used. */
export const CELL_STYLE: Record<LiveState, string> = {
  on: 'border-action bg-action text-on-action',
  lead: 'border-sky bg-sky-soft text-ink',
  standby: 'border-dashed border-action bg-surface text-ink',
  stood_down: 'border-line bg-sunken text-muted line-through',
  off: 'border-line bg-sunken text-muted',
};
export const CELL_LABEL: Record<LiveState, string> = { on: 'On', lead: 'Lead clusters', standby: 'Standby', stood_down: 'Stood down', off: '–' };

export function ModulesPanel({ activation }: { activation: Activation | null }) {
  const { roles } = useAuth();
  const [open, setOpen] = useState(false);
  const data = useLiveQuery(async () => {
    if (!activation) return null;
    const items = await db.activation_clusters.where('activation_id').equals(activation.id).toArray();
    const plan = activation.plan_id ? (await db.contingency_plans.get(activation.plan_id)) ?? null : null;
    return { items, plan, clusters: await db.response_clusters.toArray() };
  }, [activation?.id, activation?.plan_id]);
  if (!activation) return null;
  const live = liveModules(data?.items ?? []);
  const seated = seatedClusters(data?.items ?? [], data?.clusters ?? []);
  const plan = data?.plan ?? null;
  const can = canChangeLevel(roles);

  return (
    <Block title="EOC Modules On Now" className="mb-5"
      action={<span className="flex flex-wrap gap-2">
        <Link to="/eoc/plans" {...tip('See every scenario and the modules it switches on (Manual Figure 1.7)')} className="inline-flex min-h-tap items-center px-2 text-sm font-semibold underline">All scenarios</Link>
        {can && <Button variant="secondary" icon={Layers} onClick={() => setOpen(true)} tip="Switch on the modules and clusters of a contingency plan for this activation (needs a connection)">{plan ? 'Change plan' : 'Activate plan'}</Button>}
      </span>}>
      {plan ? (
        <p className="mb-3 text-sm">
          <Link to={`/eoc/plans/${encodeURIComponent(plan.code)}`} className="font-semibold underline" {...tip('Open the plan, its scenario and its contingency plan template')}>{plan.title}</Link>{' '}
          <Badge tone={PLAN_TONE[plan.status]}>{PLAN_STATUS[plan.status]}</Badge>
          <span className="block text-xs text-muted">{planStatusNote(plan, manilaToday())}</span>
        </p>
      ) : (
        <Notice tone="warn" title="No contingency plan activated">
          The EOC is at {LEVEL_INFO[activation.level].name} level without a plan, so no modules or clusters are switched on in MODE. {can ? 'Activate the plan for this hazard.' : 'The EOC Manager or the CDRRMO Head activates it.'}
        </Notice>
      )}
      {hasModuleSet(data?.items ?? []) && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="EOC modules">
          {MODULE_ORDER.map((m) => (
            <li key={m} className={clsx('flex min-h-[4.25rem] flex-col justify-between rounded-control border px-2 py-1.5', CELL_STYLE[live[m]])}
              aria-label={`${MODULE_HEADING[m]}: ${CELL_LABEL[live[m]]}`}>
              <span className="text-xs font-bold leading-tight">{MODULE_HEADING[m]}</span>
              <span className="font-data text-sm font-extrabold">{CELL_LABEL[live[m]]}</span>
            </li>
          ))}
        </ul>
      )}
      {(seated.lead.length + seated.on.length + seated.standby.length) > 0 && (
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
          <div><dt className="font-semibold">Lead clusters</dt><dd>{seated.lead.map((c) => c.name).join(', ') || 'None'}</dd></div>
          <div><dt className="font-semibold">Clusters activated</dt><dd>{seated.on.map((c) => c.name).join(', ') || 'None'}</dd></div>
          <div><dt className="font-semibold">On standby</dt><dd>{seated.standby.map((c) => c.name).join(', ') || 'None'}</dd></div>
        </dl>
      )}
      <p className="mt-2 text-xs text-muted">At Blue only Planning, the PDRA and AA desk and the Logistics lead are seated; the rest wait on standby until Red (Table 1.12). Proposed until the CDRRMC adopts each plan.</p>
      <ActivatePlanSheet open={open} onClose={() => setOpen(false)} activation={activation} current={plan} />
    </Block>
  );
}

function ActivatePlanSheet({ open, onClose, activation, current }: { open: boolean; onClose: () => void; activation: Activation; current: ContingencyPlan | null }) {
  const toast = useToast();
  const online = useOnline();
  const plans = useLiveQuery(() => db.contingency_plans.orderBy('code').toArray(), [], []);
  const hazards = useLiveQuery(() => db.hazards.toArray(), [], []);
  const [choice, setChoice] = useState<string | null>(null);
  const [authority, setAuthority] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggested = suggestPlans(plans, activation.hazard_code);
  const others = plans.filter((p) => p.status !== 'retired' && !suggested.some((s) => s.id === p.id));
  const chosen = plans.find((p) => p.id === choice) ?? null;
  const hazardName = hazards.find((h) => h.code === activation.hazard_code)?.name;

  const activate = async () => {
    if (!chosen || !authority.trim()) return;
    if (!armed) { setArmed(true); return; }
    setArmed(false); setBusy(true);
    try {
      await callOnline<string>('activate_contingency_plan', { p_plan: chosen.id, p_authority: authority.trim() }, 'Activating a contingency plan');
      await syncNow({ only: ['eoc_activations', 'activation_clusters', 'logbook_entries'] });
      toast(`${chosen.code} activated: modules and clusters set from the plan`);
      setAuthority(''); setChoice(null); onClose();
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const row = (p: ContingencyPlan) => (
    <label key={p.id} {...tip(`Choose ${p.code}: its modules and clusters are switched on for this activation`)}
      className={clsx('flex min-h-tap cursor-pointer items-start gap-3 rounded-control border px-3 py-2', choice === p.id ? 'border-accent bg-sky-soft' : 'border-line')}>
      <input type="radio" name="plan" className="mt-1" checked={choice === p.id} onChange={() => { setChoice(p.id); setArmed(false); }} />
      <span className="min-w-0">
        <span className="block font-semibold">{p.title}{current?.id === p.id && <span className="ml-1 text-xs text-muted">(current)</span>}</span>
        <span className="block text-xs text-muted">{p.code} · <Badge tone={PLAN_TONE[p.status]}>{PLAN_STATUS[p.status]}</Badge> · {p.warning_time ? `Warning time: ${p.warning_time}` : ''}</span>
      </span>
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Activate a Contingency Plan"
      footer={<>
        <Button variant="secondary" tip="Close without activating" onClick={onClose}>Cancel</Button>
        <Button busy={busy} disabled={!chosen || !authority.trim() || !online} onClick={() => void activate()} onBlur={() => setArmed(false)}
          tip={armed ? 'Select again to activate the plan now' : 'Activate the chosen plan. You are asked to select again to confirm. Needs a connection'}>
          {armed ? 'Select again to activate' : 'Activate plan'}
        </Button></>}>
      <div className="space-y-3">
        <p className="text-sm">The plan switches on its EOC modules and clusters for this {LEVEL_INFO[activation.level].name} activation. Modules the plan seats from Red stay on standby at Blue.</p>
        {!online && <Notice tone="warn">Activating a plan needs a connection.</Notice>}
        {suggested.length > 0 && <fieldset><legend className="mb-1 font-semibold">For {hazardName ?? 'this hazard'}</legend><div className="space-y-2">{suggested.map(row)}</div></fieldset>}
        {!activation.hazard_code && <Notice tone="info">No hazard was named when the level was raised, so no plan is suggested. Choose one below.</Notice>}
        <fieldset><legend className="mb-1 font-semibold">{suggested.length ? 'Other plans' : 'Plans'}</legend><div className="space-y-2">{others.map(row)}</div></fieldset>
        {chosen && chosen.status !== 'adopted' && <Notice tone="warn">{planStatusNote(chosen, manilaToday())}</Notice>}
        <Field label="Authority" tip="Whose decision activates the plan" hint="Whose decision this records, for example “Mayor’s instruction, 08:10” or a CDRRMC resolution. The Responsible Official approves activation (NDRRMC Memorandum No. 131, s. 2018). Written in the logbook.">
          {(id, d) => <Input id={id} aria-describedby={d} maxLength={200} value={authority} onChange={(e) => { setAuthority(e.target.value); setArmed(false); }} />}
        </Field>
      </div>
    </Sheet>
  );
}
