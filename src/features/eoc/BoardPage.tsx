// EOC Board (1.25.0): the operation as one picture. Alert level, five numbers, the 85 barangays as coloured tiles, and the short
// list of what needs attention now. Everything else is one tap away in the tabs.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { ClipboardPen } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useEocStatus, useOnline } from '@/lib/hooks';
import { canChangeLevel, canOperate, evacuationTotals, LEVEL_INFO } from '@/domain/eoc';
import { attentionItems, nextSubmission } from '@/domain/boardAttention';
import { campTotals, latestPerCentre } from '@/domain/echo';
import { fmtDateTime, fmtTime, relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, Input, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { EocLevel } from '@/types';
import { setEocLevel } from './actions';
import { parseSitrepCop, COP_GROUPS, type CopField } from '@/domain/sitrepCompose';
import { EocLocation } from './EocLocation';
import { ModulesPanel } from './ModulesPanel';
import { QuickLogSheet } from './QuickLogSheet';
import { Block, Legend, Ring, Tile } from './kit';
import { BarangayGrid } from './BarangayPicture';
import { useBarangayPicture } from './useBarangayPicture';
import { LOG_CATEGORY, EOC_TABS, PRIORITY, REQUEST_STATUS } from './labels';

const TONE = { bad: 'border-bad bg-bad-soft text-bad', warn: 'border-warn bg-warn-soft text-warn', info: 'border-sky/40 bg-sky-soft text-sky' } as const;

export function BoardPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const online = useOnline();
  const { level, activation } = useEocStatus();
  const [levelOpen, setLevelOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const pic = useBarangayPicture();
  const data = useLiveQuery(async () => {
    const open = (await db.resource_requests.where('status').anyOf('requested', 'approved', 'mobilized').toArray())
      .sort((a, b) => Number(b.priority === 'life_safety') - Number(a.priority === 'life_safety') || b.requested_at.localeCompare(a.requested_at));
    return {
      log: await db.logbook_entries.orderBy('occurred_at').reverse().limit(6).toArray(),
      open,
      resources: await db.resources.toArray(),
      latestSitrep: (await db.sitreps.toArray()).filter((s) => s.status !== 'draft').sort((a, b) => b.period_end.localeCompare(a.period_end))[0] ?? null,
      camps: campTotals(latestPerCentre(await db.camp_reports.toArray(), (await db.eoc_activations.toArray()).find((a) => a.id === activation?.id)?.started_at ?? new Date(Date.now() - 24 * 3600_000).toISOString()),
        new Map((await db.evacuation_centers.toArray()).map((c) => [c.id, c.capacity_persons]))),
    };
  }, [activation?.id]);

  const operator = canOperate(roles);
  const tone = level === 'white' ? 'bg-lvl-white text-lvl-white-ink' : level === 'blue' ? 'bg-lvl-blue text-on-level' : 'bg-lvl-red text-on-level';
  const latest = (pic?.rows ?? []).flatMap((r) => (r.report ? [r.report] : []));
  const evac = evacuationTotals(latest);
  const total = pic?.rows.length ?? 0;
  const reporting = total - (pic?.counts.silent ?? 0);
  const hit = (pic?.counts.affected ?? 0) + (pic?.counts.evacuating ?? 0) + (pic?.counts.isolated ?? 0);
  const lifeSafety = data?.open.filter((r) => r.priority === 'life_safety').length ?? 0;
  const cop = parseSitrepCop(data?.latestSitrep?.lifelines_status ?? null);
  const lifelineFields = COP_GROUPS.lifelines.map(([id, label]) => ({ id, label, field: cop.lifelines[id] })).filter((x) => !!x.field?.status);
  const connectivityFields = COP_GROUPS.connectivity.map(([id, label]) => ({ id, label, field: cop.connectivity[id] })).filter((x) => !!x.field?.status);
  const supplyGaps = (data?.open ?? []).reduce((acc, request) => {
    const key = request.item.trim().toLocaleLowerCase('en') + '|' + request.unit.trim().toLocaleLowerCase('en');
    const found = acc.find((x) => x.key === key);
    if (found) found.requested += request.quantity;
    else acc.push({ key, item: request.item, unit: request.unit, requested: request.quantity, available: (data?.resources ?? []).filter((r) => r.is_serviceable && r.name.trim().toLocaleLowerCase('en') === request.item.trim().toLocaleLowerCase('en') && r.unit.trim().toLocaleLowerCase('en') === request.unit.trim().toLocaleLowerCase('en')).reduce((n, r) => n + r.quantity, 0) });
    return acc;
  }, [] as { key: string; item: string; unit: string; requested: number; available: number }[]).map((x) => ({ ...x, gap: Math.max(0, x.requested - x.available) })).sort((a, b) => b.gap - a.gap);
  const attention = attentionItems({
    activeEvent: !!activation,
    silentPriority: (pic?.rows ?? []).filter((r) => r.cond === 'silent' && r.priority != null).sort((a, b) => a.priority! - b.priority!).slice(0, 10).map((r) => r.b.name),
    lifeSafetyAwaiting: data?.open.filter((r) => r.priority === 'life_safety' && r.status === 'requested').length ?? 0,
    campsOverCapacity: data?.camps.overCapacity ?? 0,
    familyUnity: data ? { children: data.camps.unaccompaniedChildren + data.camps.separatedChildren, carers: data.camps.carerSeparations, families: data.camps.familiesApart } : undefined,
    evacCountsMissing: evac.notReported,
    nextSitrep: nextSubmission(pic?.cutoff),
  });

  return (
    <div className="page">
      <PageHeader title="EOC Operations" subtitle="Level changes need a connection and the EOC Manager or CDRRMO Head." />
      <Tabs items={EOC_TABS} />

      <details className="mb-5 rounded-sheet border border-line bg-surface p-4 shadow-raised">
        <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
          <span className="flex items-center gap-2"><ClipboardPen className="h-5 w-5 text-sky" aria-hidden />Operational tools and simulators</span>
          <span className="text-xs font-normal text-muted">Expand tools</span>
        </summary>
        <p className="mt-2 text-sm text-muted">Decision-support and training workspaces. Simulators are for exercises and planning; they do not replace approved command authority, official warnings or live operational decisions.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/tools/flood-intelligence" className="rounded-control border border-line p-3 hover:border-sky hover:bg-sky-soft/40">
            <span className="block font-semibold text-ink">Flood intelligence</span>
            <span className="mt-1 block text-xs text-muted">Barangay flood susceptibility, watch information and official warning sources</span>
          </Link>
          <Link to="/tools/ics" className="rounded-control border border-line p-3 hover:border-sky hover:bg-sky-soft/40">
            <span className="block font-semibold text-ink">ICS Simulator</span>
            <span className="mt-1 block text-xs text-muted">Incident Command System exercise and role-based simulation</span>
          </Link>
          <Link to="/tools/pscp" className="rounded-control border border-line p-3 hover:border-sky hover:bg-sky-soft/40">
            <span className="block font-semibold text-ink">PSCP Simulator</span>
            <span className="mt-1 block text-xs text-muted">Public Service Continuity Plan exercise workspace</span>
          </Link>
          <Link to="/tools/echo" className="rounded-control border border-line p-3 hover:border-sky hover:bg-sky-soft/40">
            <span className="block font-semibold text-ink">ECHO</span>
            <span className="mt-1 block text-xs text-muted">Evacuation and Camp Handling Operations simulator</span>
          </Link>
        </div>
      </details>


      <section className={clsx('mb-5 flex flex-wrap items-center justify-between gap-4 rounded-sheet px-5 py-4', tone)} aria-label="Activation level">
        <div>
          <p className="text-3xl font-extrabold">{LEVEL_INFO[level].name} level</p>
          <p className="text-base">{LEVEL_INFO[level].meaning}</p>
          <p className="mt-1 text-sm opacity-90">{activation ? 'Activation active · operational period began ' + fmtDateTime(activation.started_at) : 'No active EOC activation'}{activation?.reason ? ' · ' + activation.reason : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {operator && <Button tip="Add a logbook entry with a short form" icon={ClipboardPen} onClick={() => setLogOpen(true)} className="!border-transparent !bg-surface !text-ink">Log</Button>}
          {canChangeLevel(roles) && <Button tip="Raise or lower the EOC alert level (needs a connection)" variant="secondary" onClick={() => setLevelOpen(true)} className="!border-transparent !bg-surface !text-ink">Change level</Button>}
          {canChangeLevel(roles) && !online && <p className="w-full text-sm">Changing the level needs a connection.</p>}
        </div>
      </section>

      <ModulesPanel activation={activation} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Barangays reporting" value={`${reporting}`} hint={`of ${total}${pic?.window.kind === 'event' ? ' this activation' : ' in 24 h'}`} to="/eoc/barangays">
          <div className="mt-3"><Ring value={reporting} max={total || 1} tone={total && reporting / total < 0.5 && !!activation ? 'warn' : 'ok'} size={56}>{total ? `${Math.round((100 * reporting) / total)}%` : '–'}</Ring></div>
        </Tile>
        <Tile label="Hit or isolated" value={hit} tone={hit > 0 ? 'warn' : undefined} hint={`${pic?.counts.isolated ?? 0} isolated · ${pic?.counts.evacuating ?? 0} evacuating`} to="/eoc/barangays" />
        <Tile label="Evacuated" value={evac.persons.toLocaleString('en-PH')} hint={`persons · ${evac.families.toLocaleString('en-PH')} families${evac.notReported ? ` · ${evac.notReported} not counted` : ''}`} to="/eoc/barangays" />
        <Tile label="Open requests" value={data?.open.length ?? 0} tone={lifeSafety ? 'bad' : undefined} hint={lifeSafety ? `${lifeSafety} life safety` : 'none life safety'} to="/eoc/requests" />
        <Tile label="Centres open" value={data?.camps.centresOpen ?? 0} tone={data?.camps.overCapacity ? 'bad' : undefined}
          hint={data?.camps.centresOpen ? `${data.camps.persons.toLocaleString('en-PH')} persons${data.camps.overCapacity ? ` · ${data.camps.overCapacity} over capacity` : ''}` : 'ECHO camp reports'} to="/tools/echo/dashboard" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Block title="Critical lifelines" action={<Link to="/eoc/sitreps" className="text-sm font-semibold text-info underline">Source SitRep</Link>}>
          <p className="mb-3 text-xs text-muted">{data?.latestSitrep ? 'Latest submitted / approved SitRep · ' + fmtDateTime(data.latestSitrep.period_end) : 'No submitted or approved SitRep has lifeline data yet.'} · Unknown and unreported values are not assumed normal.</p>
          {lifelineFields.length ? <ul className="grid gap-2 sm:grid-cols-2">{lifelineFields.map(({id,label,field}) => <li key={id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm"><span className="font-semibold">{label}</span><CopStatusBadge field={field}/></li>)}</ul> : <p className="text-sm text-muted">No lifeline statuses recorded in the latest report.</p>}
        </Block>
        <Block title="Regional connectivity" action={<Link to="/eoc/sitreps" className="text-sm font-semibold text-info underline">Update in SitRep</Link>}>
          {connectivityFields.length ? <ul className="space-y-2">{connectivityFields.map(({id,label,field}) => <li key={id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2 text-sm"><span className="font-semibold">{label}</span><CopStatusBadge field={field}/></li>)}</ul> : <p className="text-sm text-muted">Cebu, Tacloban, Baybay, Kananga and Northern Leyte connectivity has not yet been reported.</p>}
        </Block>
      </div>
      <Block title="Resource sufficiency snapshot" className="mb-5" action={<Link to="/eoc/resources" className="text-sm font-semibold text-info underline">Supply</Link>}>
        <p className="mb-3 text-xs text-muted">Compares open request quantities with serviceable inventory using exact item and unit matches only. This is a planning indicator, not a stock reservation or allocation.</p>
        {supplyGaps.length ? <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{supplyGaps.slice(0,6).map((x) => <li key={x.key} className="rounded-control border border-line p-3"><p className="font-bold">{x.item}</p><p className="mt-1 text-xs text-muted">Available {x.available} {x.unit} · Requested {x.requested} {x.unit}</p><p className={clsx('mt-1 text-sm font-extrabold',x.gap?'text-bad':'text-ok')}>{x.gap ? 'Potential gap: ' + x.gap + ' ' + x.unit : 'Matched against current serviceable inventory'}</p></li>)}</ul> : <p className="text-sm text-muted">No open requests to compare.</p>}
      </Block>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Block title="Barangay picture" action={<Link to="/eoc/barangays" className="text-sm font-semibold text-info underline">Open</Link>}>
          {total === 0 ? <p className="text-muted">No barangay list loaded. An administrator imports Ormoc’s 85 barangays in Settings.</p> : (
            <>
              <BarangayGrid rows={pic!.rows} linkTo={operator ? (r) => `/eoc/barangays?b=${r.b.psgc}` : undefined} />
              <div className="mt-4"><Legend counts={pic!.counts} /></div>
            </>
          )}
        </Block>

        <div className="space-y-5">
          <Block title="Needs attention now">
            {attention.length === 0 ? <p className="font-semibold text-ok">Nothing flagged. {activation ? 'Keep consolidating.' : 'No active event.'}</p> : (
              <ul className="space-y-2">{attention.map((a) => (
                <li key={a.id}><Link to={a.to} className={clsx('block rounded-control border px-3 py-2 text-sm font-bold', TONE[a.tone])}>{a.text}</Link></li>))}
              </ul>
            )}
          </Block>
          <Block title="Open requests" action={<Link to="/eoc/requests" className="text-sm font-semibold text-info underline">All</Link>}>
            {data?.open.length ? (
              <ul className="divide-y divide-line">{data.open.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="font-bold">{r.quantity} {r.unit} {r.item}</span><span className="block truncate text-xs text-muted">{r.requesting_party} · {relative(r.requested_at)}</span></span>
                  <span className="flex shrink-0 flex-col items-end gap-1"><Badge tone={r.priority === 'life_safety' ? 'bad' : 'neutral'}>{PRIORITY[r.priority]}</Badge><Badge>{REQUEST_STATUS[r.status]}</Badge></span>
                </li>))}
              </ul>
            ) : <p className="text-muted">None open.</p>}
          </Block>
          <Block title="Logbook" action={<Link to="/eoc/log" className="text-sm font-semibold text-info underline">All entries</Link>}>
            {data?.log.length ? (
              <ul className="divide-y divide-line">{data.log.map((l) => (
                <li key={l.id} className="py-2 text-sm"><span className="font-data text-xs font-bold text-muted">{fmtTime(l.occurred_at)} · {LOG_CATEGORY[l.category]}</span><span className="block">{l.entry}</span></li>))}
              </ul>
            ) : <p className="text-muted">No entries yet.</p>}
          </Block>
        </div>
      </div>

      <div className="mt-5"><EocLocation /></div>

      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <LevelSheet open={levelOpen} onClose={() => setLevelOpen(false)} current={level} onSubmit={async (lv, reason, hazard, auth) => {
        await setEocLevel(lv, reason, hazard, auth); toast(`EOC level is now ${LEVEL_INFO[lv].name}`);
      }} />
    </div>
  );
}

function LevelSheet({ open, onClose, current, onSubmit }: { open: boolean; onClose: () => void; current: EocLevel;
  onSubmit: (l: EocLevel, reason: string, hazard: string | null, authority: string | null) => Promise<void> }) {
  const hazards = useLiveQuery(() => db.hazards.orderBy('sort').toArray(), [], []);
  const [lv, setLv] = useState<EocLevel | null>(null);
  const [reason, setReason] = useState('');
  const [hazard, setHazard] = useState('');
  const [authority, setAuthority] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    if (!lv) return;
    setBusy(true); setError(null);
    try { await onSubmit(lv, reason.trim(), hazard || null, authority.trim() || null); setReason(''); setLv(null); onClose(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Change EOC level"
      footer={<><Button tip="Close without changing the level" variant="secondary" onClick={onClose}>Cancel</Button><Button tip="Change the level now. It is logged with your name, the time and the reason" busy={busy} disabled={!lv || !reason.trim()} onClick={go}>Change level</Button></>}>
      <ChoiceGroup legend="New level" value={lv} onChange={setLv} options={(['white', 'blue', 'red'] as EocLevel[]).map((l) => ({
        value: l, label: LEVEL_INFO[l].name, detail: LEVEL_INFO[l].meaning, disabled: l === current, disabledReason: 'Current level' }))} />
      <Field label="Reason" hint="Recorded in the logbook and shown in the status band.">{(id, d) => <Textarea id={id} aria-describedby={d} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <Field label="Hazard" optional>{(id) => (
        <Select id={id} value={hazard} onChange={(e) => setHazard(e.target.value)}>
          <option value="">None</option>{hazards.map((h) => <option key={h.code} value={h.code}>{h.name}</option>)}
        </Select>)}</Field>
      <Field label="Authority or memo reference" optional>{(id) => <Input id={id} value={authority} onChange={(e) => setAuthority(e.target.value)} />}</Field>
      {error && <p role="alert" className="font-semibold text-bad">{error}</p>}
    </Sheet>
  );
}

function CopStatusBadge({ field }: { field?: CopField }) {
  const status = field?.status ?? 'not_reported';
  const label: Record<string,string> = { normal: 'Operational', limited: 'Limited', disrupted: 'Disrupted', unknown: 'Unknown', not_reported: 'Not reported' };
  const tone = status === 'normal' ? 'ok' : status === 'limited' ? 'warn' : status === 'disrupted' ? 'bad' : 'neutral';
  return <Badge tone={tone}>{label[status] ?? 'Not reported'}</Badge>;
}
