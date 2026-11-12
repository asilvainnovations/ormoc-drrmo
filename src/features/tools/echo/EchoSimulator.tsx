// Tools → ECHO → Simulator (1.16.0, ADR-030). Built from the standalone "MODE ECHO Simulator" prototype (11 Nov 2026):
// the same eight modules, now on the MODE design system, with every benchmark tied to its own source (src/domain/echo.ts).
// Training and decision support only: the simulator never issues an evacuation order, certifies a centre as safe or
// replaces the City DRRMC, the City Government, DSWD or another responsible agency. No names of evacuees, patients or
// informants are entered anywhere; counts are aggregates and a blank is "not reported".
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Download, FileText, MapPinned, Plus, RotateCcw, Upload } from 'lucide-react';
import { db } from '@/lib/db';
import { uuid } from '@/lib/ids';
import { Badge, Button, ButtonLink, Checkbox, ChoiceGroup, EmptyState, Field, Input, Meter, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import {
  BENCHMARKS, HAZARDS, LEAD_TIMES, RA12076_CHECKS, SOURCES, bathingNeedJmc, exerciseAlerts, exercisePhase, fmt, importExercise, malesOf, movement,
  newExercise, populationProblems, scenarioPopulation, selectedSite, spaceCheck, toiletCheck, utilisation, waterCheck,
  type EchoModule, type Exercise, type SourceKey, type TrainingSite,
} from '@/domain/echo';
import { download } from '../storage';
import { ECHO_TABS, FEEDBACK, FEEDBACK_STATUS, MODULES, VERIFICATION } from './labels';
import { useExercise } from './useExercise';

// Checklists keep the prototype's keys (evac-0, service-0 ...), so an imported prototype exercise keeps its ticks.
export const EVAC_CHECKS = ['Official warning or trigger source checked and time-stamped', 'Barangay exposure and priority needs assessed',
  'Routes checked against current hazard information', 'Accessible vehicles and assistance teams assigned', 'Assembly points and reception teams confirmed',
  'Public information in accessible formats and the local language', 'Child protection and family reunification safeguards available',
  'Movement and reception counts reconciled, without names'];
export const SERVICE_CHECKS = ['Safe drinking water and water-quality monitoring', 'Toilets, bathing, handwashing and menstrual hygiene supplies',
  'Food, nutrition screening and infant-feeding support', 'Health services, medicines and referral', 'Child-friendly space and temporary learning arrangements',
  'Women-friendly space, privacy and GBV risk mitigation', 'Accessible routes, information and communication support',
  'Lighting, security, fire safety and safe feedback channels', 'Waste collection, drainage and environmental health', 'Community participation and regular camp coordination'];
export const PROTECT_CHECKS = ['Planning data by age, sex and disability; Indigenous Peoples where relevant', 'Women and diverse groups take part in camp governance',
  'Accessible routes, toilets, bathing and information', 'Filipino Sign Language and communication support where needed (RA 11106)',
  'Child-friendly space and the child protection referral pathway (RA 10821)', 'Women-friendly and breastfeeding spaces with privacy',
  'Confidential GBV response and referral protocols', 'Family tracing and reunification through the authorised process',
  'Support and reasonable accommodation for older persons (RA 9994)', 'Respect for culture, language and the rights of Indigenous Peoples (RA 8371)',
  'Accessible complaints and feedback channels'];
export const MONITOR_CHECKS = ['Update aggregate population, arrivals, departures and household counts', 'Monitor water quantity, quality, access and queuing',
  'Inspect toilets, bathing, lighting, drainage and waste daily', 'Track food, nutrition and health service gaps', 'Participatory safety mapping',
  'Review feedback, actions and referrals confidentially', 'Coordinate service providers; record gaps and duplication', 'Review hazard exposure and site safety after each warning'];
export const CLOSURE_CHECKS = ['Risk assessment confirms the return area is safe and services restored', 'Return or relocation information is accessible, voluntary and informed',
  'Transport and essential return support available', 'Protection and reunification referrals handed over', 'Assets, supplies, facilities and liabilities inventoried',
  'Community feedback and unresolved complaints addressed', 'Site cleaned, waste removed and host community consulted', 'Final camp report and closure approval completed'];
const DECISIONS = ['Continue camp operations', 'Expand capacity or open an additional site', 'Relocate the site because of risk', 'Begin the voluntary return assessment',
  'Prepare a phased closure', 'Close the site after validation'];

type Upd = (fn: (e: Exercise) => Exercise) => void;

function NumField({ label, value, onChange, hint, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint} tip={hint ?? `${label}. Leave blank if not known; blank is not zero.`}>
      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} inputMode="numeric" value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))} />}
    </Field>
  );
}

function Card({ title, children, className, tone }: { title?: string; children: ReactNode; className?: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className={clsx('rounded-sheet border bg-surface p-4 shadow-raised', tone === 'bad' ? 'border-bad' : tone === 'warn' ? 'border-warn' : 'border-line', className)}>
      {title && <h3 className="mb-2 font-bold">{title}</h3>}
      {children}
    </div>
  );
}

function Metric({ label, value, note, children }: { label: string; value: string; note?: string; children?: ReactNode }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-data text-3xl font-bold tabular-nums">{value}</p>
      {children}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

function Checklist({ ex, update, items, prefix, title }: { ex: Exercise; update: Upd; items: readonly string[]; prefix: string; title: string }) {
  const done = items.filter((_, i) => ex.checks[`${prefix}-${i}`]).length;
  return (
    <fieldset>
      <legend className="sr-only">{title}</legend>
      <p className="mb-2 text-sm text-muted">{done} of {items.length} done</p>
      <Meter value={done} max={items.length} label={`${title}: ${done} of ${items.length}`} tone={done === items.length ? 'ok' : 'action'} />
      <ul className="mt-2 divide-y divide-line">
        {items.map((t, i) => {
          const k = `${prefix}-${i}`;
          return (
            <li key={k}>
              <label className="flex min-h-tap cursor-pointer items-start gap-3 py-2.5" {...tip('Tick when this is done in the exercise')}>
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--action))]" checked={!!ex.checks[k]}
                  onChange={() => update((e) => ({ ...e, checks: { ...e.checks, [k]: !e.checks[k] } }))} />
                <span className={clsx(ex.checks[k] && 'text-muted')}>{t}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

// ------------------------------------------------------------------------------------------- modules
function Overview({ ex, go }: { ex: Exercise; go: (m: EchoModule) => void }) {
  const site = selectedSite(ex);
  const alerts = exerciseAlerts(ex);
  const u = utilisation(ex.scenario.persons, site?.capacity ?? null);
  const phase = exercisePhase(ex);
  const steps = [
    { n: 1, t: 'Prepare and validate', d: 'Hazard context, target barangays, centre readiness and transport.', m: 'scenario' as const },
    { n: 2, t: 'Evacuate and receive', d: 'Movement coordination, accessible transport, reception and aggregate counts.', m: 'evacuation' as const },
    { n: 3, t: 'Manage and protect', d: 'Shelter, WASH, food, health, child- and women-friendly spaces, safety and feedback.', m: 'camp' as const },
    { n: 4, t: 'Monitor and transition', d: 'Service gaps, safe return or relocation, site restoration and closure.', m: 'closure' as const },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Projected evacuees" value={fmt(ex.scenario.persons)} note="Scenario planning figure" />
        <Metric label="Selected centre capacity" value={fmt(site?.capacity)} note={site ? site.name : 'No centre selected'} />
        <Metric label="Capacity utilisation" value={pct(u)}>
          <div className="mt-2"><Meter value={Math.min(u ?? 0, 1)} label="Capacity utilisation" tone={u !== null && u > 1 ? 'bad' : u !== null && u > 0.9 ? 'warn' : 'action'} /></div>
        </Metric>
        <Metric label="Priority alerts" value={String(alerts.length)} note="From the inputs; none does not mean ready" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Operational sequence">
          <ol className="divide-y divide-line">
            {steps.map((s) => (
              <li key={s.n} className="flex items-start gap-3 py-3">
                <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-data font-bold',
                  s.n < phase.step ? 'bg-ok-soft text-ok' : s.n === phase.step ? 'bg-action text-on-action' : 'bg-sunken text-muted')}>{s.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.t}{s.n === phase.step && <Badge tone="info" className="ml-2">Now</Badge>}</span>
                  <span className="block text-sm text-muted">{s.d}</span>
                </span>
                <Button variant="quiet" tip={`Open ${s.t}`} onClick={() => go(s.m)}>Open</Button>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Ormoc planning area">
          <p className="text-sm text-muted">Hazard sheets, barangay exposure and the evacuation-centre inventory are on the Evacuation intelligence map. Simulator sites are illustrative; the map is not navigation.</p>
          <div className="mt-3"><ButtonLink to="/tools/echo/intel" icon={MapPinned} tip="Open the evacuation intelligence map">Open the map</ButtonLink></div>
          <p className="mt-3 text-xs text-muted">Validate flood, storm-surge, landslide, earthquake, tsunami and road-access information before choosing real routes or sites.</p>
        </Card>
      </div>
      <Card title="Priority checks">
        {alerts.length === 0 ? <Notice tone="ok">No alerts from the inputs. This does not certify operational readiness.</Notice> : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => go(a.module)} {...tip(`Open ${MODULES.find((m) => m.key === a.module)!.label}`)}
                  className={clsx('w-full rounded-control border-l-4 px-3 py-2 text-left', a.tone === 'bad' ? 'border-bad bg-bad-soft' : a.tone === 'warn' ? 'border-warn bg-warn-soft' : 'border-info bg-info-soft')}>
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm">{a.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Scenario({ ex, update }: { ex: Exercise; update: Upd }) {
  const bgys = useLiveQuery(() => db.barangays.orderBy('name').toArray(), [], []);
  const s = ex.scenario;
  const set = (patch: Partial<Exercise['scenario']>) => update((e) => ({ ...e, scenario: { ...e.scenario, ...patch } }));
  const problems = populationProblems(scenarioPopulation(ex));
  const short = s.lead === '0–6 hours' || s.lead === '6–24 hours' || s.lead === '24–72 hours';
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card title="Hazard and displacement assumptions">
        <div className="space-y-4">
          <Field label="Exercise title">{(id) => <Input id={id} value={ex.title} maxLength={120} onChange={(e) => update((x) => ({ ...x, title: e.target.value }))} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hazard scenario">{(id) => <Select id={id} value={s.hazard} onChange={(e) => set({ hazard: e.target.value })}>{HAZARDS.map((h) => <option key={h}>{h}</option>)}</Select>}</Field>
            <Field label="Planning lead time">{(id) => <Select id={id} value={s.lead} onChange={(e) => set({ lead: e.target.value })}>{LEAD_TIMES.map((h) => <option key={h}>{h}</option>)}</Select>}</Field>
          </div>
          <Field label="Origin barangays" hint="From the City's 85-barangay list. Not choosing a barangay never means it is safe.">
            {(id, d) => (
              <Select id={id} aria-describedby={d} value="" onChange={(e) => e.target.value && !s.barangays.includes(e.target.value) && set({ barangays: [...s.barangays, e.target.value] })}>
                <option value="">Add a barangay…</option>
                {bgys.map((b) => <option key={b.psgc} value={b.psgc}>{b.name}</option>)}
              </Select>
            )}
          </Field>
          {s.barangays.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {s.barangays.map((p) => (
                <li key={p}><Button variant="secondary" tip="Remove this barangay from the scenario" onClick={() => set({ barangays: s.barangays.filter((x) => x !== p) })}>
                  {bgys.find((b) => b.psgc === p)?.name ?? p} ✕</Button></li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Projected families" value={s.families} onChange={(v) => set({ families: v })} />
            <NumField label="Projected persons" value={s.persons} onChange={(v) => set({ persons: v })} />
            <NumField label="Women and girls" value={s.female} onChange={(v) => set({ female: v })} />
            <NumField label="Children (0–17)" value={s.children} onChange={(v) => set({ children: v })} />
            <NumField label="Older persons (60+)" value={s.older} onChange={(v) => set({ older: v })} />
            <NumField label="Persons with disability" value={s.pwd} onChange={(v) => set({ pwd: v })} />
            <NumField label="Pregnant and lactating women" value={s.pregnant_lactating} onChange={(v) => set({ pregnant_lactating: v })} />
            <NumField label="Indigenous Peoples" value={s.ip} onChange={(v) => set({ ip: v })} />
            <NumField label="Expected to shelter outside centres" value={s.outside_centres} onChange={(v) => set({ outside_centres: v })} hint="With relatives or host families" />
          </div>
          {problems.map((p) => <Notice key={p} tone="bad">{p}</Notice>)}
          <Field label="Exercise notes" optional hint="No personal identifiers. For example: rising water reported in several barangays; test accessible transport and a reception surge.">
            {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={1000} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />}
          </Field>
        </div>
      </Card>
      <Card title="Scenario guardrails">
        <Notice tone="warn">Simulator inputs are not evacuation triggers. Act on official PAGASA, PHIVOLCS and MGB information, the City's adopted thresholds and authorised instructions.</Notice>
        {short && <Notice tone="info">Lead time under 72 hours is below the RA 12287 declaration floor. Short-lead hazards go to city-level early action (Chapter 4, SOP 4-02).</Notice>}
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>An unselected barangay is not a safe barangay.</li>
          <li>Schools are a last resort under RA 10821, only where no other suitable structure is available.</li>
          <li>Plan for children, women, older persons, persons with disability and Indigenous Peoples in aggregate.</li>
          <li>Count host communities and people sheltering outside formal centres.</li>
          <li>Missing counts stay "not reported", never zero.</li>
        </ul>
      </Card>
    </div>
  );
}

function Evacuation({ ex, update }: { ex: Exercise; update: Upd }) {
  const m = ex.movement;
  const set = (patch: Partial<Exercise['movement']>) => update((e) => ({ ...e, movement: { ...e.movement, ...patch } }));
  const mv = movement(ex.scenario.persons, m.vehicles, m.per_trip, m.round_trip_min);
  const accounted = (m.received ?? 0) + (m.en_route ?? 0) + (m.unaccounted ?? 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Movement plan">
          <div className="space-y-4">
            <Field label="Movement mode">{(id) => <Select id={id} value={m.mode} onChange={(e) => set({ mode: e.target.value })}>
              {['Mixed: walking and vehicles', 'Vehicle-assisted evacuation', 'Assisted evacuation, accessible transport', 'Boat-assisted (only if authorised and safe)'].map((x) => <option key={x}>{x}</option>)}
            </Select>}</Field>
            <ChoiceGroup legend="Route validation" value={m.route} onChange={(v) => set({ route: v })} columns={3}
              options={[{ value: 'unverified', label: 'Not yet validated' }, { value: 'validated', label: 'Validated by an authorised team' }, { value: 'blocked', label: 'Blocked or unsafe' }]} />
            <div className="grid gap-3 sm:grid-cols-3">
              <NumField label="Transport units" value={m.vehicles} onChange={(v) => set({ vehicles: v })} />
              <NumField label="Persons per trip" value={m.per_trip} onChange={(v) => set({ per_trip: v })} />
              <NumField label="Round trip" suffix="minutes" value={m.round_trip_min} onChange={(v) => set({ round_trip_min: v })} hint="From the field team; ECHO does not guess travel time." />
            </div>
            <Field label="Assembly or reception point">{(id) => <Input id={id} maxLength={160} value={m.assembly} onChange={(e) => set({ assembly: e.target.value })} />}</Field>
            <Notice tone="info">
              {fmt(mv.loads)} vehicle loads. {mv.cycles === null ? 'Add transport units to compute cycles.' : `At ${fmt(m.vehicles)} units, at least ${mv.cycles} cycle${mv.cycles === 1 ? '' : 's'}`}
              {mv.minutes !== null ? `, about ${Math.round(mv.minutes / 60 * 10) / 10} hours of movement.` : mv.cycles !== null ? ', not counting travel and turnaround time.' : ''}
            </Notice>
            {m.route !== 'validated' && <Notice tone={m.route === 'blocked' ? 'bad' : 'warn'}>Never route evacuees through mapped hazard areas or assume roads are passable. Confirm routes through the EOC and field teams before movement. Screen a route on the <Link className="font-semibold underline" to="/tools/echo/intel">Evacuation intelligence</Link> map.</Notice>}
          </div>
        </Card>
        <Card title="Evacuation control checklist"><Checklist ex={ex} update={update} items={EVAC_CHECKS} prefix="evac" title="Evacuation control checklist" /></Card>
      </div>
      <Card title="Reception and accountability">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField label="Persons received" value={m.received} onChange={(v) => set({ received: v })} />
          <NumField label="Persons en route" value={m.en_route} onChange={(v) => set({ en_route: v })} />
          <NumField label="Not accounted for" value={m.unaccounted} onChange={(v) => set({ unaccounted: v })} />
        </div>
        {ex.scenario.persons !== null && accounted !== ex.scenario.persons && (
          <Notice tone="warn">Received, en route and not accounted for add to {fmt(accounted)}, not the projected {fmt(ex.scenario.persons)}. Reconcile the counts.</Notice>
        )}
        <p className="text-sm text-muted">Aggregate counts only. Family tracing and reunification use authorised confidential procedures outside MODE.</p>
      </Card>
    </div>
  );
}

function SiteForm({ onSave, onClose, open }: { open: boolean; onClose: () => void; onSave: (s: TrainingSite) => void }) {
  const [s, setS] = useState<TrainingSite>({ id: '', name: 'Training Site', capacity: 500, area_m2: 1750, water_l_day: 7500, toilets_male: 12, toilets_female: 13, toilets_accessible: 2,
    bathing: 10, accessible: false, clinic: false, cfs: false, wfs: false, origin: 'training' });
  const set = (p: Partial<TrainingSite>) => setS({ ...s, ...p });
  return (
    <Sheet open={open} onClose={onClose} title="Add a training site"
      footer={<><Button variant="secondary" tip="Close without adding" onClick={onClose}>Cancel</Button>
        <Button tip="Add this illustrative site to the exercise" disabled={!s.name.trim()} onClick={() => { onSave({ ...s, id: `site-${uuid().slice(0, 8)}`, name: s.name.trim() }); onClose(); }}>Add site</Button></>}>
      <Notice tone="warn">Use a label, not the name of a real facility that has not been verified.</Notice>
      <div className="space-y-3">
        <Field label="Label">{(id) => <Input id={id} maxLength={120} value={s.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField label="Capacity" suffix="persons" value={s.capacity} onChange={(v) => set({ capacity: v })} />
          <NumField label="Covered area" suffix="m²" value={s.area_m2} onChange={(v) => set({ area_m2: v })} />
          <NumField label="Water" suffix="L per day" value={s.water_l_day} onChange={(v) => set({ water_l_day: v })} />
          <NumField label="Bathing facilities" value={s.bathing} onChange={(v) => set({ bathing: v })} />
          <NumField label="Toilets for males" value={s.toilets_male} onChange={(v) => set({ toilets_male: v })} />
          <NumField label="Toilets for females" value={s.toilets_female} onChange={(v) => set({ toilets_female: v })} />
          <NumField label="Accessible toilets" value={s.toilets_accessible} onChange={(v) => set({ toilets_accessible: v })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Checkbox checked={s.accessible} onChange={() => set({ accessible: !s.accessible })} tip="Accessible routes, toilets and bathing">Accessible</Checkbox>
          <Checkbox checked={s.clinic} onChange={() => set({ clinic: !s.clinic })} tip="Health station and isolation area">Health station</Checkbox>
          <Checkbox checked={s.cfs} onChange={() => set({ cfs: !s.cfs })} tip="Child-friendly space">Child-friendly space</Checkbox>
          <Checkbox checked={s.wfs} onChange={() => set({ wfs: !s.wfs })} tip="Women-friendly space">Women-friendly space</Checkbox>
        </div>
      </div>
    </Sheet>
  );
}

function Centres({ ex, update }: { ex: Exercise; update: Upd }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const inventory = useLiveQuery(async () => (await db.evacuation_centers.toArray()).filter((c) => c.verification_status !== 'superseded'), [], []);
  const site = selectedSite(ex);
  const copy = (id: string) => {
    const c = inventory.find((x) => x.id === id);
    if (!c) return;
    const s: TrainingSite = { id: `inv-${c.id.slice(0, 8)}`, name: c.name, capacity: c.capacity_persons, area_m2: c.covered_area_m2, water_l_day: c.water_l_day,
      toilets_male: c.toilets_male, toilets_female: c.toilets_female, toilets_accessible: c.toilets_accessible, bathing: c.bathing,
      accessible: c.accessible === true || c.ra12076.toilets === 'yes', clinic: c.ra12076.health === 'yes', cfs: c.ra12076.cfs_wfs === 'yes', wfs: c.ra12076.cfs_wfs === 'yes',
      origin: 'inventory', verification: c.verification_status, centre_id: c.id };
    update((e) => ({ ...e, sites: [...e.sites.filter((x) => x.id !== s.id), s], selected: s.id }));
    toast(`${c.name} copied into the exercise`);
  };
  const raKey = (k: string) => `ra:${site?.id}:${k}`;
  return (
    <div className="space-y-4">
      <Notice tone="warn">Training sites are fictional. Centres copied from the City inventory keep their verification status; in the exercise they are copies, and nothing here changes the inventory.</Notice>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Sites in this exercise">
          <ul className="space-y-2">
            {ex.sites.map((s) => {
              const u = utilisation(ex.scenario.persons, s.capacity);
              return (
                <li key={s.id} className={clsx('flex flex-wrap items-center gap-3 rounded-control border p-3', s.id === ex.selected ? 'border-action ring-1 ring-action' : 'border-line')}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block font-data text-sm text-muted">{fmt(s.capacity)} persons · {fmt(s.area_m2)} m² · projected use {pct(u)}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={s.origin === 'training' ? 'info' : s.verification === 'field_verified' ? 'ok' : 'warn'}>{s.origin === 'training' ? 'Illustrative training site' : VERIFICATION[(s.verification ?? 'pending_field_validation') as keyof typeof VERIFICATION]}</Badge>
                      {!s.accessible && <Badge tone="warn">Access not confirmed</Badge>}
                    </span>
                  </span>
                  <Button variant={s.id === ex.selected ? 'primary' : 'secondary'} tip="Use this site in the exercise" onClick={() => update((e) => ({ ...e, selected: s.id }))}>{s.id === ex.selected ? 'Selected' : 'Select'}</Button>
                  {ex.sites.length > 1 && <Button variant="quiet" tip="Remove this site from the exercise" onClick={() => update((e) => ({ ...e, sites: e.sites.filter((x) => x.id !== s.id), selected: e.selected === s.id ? e.sites.find((x) => x.id !== s.id)!.id : e.selected }))}>Remove</Button>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={Plus} tip="Add an illustrative training site" onClick={() => setAdding(true)}>Add training site</Button>
            <Select aria-label="Copy a centre from the City inventory" value="" onChange={(e) => e.target.value && copy(e.target.value)} className="max-w-xs" {...tip('Copy a centre from the City inventory into this exercise')}>
              <option value="">{inventory.length ? 'Copy from the City inventory…' : 'City inventory is empty'}</option>
              {inventory.filter((c) => c.verification_status !== 'training').map((c) => <option key={c.id} value={c.id}>{c.name} ({VERIFICATION[c.verification_status]})</option>)}
            </Select>
          </div>
        </Card>
        <Card title="Selected site">
          {!site ? <EmptyState title="No site selected" /> : (
            <>
              <p className="font-semibold">{site.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {[['Capacity', fmt(site.capacity)], ['Covered area', `${fmt(site.area_m2)} m²`], ['Persons at 3.5 m²', fmt(spaceCheck(0, site.area_m2).capacityAtStandard)],
                  ['Water per day', `${fmt(site.water_l_day)} L`], ['Toilets M / F / accessible', `${fmt(site.toilets_male)} / ${fmt(site.toilets_female)} / ${fmt(site.toilets_accessible)}`],
                  ['Bathing', fmt(site.bathing)], ['Health station', site.clinic ? 'Yes' : 'Not confirmed'], ['CFS / WFS', `${site.cfs ? 'Yes' : 'No'} / ${site.wfs ? 'Yes' : 'No'}`]].map(([k, v]) => (
                  <div key={k}><dt className="text-muted">{k}</dt><dd className="font-data font-semibold">{v}</dd></div>
                ))}
              </dl>
              <Button className="mt-3" variant="secondary" tip="Use this site's water and toilets as the camp inputs" onClick={() => update((e) => ({ ...e, camp: { ...e.camp,
                water_l_day: site.water_l_day, toilets_male: site.toilets_male, toilets_female: site.toilets_female, toilets_accessible: site.toilets_accessible, bathing: site.bathing } }))}>Use for camp inputs</Button>
              <Notice tone="warn">Not verified against Ormoc hazard maps or RA 12076 here. A real centre is screened on the map and in the inventory.</Notice>
            </>
          )}
        </Card>
      </div>
      {site && (
        <Card title="RA 12076 minimum facility checks (Sec. 4)">
          <p className="mb-2 text-sm text-muted">A readiness checklist for {site.name}. A tick does not certify structural safety or legal compliance; only the competent offices do.</p>
          <ul className="divide-y divide-line">
            {RA12076_CHECKS.map((c) => (
              <li key={c.key}>
                <label className="flex min-h-tap cursor-pointer items-start gap-3 py-2.5" {...tip('Tick when confirmed in the exercise')}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--action))]" checked={!!ex.checks[raKey(c.key)]}
                    onChange={() => update((e) => ({ ...e, checks: { ...e.checks, [raKey(c.key)]: !e.checks[raKey(c.key)] } }))} />
                  <span className="flex-1">{c.text} <span className="font-data text-xs text-muted">{c.ref}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <SiteForm open={adding} onClose={() => setAdding(false)} onSave={(s) => update((e) => ({ ...e, sites: [...e.sites, s], selected: s.id }))} />
    </div>
  );
}

function StatusBadge({ ok, na }: { ok: boolean | null; na?: string }) {
  return ok === null ? <Badge>{na ?? 'Not reported'}</Badge> : ok ? <Badge tone="ok">Meets</Badge> : <Badge tone="bad">Below</Badge>;
}

function Camp({ ex, update }: { ex: Exercise; update: Upd }) {
  const site = selectedSite(ex);
  const c = ex.camp;
  const set = (patch: Partial<Exercise['camp']>) => update((e) => ({ ...e, camp: { ...e.camp, ...patch } }));
  const p = scenarioPopulation(ex);
  const persons = ex.scenario.persons;
  const w = waterCheck(persons, c.water_l_day);
  const sp = spaceCheck(persons, site?.area_m2 ?? null);
  const t = toiletCheck(p, { male: c.toilets_male, female: c.toilets_female, accessible: c.toilets_accessible }, c.phase);
  const bathNeed = bathingNeedJmc(persons);
  const u = utilisation(persons, site?.capacity ?? null);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Occupancy" value={fmt(persons)} note={u === null ? 'No capacity recorded' : u > 1 ? 'Capacity exceeded' : `${pct(u)} of capacity`}>
          <div className="mt-2"><Meter value={Math.min(u ?? 0, 1)} label="Occupancy against capacity" tone={u !== null && u > 1 ? 'bad' : 'action'} /></div>
        </Metric>
        <Metric label="Water needed per day" value={`${fmt(w.needSphere)} L`} note={`Sphere 15 L per person (initial). JMC prolonged stay: ${fmt(w.needJmc)} L at 52 L.`} />
        <Metric label="Covered living space needed" value={`${fmt(sp.need)} m²`} note={`Sphere 3.5 m² per person. Site has ${fmt(site?.area_m2)} m².`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="WASH inputs">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Safe water available" suffix="L per day" value={c.water_l_day} onChange={(v) => set({ water_l_day: v })} />
            <NumField label="Days in the centre so far" value={c.days} onChange={(v) => set({ days: v })} />
            <NumField label="Working toilets for males" value={c.toilets_male} onChange={(v) => set({ toilets_male: v })} />
            <NumField label="Working toilets for females" value={c.toilets_female} onChange={(v) => set({ toilets_female: v })} />
            <NumField label="Working accessible toilets" value={c.toilets_accessible} onChange={(v) => set({ toilets_accessible: v })} />
            <NumField label="Working bathing facilities" value={c.bathing} onChange={(v) => set({ bathing: v })} />
          </div>
          <div className="mt-3">
            <ChoiceGroup legend="Displacement (JMC toilet ratio)" value={c.phase} onChange={(v) => set({ phase: v })} columns={2}
              hint="The JMC applies these ratios once displacement exceeds 3 days."
              options={[{ value: 'short', label: 'Short-term', detail: '1 toilet per 50 persons' }, { value: 'long', label: 'Long-term', detail: '1 toilet per 20 persons' }]} />
          </div>
        </Card>
        <Card title="Service delivery monitoring"><Checklist ex={ex} update={update} items={SERVICE_CHECKS} prefix="service" title="Service delivery monitoring" /></Card>
      </div>
      <Card title="Daily camp snapshot">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-semibold">Indicator</th><th className="py-2 font-semibold">Current</th><th className="py-2 font-semibold">Reference (source)</th><th className="py-2 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              <tr><td className="py-2">Water, initial phase</td><td className="py-2 font-data">{fmt(c.water_l_day)} L ({w.perPerson === null ? '—' : `${w.perPerson.toFixed(1)} L/person`})</td><td className="py-2">{fmt(w.needSphere)} L at 15 L/person (Sphere)</td><td className="py-2"><StatusBadge ok={w.meetsSphere} /></td></tr>
              <tr><td className="py-2">Water, prolonged stay</td><td className="py-2 font-data">{fmt(c.water_l_day)} L</td><td className="py-2">{fmt(w.needJmc)} L at 52 L/person (JMC p. 13)</td><td className="py-2">{c.phase === 'long' ? <StatusBadge ok={w.meetsJmc} /> : <Badge>Applies to long stays</Badge>}</td></tr>
              <tr><td className="py-2">Covered living space</td><td className="py-2 font-data">{fmt(site?.area_m2)} m²</td><td className="py-2">{fmt(sp.need)} m² at 3.5 m²/person (Sphere)</td><td className="py-2"><StatusBadge ok={sp.meets} /></td></tr>
              <tr><td className="py-2">Toilets, all users</td><td className="py-2 font-data">{fmt(t.available.total)}</td><td className="py-2">{t.jmc} at 1:{t.jmcRatio} (JMC, {c.phase === 'long' ? 'long-term' : 'short-term'})</td><td className="py-2"><StatusBadge ok={t.available.total === null || !persons ? null : t.available.total >= t.jmc} /></td></tr>
              <tr><td className="py-2">Toilets for males</td><td className="py-2 font-data">{fmt(c.toilets_male)}</td><td className="py-2">{fmt(t.ra.male)} at 1 per 20 males (RA 12076; {fmt(malesOf(p))} males)</td><td className="py-2"><StatusBadge ok={t.ra.male === null || c.toilets_male === null ? null : c.toilets_male >= t.ra.male} /></td></tr>
              <tr><td className="py-2">Toilets for females</td><td className="py-2 font-data">{fmt(c.toilets_female)}</td><td className="py-2">{fmt(t.ra.female)} at 1 per 20 females (RA 12076)</td><td className="py-2"><StatusBadge ok={t.ra.female === null || c.toilets_female === null ? null : c.toilets_female >= t.ra.female} /></td></tr>
              <tr><td className="py-2">Accessible toilets</td><td className="py-2 font-data">{fmt(c.toilets_accessible)}</td><td className="py-2">{fmt(t.ra.accessible)} at 1 per 8 persons with disability or older persons (RA 12076); JMC: at least 1 per site</td><td className="py-2"><StatusBadge ok={t.ra.accessible === null || c.toilets_accessible === null ? null : c.toilets_accessible >= Math.max(1, t.ra.accessible)} /></td></tr>
              <tr><td className="py-2">Bathing facilities</td><td className="py-2 font-data">{fmt(c.bathing)}</td><td className="py-2">{bathNeed} at 50 persons per facility (JMC p. 13)</td><td className="py-2"><StatusBadge ok={c.bathing === null || !persons ? null : c.bathing >= bathNeed} /></td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">The JMC ratios and the RA 12076 facility standard are separate checks; one does not satisfy the other. Ask the CHO which applies to the site.</p>
      </Card>
    </div>
  );
}

function Protection({ ex, update }: { ex: Exercise; update: Upd }) {
  const [cat, setCat] = useState<string>(FEEDBACK.access_inclusion);
  const [status, setStatus] = useState<string>(FEEDBACK_STATUS.open);
  const [summary, setSummary] = useState('');
  const [office, setOffice] = useState('');
  const s = ex.scenario;
  const add = () => {
    update((e) => ({ ...e, feedback: [{ id: uuid(), at: new Date().toISOString(), category: cat, status, summary: summary.trim().slice(0, 500), office: office.trim().slice(0, 120) }, ...e.feedback] }));
    setSummary(''); setOffice('');
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Protection and inclusion safeguards">
          <Checklist ex={ex} update={update} items={PROTECT_CHECKS} prefix="protect" title="Protection and inclusion safeguards" />
          <Notice tone="warn">Do not record names, case narratives, diagnoses or anything that identifies a person. Record only that a referral is needed, and use the authorised confidential pathway.</Notice>
        </Card>
        <Card title="Aggregate needs profile">
          <dl className="divide-y divide-line">
            {[['Children (0–17)', s.children], ['Women and girls', s.female], ['Persons with disability', s.pwd], ['Older persons (60+)', s.older],
              ['Pregnant and lactating women', s.pregnant_lactating], ['Indigenous Peoples', s.ip]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between py-2"><dt>{k}</dt><dd className="font-data font-semibold">{fmt(v as number | null)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Planning estimates from Scenario setup. Update only with validated aggregate data.</p>
        </Card>
      </div>
      <Card title="Feedback and service-gap log">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Category">{(id) => <Select id={id} value={cat} onChange={(e) => setCat(e.target.value)}>{Object.values(FEEDBACK).map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
          <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>{Object.values(FEEDBACK_STATUS).map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
          <Field label="Office acting" optional>{(id) => <Input id={id} maxLength={120} value={office} onChange={(e) => setOffice(e.target.value)} placeholder="For example CSWDO, CHO, CGSO" />}</Field>
        </div>
        <div className="mt-3">
          <Field label="Non-identifying summary" hint={`Describe the service issue, not the person or case. ${500 - summary.length} characters left.`}>
            {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} />}
          </Field>
        </div>
        <Button className="mt-3" icon={Plus} tip="Add this entry to the exercise log" disabled={summary.trim().length < 3} onClick={add}>Add to the log</Button>
        <ul className="mt-4 divide-y divide-line">
          {ex.feedback.length === 0 && <li className="py-2 text-sm text-muted">No entries in this exercise.</li>}
          {ex.feedback.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 py-2">
              <span className="min-w-0 flex-1"><span className="block font-semibold">{f.category}</span><span className="block text-sm">{f.summary}</span>
                <span className="block text-xs text-muted">{new Date(f.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}{f.office ? ` · ${f.office}` : ''}</span></span>
              <Select aria-label="Status" value={f.status} className="w-52" onChange={(e) => update((x) => ({ ...x, feedback: x.feedback.map((y) => y.id === f.id ? { ...y, status: e.target.value } : y) }))}>
                {Object.values(FEEDBACK_STATUS).map((x) => <option key={x}>{x}</option>)}
              </Select>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Closure({ ex, update }: { ex: Exercise; update: Upd }) {
  const [action, setAction] = useState(DECISIONS[0]!);
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monitoring cycle"><Checklist ex={ex} update={update} items={MONITOR_CHECKS} prefix="monitor" title="Monitoring cycle" /></Card>
        <Card title="Closure readiness">
          <Checklist ex={ex} update={update} items={CLOSURE_CHECKS} prefix="closure" title="Closure readiness" />
          <Notice tone="info">Closure is more than the end of occupancy: return, relocation or other solutions are safe, voluntary, informed and agreed with the affected community (JMC; IOM CCCM camp closure). Closing a real centre is an authorised decision recorded in the EOC.</Notice>
        </Card>
      </div>
      <Card title="Exercise decision record">
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <Field label="Decision or next action">{(id) => <Select id={id} value={action} onChange={(e) => setAction(e.target.value)}>{DECISIONS.map((d) => <option key={d}>{d}</option>)}</Select>}</Field>
          <Field label="Reason" hint="No personal identifiers.">{(id, d) => <Textarea id={id} aria-describedby={d} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        </div>
        <Button className="mt-3" tip="Record this decision in the exercise" disabled={!reason.trim()} onClick={() => {
          update((e) => ({ ...e, decisions: [{ id: uuid(), at: new Date().toISOString(), action, reason: reason.trim() }, ...e.decisions] })); setReason('');
        }}>Record decision</Button>
        <ul className="mt-4 divide-y divide-line">
          {ex.decisions.length === 0 && <li className="py-2 text-sm text-muted">No decisions recorded yet.</li>}
          {ex.decisions.map((d) => (
            <li key={d.id} className="py-2"><span className="block font-semibold">{d.action}</span><span className="block text-sm">{d.reason}</span>
              <span className="block text-xs text-muted">{new Date(d.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function Standards() {
  const by = (src: SourceKey) => BENCHMARKS.filter((b) => b.source === src);
  return (
    <div className="space-y-4">
      <Notice tone="warn" title="Keep sources distinct">The JMC indicators, the Sphere benchmarks and the RA 12076 requirements are not interchangeable. The JMC's 52 L per person per day (prolonged stay) is not Sphere's 15 L (initial phase); the JMC toilet ratios are not RA 12076's facility standard. Confirm the applicable, stricter requirement with the technical offices. Legal readings need City Legal or OCD confirmation. The official texts govern.</Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Philippine legal framework">
          <ul className="space-y-2 text-sm">
            <li><b>RA 10121</b>: Philippine DRRM Act; local authority, coordination and response.</li>
            <li><b>RA 12076</b>: Ligtas Pinoy Centers Act (2024). Sec. 4 minimum standards (location, structure, capacity and facilities, food safety); Sec. 10 LGU operation and management, with yearly and post-disaster audits.</li>
            <li><b>RA 10821</b>: Children's Emergency Relief and Protection Act; child-friendly spaces; schools only as a last resort.</li>
            <li><b>RA 9710</b>: Magna Carta of Women; gender-responsive services, privacy, safety and participation.</li>
            <li><b>RA 7277 as amended</b>: Magna Carta for Persons with Disability; accessibility.</li>
            <li><b>RA 9994</b>: Expanded Senior Citizens Act. <b>RA 8371</b>: Indigenous Peoples' Rights Act. <b>RA 11106</b>: Filipino Sign Language Act.</li>
            <li><b>RA 10173</b>: Data Privacy Act. ECHO holds aggregates only; DAFAC data stay with the CSWDO.</li>
          </ul>
        </Card>
        <Card title="Operational standards">
          <ul className="space-y-2 text-sm">
            <li><b>DSWD-DILG-DOH-DepEd JMC No. 02, s. 2021</b>: Camp Management Committee and Camp Management Team; DAFAC-based family profiling; camp facilities and WASH; child- and women-friendly spaces; complaints and grievances; monitoring, reporting and camp closure.</li>
            <li><b>Sphere Handbook 2018</b>: Humanitarian Charter, Protection Principles, Core Humanitarian Standard; WASH, shelter and settlement, food security and nutrition, health.</li>
            <li><b>IOM CCCM</b> (Camp Management Toolkit): the camp life cycle of set-up or improvement, care and maintenance, and closure; coordination, information management, participation, complaints and feedback, maintenance and protection mainstreaming.</li>
            <li><b>NDRRMC Disaster Preparedness Minimum Standards, Vol. 2</b>: evacuation-centre service minimums.</li>
          </ul>
        </Card>
      </div>
      {(Object.keys(SOURCES) as SourceKey[]).map((src) => (
        <Card key={src} title={`${SOURCES[src].short}: numeric indicators`}>
          <p className="mb-2 text-xs text-muted">{SOURCES[src].long}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-semibold">Indicator</th><th className="py-2 font-semibold">Value</th><th className="py-2 font-semibold">Where</th><th className="py-2 font-semibold">Note</th></tr></thead>
              <tbody className="divide-y divide-line">
                {by(src).map((b) => <tr key={b.key}><td className="py-2">{b.label}</td><td className="py-2 font-data">{b.value}</td><td className="py-2">{b.where}</td><td className="py-2 text-muted">{b.note ?? ''}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------- page
export function EchoSimulator() {
  const { ex, update, replace, saved } = useExercise();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const mod = (MODULES.find((m) => m.key === params.get('m'))?.key ?? 'overview') as EchoModule;
  const go = (m: EchoModule) => { setParams(m === 'overview' ? {} : { m }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const file = useRef<HTMLInputElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const alerts = useMemo(() => exerciseAlerts(ex), [ex]);
  const phase = exercisePhase(ex);
  const bad = alerts.filter((a) => a.tone === 'bad').length;

  const exportJson = () => {
    download(`MODE-ECHO-exercise-${ex.updated_at.slice(0, 10)}.json`,
      JSON.stringify({ product: 'MODE ECHO', trainingOnly: true, timezone: 'Asia/Manila', exportedAt: new Date().toISOString(), alerts, ...ex }, null, 2));
  };
  const importJson = async (f: File) => {
    try {
      if (f.size > 1_000_000) throw new Error('The file is larger than 1 MB.');
      replace(importExercise(JSON.parse(await f.text())));
      toast('Exercise imported');
      go('overview');
    } catch (e) { toast(e instanceof Error ? e.message : 'The file could not be read.', 'bad'); }
  };

  return (
    <div className="page">
      <PageHeader title="ECHO" subtitle="Evacuation and Camp Handling Operations"
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Download} tip="Save this exercise as a JSON file (training record)" onClick={exportJson}>Export</Button>
          <Button variant="secondary" icon={Upload} tip="Open an ECHO exercise file, including one from the standalone prototype" onClick={() => file.current?.click()}>Import</Button>
          <ButtonLink to="/tools/echo/report" icon={FileText} tip="Open the printable exercise report">Report</ButtonLink>
          <Button variant="quiet" icon={RotateCcw} tip="Start a new exercise (export this one first if you want to keep it)" onClick={() => setConfirmNew(true)}>New</Button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
        </div>} />
      <Tabs items={ECHO_TABS} />

      {/* State before content: what this is, where the exercise stands, what needs attention. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-3 py-2" role="status">
        <Badge tone="info">Simulation: training only</Badge>
        <Badge tone={phase.step === 4 ? 'ok' : 'neutral'}>Phase {phase.step} of 4: {phase.label}</Badge>
        <Badge>{ex.scenario.hazard}</Badge>
        {alerts.length > 0 ? <Badge tone={bad ? 'bad' : 'warn'}><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{alerts.length} alert{alerts.length > 1 ? 's' : ''}</Badge>
          : <Badge tone="ok"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />No alerts</Badge>}
        <span className="ml-auto text-xs text-muted">{saved === false ? 'Could not save on this device: export to keep it' : 'Saved on this device'}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="ECHO modules" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
            {MODULES.map((m, i) => (
              <li key={m.key} className="shrink-0">
                <button type="button" onClick={() => go(m.key)} aria-current={mod === m.key ? 'page' : undefined} {...tip(m.tip)}
                  className={clsx('flex min-h-tap w-full items-center gap-2 whitespace-nowrap rounded-control border-l-4 px-3 text-left font-semibold',
                    mod === m.key ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-muted hover:bg-sky-soft/60 hover:text-ink')}>
                  <span className="font-data text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="lg:hidden">{m.short}</span><span className="hidden lg:inline">{m.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 hidden text-xs text-muted lg:block">Training and decision support. Follow official warnings, evacuation orders and the City's validated protocols.</p>
        </nav>
        <div className="min-w-0">
          <h2 className="mb-3 text-xl font-bold">{MODULES.find((m) => m.key === mod)!.label}</h2>
          {mod === 'overview' && <Overview ex={ex} go={go} />}
          {mod === 'scenario' && <Scenario ex={ex} update={update} />}
          {mod === 'evacuation' && <Evacuation ex={ex} update={update} />}
          {mod === 'centres' && <Centres ex={ex} update={update} />}
          {mod === 'camp' && <Camp ex={ex} update={update} />}
          {mod === 'protection' && <Protection ex={ex} update={update} />}
          {mod === 'closure' && <Closure ex={ex} update={update} />}
          {mod === 'standards' && <Standards />}
        </div>
      </div>
      <Section className="mt-8">
        <p className="text-xs text-muted">ECHO is a training and decision-support tool. It does not issue evacuation orders, certify an evacuation centre as safe, or replace the authority of the City DRRMC, the City Government, DSWD or other responsible agencies. Sample sites and figures are illustrative. Kept on this device; signing out clears it.</p>
      </Section>

      <Sheet open={confirmNew} onClose={() => setConfirmNew(false)} title="Start a new exercise?"
        footer={<><Button variant="secondary" tip="Keep the current exercise" onClick={() => setConfirmNew(false)}>Keep this one</Button>
          <Button variant="danger" tip="Replace the current exercise with a new one" onClick={() => { replace(newExercise()); setConfirmNew(false); go('overview'); toast('New exercise started'); }}>Start new</Button></>}>
        <p>The current exercise is replaced on this device. Export it first if you want to keep it.</p>
      </Sheet>
    </div>
  );
}
