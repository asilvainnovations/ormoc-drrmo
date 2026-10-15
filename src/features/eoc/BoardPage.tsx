import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Send } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useEocStatus, useOnline } from '@/lib/hooks';
import { env } from '@/lib/env';
import { canChangeLevel, canOperate, LEVEL_INFO } from '@/domain/eoc';
import { fmtDateTime, fmtTime, relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, Input, List, ListRow, Notice, PageHeader, Section, Select, Tabs, Textarea, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { BarangayReport, EocLevel } from '@/types';
import { addLog, setEocLevel } from './actions';
import { CONDITION, CONDITION_TONE, EOC_TABS, LOG_CATEGORY, PRIORITY, REQUEST_STATUS, SITREP_STATUS } from './labels';

export function BoardPage() {
  const { roles, userId } = useAuth();
  const toast = useToast();
  const online = useOnline();
  const { level, activation } = useEocStatus();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState('');
  const data = useLiveQuery(async () => {
    const reports = await db.barangay_reports.orderBy('reported_at').reverse().toArray();
    const latest = new Map<string, BarangayReport>();
    for (const r of reports) if (!latest.has(r.barangay_psgc)) latest.set(r.barangay_psgc, r);
    const brgy = new Map((await db.barangays.toArray()).map((b) => [b.psgc, b]));
    const open = (await db.resource_requests.where('status').anyOf('requested', 'approved', 'mobilized').toArray())
      .sort((a, b) => (a.priority === 'life_safety' ? -1 : 0) - (b.priority === 'life_safety' ? -1 : 0));
    return {
      log: (await db.logbook_entries.orderBy('occurred_at').reverse().limit(8).toArray()),
      latest: Array.from(latest.values()).map((r) => ({ ...r, name: brgy.get(r.barangay_psgc)?.name ?? r.barangay_psgc })),
      barangayCount: brgy.size,
      open,
      sitrep: (await db.sitreps.orderBy('period_end').reverse().first()),
    };
  }, []);
  const operator = canOperate(roles);
  const tone = level === 'white' ? 'bg-lvl-white text-lvl-white-ink' : level === 'blue' ? 'bg-lvl-blue text-on-level' : 'bg-lvl-red text-on-level';
  const affected = data?.latest.filter((r) => r.condition !== 'normal') ?? [];
  const evac = data?.latest.reduce((s, r) => ({ fam: s.fam + r.families_evacuated, per: s.per + r.persons_evacuated }), { fam: 0, per: 0 });

  const log = async () => {
    if (!entry.trim()) return;
    await addLog(entry, 'general', userId); setEntry(''); toast('Logged');
  };

  return (
    <div className="page">
      <PageHeader title="EOC operations" />
      <Tabs items={EOC_TABS} />

      <section className={clsx('mb-8 rounded-sheet px-5 py-5', tone)} aria-label="Activation level">
        <p className="text-3xl font-bold">{LEVEL_INFO[level].name} level</p>
        <p className="mt-1 text-lg">{LEVEL_INFO[level].meaning}</p>
        {activation && <p className="mt-2 text-sm opacity-90">Since {fmtDateTime(activation.started_at)}. {activation.reason}</p>}
        {canChangeLevel(roles) && (
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setOpen(true)} className="!border-transparent !bg-surface !text-ink">Change level</Button>
            {!env.demo && !online && <p className="mt-2 text-sm">Changing the level needs a connection.</p>}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Section title="Logbook" action={<TextLink size="sm" to="/eoc/log">All entries</TextLink>}>
          {operator && (
            <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void log(); }}>
              <label htmlFor="quick-log" className="sr-only">New logbook entry</label>
              <Input id="quick-log" placeholder="What happened, who decided, what was sent" value={entry} onChange={(e) => setEntry(e.target.value)} />
              <Button type="submit" icon={Send} aria-label="Add to logbook" disabled={!entry.trim()}><span className="hidden sm:inline">Log</span></Button>
            </form>
          )}
          <List>
            {data?.log.map((l) => <ListRow key={l.id} title={l.entry} meta={`${fmtTime(l.occurred_at)}, ${LOG_CATEGORY[l.category]}`} />)}
          </List>
          {data?.log.length === 0 && <p className="text-muted">No entries yet.</p>}
        </Section>

        <Section title="Barangays" action={<TextLink size="sm" to="/eoc/barangays">Report status</TextLink>}>
          {data && data.barangayCount === 0 ? (
            <Notice tone="info">No barangay list loaded. An administrator imports the 110 barangays with their PSGC codes in Settings.</Notice>
          ) : (
            <>
              <p className="mb-2 text-muted">{affected.length} reporting a condition. Evacuated: {evac?.fam ?? 0} families, {evac?.per ?? 0} persons.</p>
              <List>{affected.slice(0, 8).map((r) => (
                <ListRow key={r.id} title={r.name} meta={`${relative(r.reported_at)}${r.remarks ? `, ${r.remarks}` : ''}`}
                  trailing={<Badge tone={CONDITION_TONE[r.condition]}>{CONDITION[r.condition]}</Badge>} />))}
              </List>
            </>
          )}
        </Section>

        <Section title="Open resource requests" action={<TextLink size="sm" to="/eoc/requests">All requests</TextLink>}>
          {data?.open.length === 0 ? <p className="text-muted">None open.</p> : (
            <List>{data?.open.map((r) => <ListRow key={r.id} to="/eoc/requests" title={`${r.quantity} ${r.unit} ${r.item}`} meta={`${r.requesting_party}, ${relative(r.requested_at)}`}
              trailing={<span className="flex flex-col items-end gap-1"><Badge tone={r.priority === 'life_safety' ? 'bad' : 'neutral'}>{PRIORITY[r.priority]}</Badge><Badge>{REQUEST_STATUS[r.status]}</Badge></span>} />)}</List>
          )}
        </Section>

        <Section title="Latest SitRep" action={<TextLink size="sm" to="/eoc/sitreps">SitReps</TextLink>}>
          {data?.sitrep ? (
            <List><ListRow to={`/eoc/sitreps/${data.sitrep.id}`} title={data.sitrep.seq ? `SitRep No. ${data.sitrep.seq}` : 'Draft SitRep'}
              meta={`Period to ${fmtDateTime(data.sitrep.period_end)}`} trailing={<Badge tone={data.sitrep.status === 'approved' ? 'ok' : data.sitrep.status === 'submitted' ? 'info' : 'neutral'}>{SITREP_STATUS[data.sitrep.status]}</Badge>} /></List>
          ) : <p className="text-muted">No SitRep yet.</p>}
        </Section>
      </div>
      <LevelSheet open={open} onClose={() => setOpen(false)} current={level} onSubmit={async (lv, reason, hazard, auth) => {
        await setEocLevel(lv, reason, hazard, auth, userId); toast(`EOC level is now ${LEVEL_INFO[lv].name}`);
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
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!lv || !reason.trim()} onClick={go}>Change level</Button></>}>
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
