/**
 * Scenarios (1.33.0): Figure 1.7 of the Manual, "EOC Modules Activated by Contingency Scenario", drawn from the plans' activation
 * sets in MODE, with the current plan highlighted. Each plan opens its scenario, triggers, clusters and its contingency plan
 * template (NDRRMC-OCD Contingency Planning Guidebook, Feb 2020) as a workbook.
 */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { useEocStatus } from '@/lib/hooks';
import { downloadWorkbook } from '@/lib/xlsx';
import { tip } from '@/components/Tooltip';
import { Badge, Button, EmptyState, KeyValue, Loading, Notice, PageHeader, Section, Tabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { manilaToday } from '@/domain/structure';
import { FAMILY_UNITY_RULES } from '@/domain/echo';
import { MODULE_HEADING, MODULE_ORDER, planRow, planStatusNote, SCENARIO_ROWS } from '@/domain/scenarios';
import { buildCpWorkbook, cpFileName, planClusters, usesForm3B } from '@/domain/contingencyPlan';
import { CSWD_DISTRICTS } from './cswdDistricts';
import { CELL_LABEL, CELL_STYLE } from './ModulesPanel';
import { EOC_TABS, PLAN_STATUS, PLAN_TONE } from './labels';

export function ScenariosPage() {
  const { activation } = useEocStatus();
  const data = useLiveQuery(async () => ({ plans: await db.contingency_plans.toArray(), items: await db.cp_activation_items.toArray() }), []);
  if (!data) return <Loading />;
  const order = new Map(SCENARIO_ROWS.map((r, k) => [r.code, k]));
  const plans = data.plans.filter((p) => p.status !== 'retired').sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99) || a.code.localeCompare(b.code));
  const label = (code: string, title: string) => SCENARIO_ROWS.find((r) => r.code === code)?.label ?? title;
  return (
    <div className="page">
      <PageHeader title="Scenarios" subtitle="EOC modules each contingency plan switches on (Manual Figure 1.7). Proposed until the CDRRMC adopts each plan." />
      <Tabs items={EOC_TABS} />
      {plans.length === 0 ? <EmptyState title="No contingency plans on this device" body="They arrive with the EOC structure data (operational file 06)." /> : (
        <div className="overflow-x-auto rounded-sheet border border-line bg-surface p-3 shadow-raised">
          <table className="w-full min-w-[56rem] border-separate border-spacing-1 text-sm">
            <caption className="sr-only">EOC modules activated by contingency scenario</caption>
            <thead><tr>
              <th scope="col" className="w-56 text-left text-xs text-muted">Scenario</th>
              {MODULE_ORDER.map((m) => <th key={m} scope="col" className="px-1 align-bottom text-xs font-bold">{MODULE_HEADING[m]}</th>)}
            </tr></thead>
            <tbody>
              {plans.map((p) => {
                const row = planRow(data.items, p.id);
                const current = activation?.plan_id === p.id;
                return (
                  <tr key={p.id} className={clsx(current && 'outline outline-2 outline-accent')}>
                    <th scope="row" className="pr-2 text-right font-semibold">
                      <Link to={`/eoc/plans/${encodeURIComponent(p.code)}`} className="underline" {...tip(`Open ${p.code}: scenario, triggers, clusters and the contingency plan template`)}>{label(p.code, p.title)}</Link>
                      <span className="block text-xs font-normal text-muted">{PLAN_STATUS[p.status]}{current ? ' · current activation' : ''}</span>
                    </th>
                    {MODULE_ORDER.map((m) => (
                      <td key={m} className={clsx('h-12 rounded-control border text-center font-semibold', CELL_STYLE[row[m]])}>{CELL_LABEL[row[m]]}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">“Lead clusters” means only the clusters that lead the scenario are seated. Each contingency plan sets its exact triggers. The PDRA and AA desk, cluster desks, Barangay Liaison Desk and building assessment are City arrangements, not national requirements.</p>
        </div>
      )}
    </div>
  );
}

export function PlanPage() {
  const { code = '' } = useParams();
  const toast = useToast();
  const { activation } = useEocStatus();
  const data = useLiveQuery(async () => {
    const plan = (await db.contingency_plans.toArray()).find((p) => p.code === decodeURIComponent(code)) ?? null;
    if (!plan) return { plan: null };
    return {
      plan, items: (await db.cp_activation_items.toArray()).filter((i) => i.plan_id === plan.id), clusters: await db.response_clusters.toArray(),
      hazards: await db.hazards.toArray(), offices: await db.offices.toArray(), positions: await db.eoc_positions.toArray(),
      designations: await db.eoc_designations.toArray(), points: await db.geo_reference_points.toArray(), barangays: await db.barangays.toArray(),
      centres: await db.evacuation_centers.toArray(),
    };
  }, [code]);
  const today = manilaToday();
  const input = useMemo(() => (data?.plan ? {
    plan: data.plan, items: data.items!, clusters: data.clusters!, hazards: data.hazards!, offices: data.offices!, positions: data.positions!,
    designations: data.designations!, barangays: data.barangays!, centres: data.centres!, today,
    eocPoint: data.points!.find((p) => p.kind === 'eoc' && p.verification_status !== 'superseded') ?? null,
    districts: CSWD_DISTRICTS.map((d) => ({ code: d.code, coordinatorTitle: d.coordinatorTitle, barangays: d.barangays })),
  } : null), [data, today]);
  if (data === undefined) return <Loading />;
  if (!data.plan || !input) return <div className="page"><PageHeader title="Plan Not Found" back="/eoc/plans" /></div>;
  const plan = data.plan;
  const row = planRow(data.items!, plan.id);
  const cls = planClusters(input);
  const hz = (c: string) => data.hazards!.find((h) => h.code === c)?.name ?? c;
  const covers = [...new Set([plan.hazard_code, ...(plan.hazard_codes ?? [])].filter((x): x is string => !!x))];
  const download = () => {
    try { downloadWorkbook(cpFileName(plan, today), buildCpWorkbook(input)); toast(`Template downloaded: ${cpFileName(plan, today)}`); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  return (
    <div className="page">
      <PageHeader title={plan.title} back="/eoc/plans" subtitle={`${plan.code} · ${SCENARIO_ROWS.find((r) => r.code === plan.code)?.label ?? plan.scenario ?? ''}`}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          <Button icon={Download} onClick={download} tip="Download the contingency plan template as an Excel workbook: one sheet per CP Form, with the Guidebook's formulas">Download CP template</Button>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()} tip="Print this page">Print</Button>
        </div>} />
      {activation?.plan_id === plan.id && <Notice tone="info">This plan is active on the current {activation.level === 'red' ? 'Red' : 'Blue'} activation.</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Plan" className="lg:col-span-2">
          <p className="mb-2"><Badge tone={PLAN_TONE[plan.status]}>{PLAN_STATUS[plan.status]}</Badge> <span className="text-sm">{planStatusNote(plan, today)}</span></p>
          <KeyValue items={[
            ['Hazards covered', covers.map(hz).join(', ') || 'None set'],
            ['Scenario', plan.scenario ?? '—'], ['Warning time', plan.warning_time ?? '—'],
            ['Activation triggers (proposed)', plan.activation_triggers ?? '—'],
            ['Adopted by', plan.adopted_ref ?? 'Not yet adopted'],
          ]} />
          <h3 className="mt-4 font-bold">EOC modules</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODULE_ORDER.map((m) => {
              const it = data.items!.find((i) => i.item_kind === 'module' && i.item_code === m);
              return <li key={m} className={clsx('rounded-control border px-2 py-1.5', CELL_STYLE[row[m]])}>
                <span className="block text-xs font-bold">{MODULE_HEADING[m]}</span>
                <span className="font-data text-sm font-extrabold">{CELL_LABEL[row[m]]}</span>
                {it && <span className="block text-[11px]">from {it.min_level === 'blue' ? 'Blue' : 'Red'}</span>}
              </li>;
            })}
          </ul>
          <h3 className="mt-4 font-bold">Clusters</h3>
          <ul className="mt-2 divide-y divide-line">
            {cls.map((c) => (
              <li key={c.cluster.code} className="py-2">
                <span className="font-semibold">{c.cluster.name}</span> <Badge tone={c.state === 'standby' ? 'neutral' : 'ok'}>{c.state === 'lead' ? 'Lead' : c.state === 'on' ? 'Activated' : 'On standby'}</Badge>
                {c.note && <span className="block text-sm text-muted">{c.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Contingency Plan Template">
          <p className="text-sm">The workbook follows the NDRRMC-OCD Contingency Planning Guidebook (February 2020): CP Forms 1, 2, {usesForm3B(plan) ? '3B' : '3A'}, 4A and 4B, 5, then 6, 7 and 8 for each of the {cls.length} clusters, 9, 10 and 11, Chapter IV and an annex on families staying together.</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Filled from MODE: hazards, clusters and lead offices, the EOC point and roster, barangays by CSWD district, the City evacuation centres and the activation set.</li>
            <li>Left for the planners: ratings, scenarios, populations, resources and costs. MODE never invents them.</li>
            <li>Formulas: the Form 1 average and rank, Form 4 totals, the Form 8 gap and all of Form 9.</li>
          </ul>
          <Button className="mt-3" icon={FileSpreadsheet} onClick={download} tip="Download the contingency plan template workbook">Download workbook</Button>
          <p className="mt-2 text-xs text-muted">The Working Group endorses; the CDRRMC Chairperson approves by formal issuance, as a living document. Counts only; no names of affected persons.</p>
        </Section>
      </div>
      {cls.some((c) => c.cluster.code === 'CCCM') && (
        <Section title="Families Stay Together">
          <ul className="space-y-1.5 text-sm">{FAMILY_UNITY_RULES.map((r) => <li key={r.key}>{r.text} <span className="text-xs text-muted">({r.ref})</span></li>)}</ul>
        </Section>
      )}
    </div>
  );
}
