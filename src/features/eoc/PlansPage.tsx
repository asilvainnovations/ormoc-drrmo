import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { callOnline, updateOnline } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { useAuth } from '@/lib/auth';
import { canChangeLevel, currentLevel, LEVEL_INFO } from '@/domain/eoc';
import { activatedState } from '@/domain/structure';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { Badge, Button, EmptyState, KeyValue, List, ListRow, Notice, PageHeader, Section, Select, Tabs, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import type { ActivationCluster, ContingencyPlan } from '@/types';
import { EOC_TABS, ITEM_STATE, ITEM_TONE, MODULE, PLAN_STATUS, PLAN_TONE } from './labels';

/**
 * Contingency plans and response clusters (ADR-017). Activating a plan opens its clusters and EOC modules on the
 * current activation; items whose minimum level is above the current level wait on standby. Needs a connection.
 */
export function PlansPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const manage = canChangeLevel(roles);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => {
    const { level, activation } = currentLevel(await db.eoc_activations.toArray());
    const plans = (await db.contingency_plans.toArray()).sort((a, b) => a.code.localeCompare(b.code));
    const items = await db.cp_activation_items.toArray();
    const clusters = (await db.response_clusters.toArray()).sort((a, b) => a.sort - b.sort);
    const offices = new Map((await db.offices.toArray()).map((o) => [o.id, o]));
    const active = activation ? await db.activation_clusters.where('activation_id').equals(activation.id).toArray() : [];
    const hazards = new Map((await db.hazards.toArray()).map((h) => [h.code, h]));
    return { level, activation, plans, items, clusters, offices, active, hazards };
  }, []);
  if (!data) return null;
  const clusterName = new Map(data.clusters.map((c) => [c.code, c.name]));
  const itemName = (kind: string, code: string) => (kind === 'cluster' ? clusterName.get(code) ?? code : MODULE[code] ?? code);
  const activePlan = data.activation?.plan_id ? data.plans.find((p) => p.id === data.activation!.plan_id) : undefined;
  const open = data.plans.find((p) => p.id === openId) ?? null;

  const activate = async (p: ContingencyPlan) => {
    setBusy(true);
    try {
      await callOnline('activate_contingency_plan', { p_plan: p.id }, 'Activating a contingency plan');
      await syncNow({ only: ['eoc_activations', 'activation_clusters', 'logbook_entries'] });
      setOpenId(null); toast(`Activated ${p.code}`);
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const setState = async (c: ActivationCluster, state: ActivationCluster['state']) => {
    try { await updateOnline('activation_clusters', c, { state }, 'Changing a cluster'); toast(`${itemName(c.item_kind, c.item_code)}: ${ITEM_STATE[state].toLowerCase()}`); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  const sortItems = <T extends { item_kind: string; item_code: string }>(xs: T[]) =>
    [...xs].sort((a, b) => a.item_kind.localeCompare(b.item_kind) || itemName(a.item_kind, a.item_code).localeCompare(itemName(b.item_kind, b.item_code)));

  return (
    <div className="page">
      <PageHeader title="Contingency Plans and Clusters" subtitle="Each hazard's contingency plan says which response clusters and EOC modules open. Activation needs a connection and the EOC Manager or CDRRMO Head." />
      <Tabs items={EOC_TABS} />

      <Section title="This activation">
        {!data.activation ? <Notice tone="info" title="White level">Raise the EOC to Blue or Red on the Board first. A plan is activated on an open activation.</Notice> : <>
          <p className="mb-3">{LEVEL_INFO[data.level].name} level since {fmtDateTime(data.activation.started_at)}.{' '}
            {activePlan ? <>Plan in use: <span className="font-semibold">{activePlan.code} {activePlan.title}</span>.</> : 'No contingency plan activated yet.'}</p>
          {activePlan && activePlan.status !== 'adopted' && <Notice tone="warn" title="The plan is not adopted">Its activation set is a draft until the CDRRMC adopts the plan.</Notice>}
          {data.active.length > 0 ? (
            <List>
              {sortItems(data.active).map((c) => (
                <ListRow key={c.id} title={itemName(c.item_kind, c.item_code)} meta={`${c.item_kind === 'cluster' ? 'Response cluster' : 'EOC module'}. Changed ${fmtDateTime(c.changed_at)}`}
                  trailing={manage && !data.activation!.ended_at
                    ? <Select aria-label={`State of ${itemName(c.item_kind, c.item_code)}`} {...tip('Change this cluster or module (EOC Manager or CDRRMO Head; needs a connection)')}
                        className="!min-h-0 !w-40 py-1.5" value={c.state} onChange={(e) => setState(c, e.target.value as ActivationCluster['state'])}>
                        {(['lead', 'on', 'standby', 'stood_down'] as const).map((s) => <option key={s} value={s}>{ITEM_STATE[s]}</option>)}
                      </Select>
                    : <Badge tone={ITEM_TONE[c.state]}>{ITEM_STATE[c.state]}</Badge>} />
              ))}
            </List>
          ) : <p className="text-sm text-muted">No clusters or modules are open on this activation.</p>}
          {/* 1.21.0 (ADR-036): the desk of each activated response cluster is its lead agency's
              seat in the EOC (WF-CP-ACTIVATION, B4.4). */}
          {(() => {
            const desks = data.active
              .filter((c) => c.item_kind === 'cluster' && (c.state === 'lead' || c.state === 'on'))
              .map((c) => {
                const cluster = data.clusters.find((x) => x.code === c.item_code);
                return { id: c.id, name: itemName(c.item_kind, c.item_code), lead: cluster?.lead_office_id ? data.offices.get(cluster.lead_office_id)?.name : null };
              })
              .filter((d) => d.lead);
            return desks.length > 0 && (
              <div className="mt-3 rounded-control border border-line bg-sky-soft/40 p-3">
                <p className="mb-1.5 text-sm font-semibold">Agency desks in this activation</p>
                <ul className="space-y-1 text-sm">
                  {desks.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-right text-muted">{d.lead}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </>}
      </Section>

      <Section title="Contingency plans">
        {data.plans.length === 0 ? <EmptyState title="No plans yet" body="They arrive with the EOC structure data (operational file 06)." /> : (
          <List>
            {data.plans.map((p) => (
              <ListRow key={p.id} tip="See the plan's triggers and activation set" onClick={() => setOpenId(p.id)} title={`${p.code} ${p.title}`}
                meta={[p.adopted_ref, p.valid_until && `Valid until ${fmtDate(p.valid_until)}`].filter(Boolean).join('. ') || undefined}
                trailing={<span className="flex gap-1.5">{activePlan?.id === p.id && <Badge tone="ok">In use</Badge>}<Badge tone={PLAN_TONE[p.status]}>{PLAN_STATUS[p.status]}</Badge></span>} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Response clusters">
        <List>
          {data.clusters.map((c) => (
            <ListRow key={c.id} title={c.name} meta={[c.lead_office_id && `Lead: ${data.offices.get(c.lead_office_id)?.name ?? ''}`, c.national_lead && `National lead: ${c.national_lead}`].filter(Boolean).join('. ') || undefined} />
          ))}
        </List>
      </Section>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.code} ${open.title}` : ''}
        footer={open && (manage
          ? <Button tip="Open this plan's clusters and modules on the current activation (EOC Manager or CDRRMO Head; needs a connection)"
              disabled={busy || !data.activation || open.status === 'retired'} onClick={() => activate(open)}>{activePlan?.id === open.id ? 'Activate again' : 'Activate plan'}</Button>
          : <p className="text-sm text-muted">The EOC Manager or CDRRMO Head activates a plan.</p>)}>
        {open && <>
          {!data.activation && <Notice tone="info">Raise the EOC to Blue or Red first.</Notice>}
          {open.status === 'expired' && <Notice tone="warn" title="Expired">This plan has passed its validity date. It can still guide the response; update and re-adopt it.</Notice>}
          {open.status === 'to_prepare' && <Notice tone="warn" title="Not yet prepared">This plan is in the DRRM plan's list of plans to prepare. Its activation set is a working draft.</Notice>}
          <KeyValue items={[
            ['Status', PLAN_STATUS[open.status]],
            ['Hazard', open.hazard_code ? data.hazards.get(open.hazard_code)?.name ?? open.hazard_code : '—'],
            ['Adopted', open.adopted_ref ? `${open.adopted_ref}${open.adopted_on ? `, ${fmtDate(open.adopted_on)}` : ''}` : '—'],
            ['Valid until', fmtDate(open.valid_until)],
            ['Warning time', open.warning_time ?? '—'],
          ]} />
          {open.scenario && <p className="mt-3"><span className="font-semibold">Scenario: </span>{open.scenario}</p>}
          {open.activation_triggers && <p className="mt-2"><span className="font-semibold">Triggers: </span>{open.activation_triggers}</p>}
          {open.vault_document_id && <p className="mt-2 text-sm">Plan document: <TextLink tip="Open the plan in the Vault" to={`/vault/d/${open.vault_document_id}`}>open in the Vault</TextLink></p>}
          <h3 className="mt-4 font-semibold">Activation set</h3>
          <ul className="space-y-1.5">
            {sortItems(data.items.filter((i) => i.plan_id === open.id)).map((i) => {
              const now = data.activation ? activatedState(i, data.level) : null;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">{itemName(i.item_kind, i.item_code)}<span className="block text-xs text-muted">From {LEVEL_INFO[i.min_level].name}{i.note ? `. ${i.note}` : ''}</span></span>
                  <Badge tone={ITEM_TONE[i.state]}>{ITEM_STATE[i.state]}</Badge>
                  {now && now !== i.state && <Badge tone="info">Standby at {LEVEL_INFO[data.level].name}</Badge>}
                </li>
              );
            })}
          </ul>
        </>}
      </Sheet>
    </div>
  );
}
