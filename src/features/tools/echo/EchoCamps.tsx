// Tools → ECHO → Camp management (1.16.0, ADR-030): the Camp Management Information System.
// The evacuation-centre inventory, aggregate camp reports per centre (JMC No. 02 s. 2021 camp monitoring) and the
// complaints and feedback log. Counts only: no names, no DAFAC data (they stay with the CSWDO), no case narratives.
// Opening, closing and closure are authorised decisions: filed online by the EOC Manager or the CDRRMO Head, with
// the authority reference. "Data field-verified" is about the inventory record, never a safety certificate.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { ClipboardList, MessageSquarePlus, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { insertOnline, save, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canChangeLevel, canOperate, currentLevel, currentReportWindow } from '@/domain/eoc';
import {
  AUTHORITY_PHASES, RA12076_CHECKS, campReportProblems, centreScreening, fmt, latestPerCentre, parseWhole, spaceCheck, toiletCheck, utilisation, waterCheck,
} from '@/domain/echo';
import { fmtDateTime, relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, EmptyState, Field, Input, List, ListRow, Loading, Meter, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import type { CampFeedback, CampPhase, CampReport, CentreKind, EvacuationCentre, FeedbackCategory } from '@/types';
import { ECHO_TABS, FEEDBACK, FEEDBACK_STATUS, KIND, PHASE, PHASE_TONE, SERVICES, VERIFICATION, VERIFICATION_TONE } from './labels';

const blankCentre = (): EvacuationCentre => ({
  id: uuid(), version: 1, code: null, name: '', barangay_psgc: null, kind: 'multipurpose', capacity_persons: null, covered_area_m2: null,
  toilets_male: null, toilets_female: null, toilets_accessible: null, bathing: null, water_l_day: null, is_school: false, is_permanent: false, accessible: null,
  hazard_screening: null, structural_ref: null, ra12076: {}, verification_status: 'pending_field_validation', custodian_office_id: null, point_id: null,
  lat: null, lng: null, note: null,
});

function useCamps() {
  return useLiveQuery(async () => {
    const [centres, reports, feedback, activations, bgys] = await Promise.all([db.evacuation_centers.toArray(), db.camp_reports.toArray(),
      db.camp_feedback.toArray(), db.eoc_activations.toArray(), db.barangays.toArray()]);
    const window = currentReportWindow(activations);
    const { activation } = currentLevel(activations);
    const latest = new Map(latestPerCentre(reports, window.from).map((r) => [r.centre_id, r]));
    return { centres, reports, feedback, activation, window, latest, bgyName: new Map(bgys.map((b) => [b.psgc, b.name])) };
  }, []);
}

// ------------------------------------------------------------------------------------------- inventory form
function CentreForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: EvacuationCentre }) {
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const bgys = useLiveQuery(() => db.barangays.orderBy('name').toArray(), [], []);
  const set = (p: Partial<EvacuationCentre>) => setC({ ...c, ...p });
  const isNew = initial.name === '';
  const numF = (label: string, k: keyof EvacuationCentre, suffix?: string) => (
    <Field label={suffix ? `${label} (${suffix})` : label} tip={`${label}. Leave blank if not known.`}>
      {(id) => <Input id={id} type="number" min={0} inputMode="numeric" value={(c[k] as number | null) ?? ''} onChange={(e) => set({ [k]: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) } as Partial<EvacuationCentre>)} />}
    </Field>
  );
  const submit = async () => {
    if (!c.name.trim()) { setProblem('Give the centre a name.'); return; }
    if (c.code && !/^[A-Z][A-Z0-9-]{1,30}$/.test(c.code)) { setProblem('Code: capital letters, digits and hyphens, for example EC-SANJUAN-01.'); return; }
    if ((c.lat === null) !== (c.lng === null)) { setProblem('Give both latitude and longitude, or neither.'); return; }
    const row = { ...c, name: c.name.trim(), is_school: c.kind === 'school_last_resort', ...(isNew ? { _new: true as const } : {}) };
    await save('evacuation_centers', row, isNew ? `Add evacuation centre ${row.name}` : `Update evacuation centre ${row.name}`);
    toast(isNew ? 'Centre added to the inventory, pending field validation' : 'Centre updated');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Add an evacuation centre' : `Edit ${initial.name}`}
      footer={<><Button variant="secondary" tip="Close without saving" onClick={onClose}>Cancel</Button><Button tip="Save this inventory record" onClick={submit}>Save</Button></>}>
      <div className="space-y-4">
        {!isNew && initial.verification_status === 'field_verified' && <Notice tone="info">Changing location, capacity, area, type or WASH counts sends the centre back to pending field validation.</Notice>}
        {problem && <Notice tone="bad">{problem}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} maxLength={160} value={c.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
          <Field label="Code" optional hint="For example EC-SANJUAN-01">{(id, d) => <Input id={id} aria-describedby={d} value={c.code ?? ''} onChange={(e) => set({ code: e.target.value.toUpperCase() || null })} />}</Field>
          <Field label="Type">{(id) => <Select id={id} value={c.kind} onChange={(e) => set({ kind: e.target.value as CentreKind })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Barangay" optional>{(id) => <Select id={id} value={c.barangay_psgc ?? ''} onChange={(e) => set({ barangay_psgc: e.target.value || null })}>
            <option value="">Not set</option>{bgys.map((b) => <option key={b.psgc} value={b.psgc}>{b.name}</option>)}</Select>}</Field>
          {numF('Capacity', 'capacity_persons', 'persons')}
          {numF('Covered living area', 'covered_area_m2', 'm²')}
          {numF('Water supply', 'water_l_day', 'L per day')}
          {numF('Bathing facilities', 'bathing')}
          {numF('Toilets for males', 'toilets_male')}
          {numF('Toilets for females', 'toilets_female')}
          {numF('Accessible toilets', 'toilets_accessible')}
          <Field label="Latitude" optional>{(id) => <Input id={id} type="number" step="0.00001" value={c.lat ?? ''} onChange={(e) => set({ lat: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
          <Field label="Longitude" optional>{(id) => <Input id={id} type="number" step="0.00001" value={c.lng ?? ''} onChange={(e) => set({ lng: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
        </div>
        {c.kind === 'school_last_resort' && <Notice tone="warn">Schools are a last resort under RA 10821, only where no other suitable structure is available. Coordinate with the DepEd Schools Division.</Notice>}
        <Field label="Hazard screening" optional hint="What the City hazard sheets and the CDRA show at this site, with sources. Screening, not a certification.">
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={1000} value={c.hazard_screening ?? ''} onChange={(e) => set({ hazard_screening: e.target.value || null })} />}</Field>
        <Field label="Structural assessment reference" optional hint="City Engineer or DPWH assessment against RA 12076 Sec. 4(b). ECHO records the reference; it does not certify.">
          {(id, d) => <Input id={id} aria-describedby={d} maxLength={300} value={c.structural_ref ?? ''} onChange={(e) => set({ structural_ref: e.target.value || null })} />}</Field>
        <fieldset className="space-y-2">
          <legend className="font-semibold">RA 12076 Sec. 4 readiness items</legend>
          <p className="text-sm text-muted">Recorded, not certified.</p>
          {RA12076_CHECKS.map((k) => (
            <div key={k.key} className="grid items-center gap-2 border-b border-line py-2 sm:grid-cols-[1fr_9rem]">
              <span className="text-sm">{k.text} <span className="font-data text-xs text-muted">{k.ref}</span></span>
              <Select aria-label={k.text} value={c.ra12076[k.key] ?? 'unknown'} onChange={(e) => set({ ra12076: { ...c.ra12076, [k.key]: e.target.value as 'yes' | 'no' | 'unknown' } })}>
                <option value="unknown">Not checked</option><option value="yes">Yes</option><option value="no">No</option>
              </Select>
            </div>
          ))}
        </fieldset>
        <Field label="Note" optional>{(id) => <Textarea id={id} maxLength={1000} value={c.note ?? ''} onChange={(e) => set({ note: e.target.value || null })} />}</Field>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------- camp report form
type CountKey = 'families' | 'persons' | 'female' | 'male' | 'children' | 'older' | 'pwd' | 'pregnant_lactating' | 'ip' | 'arrivals' | 'departures'
  | 'water_l_day' | 'toilets_functional' | 'bathing_functional' | 'referrals_cp' | 'referrals_gbv' | 'referrals_health';
const COUNT_FIELDS: [CountKey, string][] = [
  ['families', 'Families'], ['persons', 'Persons'], ['female', 'Women and girls'], ['male', 'Men and boys'], ['children', 'Children (0–17)'],
  ['older', 'Older persons (60+)'], ['pwd', 'Persons with disability'], ['pregnant_lactating', 'Pregnant and lactating women'], ['ip', 'Indigenous Peoples'],
  ['arrivals', 'Arrivals since last report'], ['departures', 'Departures since last report'],
];
const WASH_FIELDS: [CountKey, string][] = [['water_l_day', 'Safe water (L per day)'], ['toilets_functional', 'Working toilets'], ['bathing_functional', 'Working bathing facilities']];
const REF_FIELDS: [CountKey, string][] = [['referrals_cp', 'Child protection referrals'], ['referrals_gbv', 'GBV referrals'], ['referrals_health', 'Health or MHPSS referrals']];

function ReportForm({ centre, last, activationId, open, onClose }: { centre: EvacuationCentre; last: CampReport | null; activationId: string | null; open: boolean; onClose: () => void }) {
  const { roles } = useAuth();
  const toast = useToast();
  const authority = canChangeLevel(roles);
  const [phase, setPhase] = useState<CampPhase>(last && last.phase !== 'closed' ? (last.phase === 'opening' ? 'open' : last.phase) : 'opening');
  // Each report starts blank: nothing is carried over (a blank is "not reported"), except the services for reference.
  const [v, setV] = useState<Record<CountKey, string>>(() => Object.fromEntries([...COUNT_FIELDS, ...WASH_FIELDS, ...REF_FIELDS].map(([k]) => [k, ''])) as Record<CountKey, string>);
  const [services, setServices] = useState<Record<string, 'yes' | 'partial' | 'no'>>(last?.services ?? {});
  const [needs, setNeeds] = useState('');
  const [authRef, setAuthRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const parsed: Partial<Record<CountKey, number | null>> = {};
    for (const [k, label] of [...COUNT_FIELDS, ...WASH_FIELDS, ...REF_FIELDS]) {
      const x = parseWhole(v[k]);
      if (x === 'invalid') { setProblems([`${label}: enter a whole number, 0 or more, or leave it blank if not reported.`]); return; }
      parsed[k] = x;
    }
    const r: CampReport & { _new: true } = {
      _new: true, id: uuid(), activation_id: activationId, centre_id: centre.id, reported_at: new Date().toISOString(), phase,
      families: parsed.families ?? null, persons: parsed.persons ?? null, female: parsed.female ?? null, male: parsed.male ?? null, children: parsed.children ?? null,
      older: parsed.older ?? null, pwd: parsed.pwd ?? null, pregnant_lactating: parsed.pregnant_lactating ?? null, ip: parsed.ip ?? null,
      arrivals: parsed.arrivals ?? null, departures: parsed.departures ?? null, water_l_day: parsed.water_l_day ?? null,
      toilets_functional: parsed.toilets_functional ?? null, bathing_functional: parsed.bathing_functional ?? null, services,
      referrals_cp: parsed.referrals_cp ?? null, referrals_gbv: parsed.referrals_gbv ?? null, referrals_health: parsed.referrals_health ?? null,
      unmet_needs: needs.trim() || null, authority_ref: authRef.trim() || null, remarks: remarks.trim() || null, created_at: new Date().toISOString(),
    };
    const p = campReportProblems(r);
    if (p.length) { setProblems(p); return; }
    setBusy(true);
    try {
      if (AUTHORITY_PHASES.includes(phase)) await insertOnline('camp_reports', r, `${PHASE[phase]} of ${centre.name}`);
      else await save('camp_reports', r, `Camp report: ${centre.name}`);
      toast(`${centre.name}: ${PHASE[phase].toLowerCase()} recorded`);
      onClose();
    } catch (e) { setProblems([e instanceof Error ? e.message : 'The report could not be saved.']); } finally { setBusy(false); }
  };
  const phases: CampPhase[] = ['opening', 'open', 'consolidating', 'closing', 'closed'];
  return (
    <Sheet open={open} onClose={onClose} title={`Camp report: ${centre.name}`}
      footer={<><Button variant="secondary" tip="Close without saving" onClick={onClose}>Cancel</Button><Button busy={busy} tip="Save this aggregate report" onClick={submit}>Save report</Button></>}>
      <div className="space-y-4">
        <Notice tone="warn">Counts only. No names, DAFAC numbers or case details. Leave a count blank if it is not known; enter 0 only when confirmed.</Notice>
        {problems.map((p) => <Notice key={p} tone="bad">{p}</Notice>)}
        <ChoiceGroup legend="Phase" value={phase} onChange={setPhase} columns={3}
          options={phases.map((ph) => ({ value: ph, label: PHASE[ph], disabled: AUTHORITY_PHASES.includes(ph) && !authority,
            disabledReason: 'Opening, closing and closure are authorised decisions: the EOC Manager or the CDRRMO Head files them' }))} />
        {AUTHORITY_PHASES.includes(phase) && (
          <Field label="Authority reference" hint="The order, memo or logbook entry that records the decision. Needs a connection.">
            {(id, d) => <Input id={id} aria-describedby={d} maxLength={200} value={authRef} onChange={(e) => setAuthRef(e.target.value)} />}
          </Field>
        )}
        <fieldset><legend className="mb-2 font-semibold">Population (aggregate)</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COUNT_FIELDS.map(([k, label]) => <Field key={k} label={label}>{(id) => <Input id={id} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>)}
          </div></fieldset>
        <fieldset><legend className="mb-2 font-semibold">Water and sanitation</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WASH_FIELDS.map(([k, label]) => <Field key={k} label={label}>{(id) => <Input id={id} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>)}
          </div></fieldset>
        <fieldset><legend className="mb-2 font-semibold">Services</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <label key={s.key} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm">
                <span>{s.label}</span>
                <Select aria-label={s.label} className="w-32" value={services[s.key] ?? ''} onChange={(e) => {
                  const next = { ...services }; if (e.target.value) next[s.key] = e.target.value as 'yes'; else delete next[s.key]; setServices(next);
                }}><option value="">Not checked</option><option value="yes">Yes</option><option value="partial">Partial</option><option value="no">No</option></Select>
              </label>
            ))}
          </div></fieldset>
        <fieldset><legend className="mb-2 font-semibold">Referrals (counts only)</legend>
          <p className="mb-2 text-sm text-muted">Referrals go through the confidential pathways of the CSWDO, the WCPD and the CHO. Record only how many.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {REF_FIELDS.map(([k, label]) => <Field key={k} label={label}>{(id) => <Input id={id} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>)}
          </div></fieldset>
        <Field label="Unmet needs" optional hint="What is short and how much, for the EOC dashboard. No personal details.">
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={1000} value={needs} onChange={(e) => setNeeds(e.target.value)} />}</Field>
        <Field label="Remarks" optional>{(id) => <Textarea id={id} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />}</Field>
      </div>
    </Sheet>
  );
}

function FeedbackForm({ centre, activationId, open, onClose }: { centre: EvacuationCentre | null; activationId: string | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState<FeedbackCategory>('access_inclusion');
  const [summary, setSummary] = useState('');
  const [office, setOffice] = useState('');
  const submit = async () => {
    const f: CampFeedback & { _new: true } = { _new: true, id: uuid(), version: 1, activation_id: activationId, centre_id: centre?.id ?? null, category, status: 'open',
      summary: summary.trim(), action_office: office.trim() || null, closed_at: null };
    await save('camp_feedback', f, `Feedback: ${FEEDBACK[category]}`);
    toast('Feedback logged'); setSummary(''); setOffice(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log feedback or a service gap"
      footer={<><Button variant="secondary" tip="Close without saving" onClick={onClose}>Cancel</Button><Button tip="Add to the feedback log" disabled={summary.trim().length < 3} onClick={submit}>Log</Button></>}>
      <div className="space-y-3">
        <Notice tone="warn">Describe the service issue, not the person or the case. Referrals use confidential pathways outside MODE.</Notice>
        <Field label="Category">{(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>{Object.entries(FEEDBACK).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Summary" hint={`${500 - summary.length} characters left`}>{(id, d) => <Textarea id={id} aria-describedby={d} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} />}</Field>
        <Field label="Office acting" optional>{(id) => <Input id={id} maxLength={120} value={office} onChange={(e) => setOffice(e.target.value)} placeholder="For example CSWDO, CHO, CGSO" />}</Field>
      </div>
    </Sheet>
  );
}

export function FeedbackList({ items, canEdit }: { items: CampFeedback[]; canEdit: boolean }) {
  const toast = useToast();
  if (!items.length) return <p className="text-sm text-muted">No feedback logged.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).map((f) => (
        <li key={f.id} className="flex flex-wrap items-start gap-3 py-2">
          <span className="min-w-0 flex-1"><span className="block font-semibold">{FEEDBACK[f.category]}</span><span className="block text-sm">{f.summary}</span>
            <span className="block text-xs text-muted">{fmtDateTime(f.created_at)}{f.action_office ? ` · ${f.action_office}` : ''}</span></span>
          {canEdit ? (
            <Select aria-label="Status" className="w-56" value={f.status} onChange={async (e) => {
              await save('camp_feedback', { ...f, status: e.target.value as CampFeedback['status'] }, 'Update feedback status'); toast('Status updated');
            }}>{Object.entries(FEEDBACK_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          ) : <Badge tone={f.status === 'closed' ? 'ok' : 'warn'}>{FEEDBACK_STATUS[f.status]}</Badge>}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------- pages
export function EchoCamps() {
  const data = useCamps();
  const { roles } = useAuth();
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [fb, setFb] = useState(false);
  if (!data) return <Loading />;
  const can = canOperate(roles);
  const list = data.centres.filter((c) => showAll || (c.verification_status !== 'superseded' && c.verification_status !== 'training'))
    .sort((a, b) => Number(!!data.latest.get(b.id)) - Number(!!data.latest.get(a.id)) || a.name.localeCompare(b.name));
  const openFb = data.feedback.filter((f) => f.status !== 'closed' && (!data.activation || f.activation_id === data.activation.id));
  return (
    <div className="page">
      <PageHeader title="ECHO" subtitle="Evacuation and Camp Handling Operations"
        actions={can && <div className="flex flex-wrap gap-2">
          <Button icon={Plus} tip="Add an evacuation centre to the inventory" onClick={() => setAdding(true)}>Add centre</Button>
          <Button variant="secondary" icon={MessageSquarePlus} tip="Log feedback or a service gap not tied to one centre" onClick={() => setFb(true)}>Log feedback</Button>
        </div>} />
      <Tabs items={ECHO_TABS} />
      <Notice tone={data.activation ? 'info' : 'neutral'} title={data.activation ? 'Activation in progress' : 'No activation'}>
        {data.activation ? `Camp reports since ${fmtDateTime(data.window.from)} count for this activation. Earlier events are not counted.`
          : 'At White level the list shows reports from the last 24 hours. Camp reports are normally filed while the EOC is at Blue or Red.'}
      </Notice>
      <Section title={`Evacuation centres (${list.length})`} action={<label className="flex items-center gap-2 text-sm" {...tip('Include training sites and superseded entries')}>
        <input type="checkbox" className="h-4 w-4" checked={showAll} onChange={() => setShowAll(!showAll)} />Show all</label>}>
        {list.length === 0 ? (
          <EmptyState title="The inventory is empty" body="Add each evacuation centre with its capacity, covered area, WASH counts and RA 12076 items. Entries start as pending field validation; the CDRRMO Head or the EOC Manager records the field verification."
            action={can && <Button icon={Plus} tip="Add the first centre" onClick={() => setAdding(true)}>Add centre</Button>} />
        ) : (
          <List>
            {list.map((c) => {
              const r = data.latest.get(c.id) ?? null;
              const u = utilisation(r?.persons ?? null, c.capacity_persons);
              const scr = centreScreening(c);
              return (
                <ListRow key={c.id} to={`/tools/echo/camps/${c.id}`} tip="Open this centre: inventory, camp reports and feedback" tone={u !== null && u > 1 ? 'bad' : undefined}
                  title={c.name}
                  meta={<>
                    {data.bgyName.get(c.barangay_psgc ?? '') ?? 'Barangay not set'} · capacity {fmt(c.capacity_persons)}
                    {r ? ` · ${fmt(r.persons)} persons, ${relative(r.reported_at, Date.now())}` : ''}
                    {u !== null && <span className="mt-1 block max-w-xs"><Meter value={Math.min(u, 1)} label={`${c.name} occupancy`} tone={u > 1 ? 'bad' : u > 0.9 ? 'warn' : 'action'} /></span>}
                  </>}
                  trailing={<span className="flex flex-col items-end gap-1">
                    {r ? <Badge tone={PHASE_TONE[r.phase]}>{PHASE[r.phase]}</Badge> : <Badge>No report</Badge>}
                    <Badge tone={VERIFICATION_TONE[c.verification_status]}>{VERIFICATION[c.verification_status]}</Badge>
                    {scr.tone === 'warn' && <Badge tone="warn">{scr.label}</Badge>}
                  </span>} />
              );
            })}
          </List>
        )}
      </Section>
      <Section title={`Open feedback (${openFb.length})`}>
        <FeedbackList items={openFb} canEdit={can} />
      </Section>
      {adding && <CentreForm open onClose={() => setAdding(false)} initial={blankCentre()} />}
      {fb && <FeedbackForm open centre={null} activationId={data.activation?.id ?? null} onClose={() => setFb(false)} />}
    </div>
  );
}

export function EchoCentre() {
  const { id } = useParams();
  const data = useCamps();
  const { roles } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [report, setReport] = useState(false);
  const [fb, setFb] = useState(false);
  const c = data?.centres.find((x) => x.id === id);
  const history = useMemo(() => (data?.reports ?? []).filter((r) => r.centre_id === id).sort((a, b) => b.reported_at.localeCompare(a.reported_at)), [data, id]);
  if (!data) return <Loading />;
  if (!c) return <div className="page"><PageHeader title="Centre not found" back="/tools/echo/camps" /></div>;
  const can = canOperate(roles);
  const authority = canChangeLevel(roles);
  const last = data.latest.get(c.id) ?? null;
  const scr = centreScreening(c);
  const w = waterCheck(last?.persons ?? null, last?.water_l_day ?? null);
  const sp = spaceCheck(last?.persons ?? null, c.covered_area_m2);
  const t = last ? toiletCheck(last, { male: null, female: null, accessible: null, total: last.toilets_functional }, 'short') : null;
  const u = utilisation(last?.persons ?? null, c.capacity_persons);
  const training = c.verification_status === 'training';
  const setStatus = async (s: EvacuationCentre['verification_status']) => {
    try { await updateOnline('evacuation_centers', c, { verification_status: s }, s === 'field_verified' ? 'Field verification' : 'Retiring a centre'); toast(s === 'field_verified' ? 'Field verification recorded' : 'Centre retired from the inventory'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Not saved', 'bad'); }
  };
  return (
    <div className="page">
      <PageHeader title={c.name} back="/tools/echo/camps"
        subtitle={<span className="flex flex-wrap gap-2"><Badge tone={VERIFICATION_TONE[c.verification_status]}>{VERIFICATION[c.verification_status]}</Badge>
          {last ? <Badge tone={PHASE_TONE[last.phase]}>{PHASE[last.phase]}</Badge> : <Badge>No report this activation</Badge>}<Badge>{KIND[c.kind]}</Badge></span>}
        actions={<div className="flex flex-wrap gap-2">
          {can && !training && c.verification_status !== 'superseded' && <Button icon={ClipboardList} tip="File an aggregate camp report for this centre" onClick={() => setReport(true)}>Camp report</Button>}
          {can && <Button variant="secondary" icon={MessageSquarePlus} tip="Log feedback or a service gap at this centre" onClick={() => setFb(true)}>Feedback</Button>}
          {can && c.verification_status !== 'superseded' && <Button variant="secondary" icon={Pencil} tip="Edit the inventory record" onClick={() => setEdit(true)}>Edit</Button>}
        </div>} />
      {training && <Notice tone="info">Training site: used in exercises only. Camp reports are not filed for it.</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Now" className="lg:col-span-2">
          {!last ? <EmptyState title="No camp report in this activation" body="File the first report when the centre opens. Opening is an authorised decision: the EOC Manager or the CDRRMO Head records it with the authority reference." /> : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Latest report {fmtDateTime(last.reported_at)} ({relative(last.reported_at, Date.now())}).</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-sm text-muted">Occupancy</p><p className="font-data text-2xl font-bold">{fmt(last.persons)} <span className="text-base font-normal text-muted">/ {fmt(c.capacity_persons)}</span></p>
                  {u !== null && <Meter value={Math.min(u, 1)} label="Occupancy" tone={u > 1 ? 'bad' : u > 0.9 ? 'warn' : 'action'} />}</div>
                <div><p className="text-sm text-muted">Families</p><p className="font-data text-2xl font-bold">{fmt(last.families)}</p></div>
                <div><p className="text-sm text-muted">Water per person</p><p className="font-data text-2xl font-bold">{w.perPerson === null ? '—' : `${w.perPerson.toFixed(1)} L`}</p>
                  <p className="text-xs text-muted">Sphere 15 L initial; JMC 52 L prolonged</p></div>
              </div>
              <ul className="flex flex-wrap gap-2">
                {w.meetsSphere === false && <li><Badge tone="bad">Water below 15 L per person</Badge></li>}
                {sp.meets === false && <li><Badge tone="warn">Below 3.5 m² per person</Badge></li>}
                {t && t.available.total !== null && last.persons ? <li><Badge tone={t.available.total >= t.jmc ? 'ok' : 'warn'}>Toilets {t.available.total} / {t.jmc} at JMC 1:50</Badge></li> : null}
                {u !== null && u > 1 && <li><Badge tone="bad">Over capacity</Badge></li>}
              </ul>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[['Children', last.children], ['Older persons', last.older], ['Persons with disability', last.pwd], ['Pregnant or lactating', last.pregnant_lactating],
                  ['Women and girls', last.female], ['Men and boys', last.male], ['Arrivals', last.arrivals], ['Departures', last.departures]].map(([k, val]) => (
                  <div key={k as string}><dt className="text-muted">{k}</dt><dd className="font-data font-semibold">{fmt(val as number | null)}</dd></div>
                ))}
              </dl>
              {last.unmet_needs && <Notice tone="warn" title="Unmet needs">{last.unmet_needs}</Notice>}
              <div className="flex flex-wrap gap-1">{SERVICES.map((s) => last.services[s.key] && (
                <Badge key={s.key} tone={last.services[s.key] === 'yes' ? 'ok' : last.services[s.key] === 'partial' ? 'warn' : 'bad'}>{s.label}: {last.services[s.key]}</Badge>))}</div>
            </div>
          )}
        </Section>
        <Section title="Screening">
          <Badge tone={scr.tone}>{scr.label}</Badge>
          {scr.notes.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{scr.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <p className="mt-2 text-xs text-muted">Screening from what is recorded. It never certifies the centre as safe.</p>
          {authority && c.verification_status === 'pending_field_validation' && (
            <Button className="mt-3" variant="secondary" icon={ShieldCheck} tip="Record that the inventory data were checked in the field (needs a connection). This is not a safety certificate." onClick={() => setStatus('field_verified')}>Record field verification</Button>
          )}
          {authority && c.verification_status !== 'superseded' && !training && (
            <Button className="mt-2" variant="quiet" tip="Retire this entry from the inventory (it is kept as a record)" onClick={() => setStatus('superseded')}>Retire entry</Button>
          )}
        </Section>
      </div>
      <Section title="Inventory record">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[['Code', c.code ?? '—'], ['Barangay', data.bgyName.get(c.barangay_psgc ?? '') ?? '—'], ['Capacity', fmt(c.capacity_persons)], ['Covered area', `${fmt(c.covered_area_m2)} m²`],
            ['Persons at 3.5 m²', fmt(spaceCheck(0, c.covered_area_m2).capacityAtStandard)], ['Water supply', `${fmt(c.water_l_day)} L per day`],
            ['Toilets M / F / accessible', `${fmt(c.toilets_male)} / ${fmt(c.toilets_female)} / ${fmt(c.toilets_accessible)}`], ['Bathing', fmt(c.bathing)],
            ['Location', c.lat !== null ? `${c.lat.toFixed(5)}, ${c.lng!.toFixed(5)}` : 'Not set'], ['Structural assessment', c.structural_ref ?? 'Not recorded'],
            ['Verified', c.verified_at ? fmtDateTime(c.verified_at) : '—']].map(([k, val]) => (
            <div key={k}><dt className="text-muted">{k}</dt><dd className="font-semibold">{val}</dd></div>
          ))}
        </dl>
        {c.hazard_screening && <p className="mt-3 text-sm"><span className="font-semibold">Hazard screening: </span>{c.hazard_screening}</p>}
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold" {...tip('Show the RA 12076 Sec. 4 items recorded for this centre')}>RA 12076 Sec. 4 items</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {RA12076_CHECKS.map((k) => <li key={k.key} className="flex justify-between gap-3 py-1.5"><span>{k.text}</span>
              <Badge tone={c.ra12076[k.key] === 'yes' ? 'ok' : c.ra12076[k.key] === 'no' ? 'bad' : 'neutral'}>{c.ra12076[k.key] === 'yes' ? 'Yes' : c.ra12076[k.key] === 'no' ? 'No' : 'Not checked'}</Badge></li>)}
          </ul>
        </details>
      </Section>
      <Section title={`Camp reports (${history.length})`}>
        {history.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">When</th><th className="py-2">Phase</th><th className="py-2 text-right">Families</th><th className="py-2 text-right">Persons</th><th className="py-2 text-right">Water L/day</th><th className="py-2">Authority or remarks</th></tr></thead>
              <tbody className="divide-y divide-line">
                {history.map((r) => <tr key={r.id}><td className="py-2">{fmtDateTime(r.reported_at)}</td><td className="py-2"><Badge tone={PHASE_TONE[r.phase]}>{PHASE[r.phase]}</Badge></td>
                  <td className="py-2 text-right font-data">{fmt(r.families)}</td><td className="py-2 text-right font-data">{fmt(r.persons)}</td><td className="py-2 text-right font-data">{fmt(r.water_l_day)}</td>
                  <td className="py-2">{r.authority_ref ?? r.remarks ?? ''}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Feedback at this centre">
        <FeedbackList items={data.feedback.filter((f) => f.centre_id === c.id)} canEdit={can} />
      </Section>
      {edit && <CentreForm open onClose={() => setEdit(false)} initial={c} />}
      {report && <ReportForm open centre={c} last={last} activationId={data.activation?.id ?? null} onClose={() => setReport(false)} />}
      {fb && <FeedbackForm open centre={c} activationId={data.activation?.id ?? null} onClose={() => setFb(false)} />}
    </div>
  );
}
