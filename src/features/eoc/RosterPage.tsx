import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { depthSummary, manilaToday, positionDepth, type PositionDepth } from '@/domain/structure';
import { fmtDate } from '@/lib/time';
import { Badge, Button, ChoiceGroup, EmptyState, Field, Input, Meter, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { EocDesignation, EocSection } from '@/types';
import { DESIGNATION_STATUS, EOC_TABS, RANK, SECTION } from './labels';

const SECTIONS: EocSection[] = ['command', 'command_staff', 'operations', 'planning', 'logistics', 'finance_admin', 'cluster_desk', 'barangay_desk'];
const blank = () => ({ rank: 1 as 1 | 2 | 3, office_id: '', designee_position: '', person_id: '', valid_from: manilaToday(), valid_until: '', note: '' });

/**
 * EOC roster (EOC Capability Checklist: 72-hour, three-deep staffing; IAT B4.1, B4.2). Anyone who staffs the EOC may
 * propose a designation, even offline; only the CDRRMO Head approves it, online. An approved designation is fixed.
 */
export function RosterPage() {
  const { has, userId } = useAuth();
  const toast = useToast();
  const canPropose = has('cdrrmo_head') || has('eoc_manager') || has('eoc_staff');
  const isHead = has('cdrrmo_head');
  const canWithdraw = isHead || has('eoc_manager');
  const [target, setTarget] = useState<PositionDepth | null>(null);
  const [form, setForm] = useState(blank());
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => {
    const positions = await db.eoc_positions.toArray();
    const designations = await db.eoc_designations.toArray();
    const offices = (await db.offices.toArray()).sort((a, b) => a.name.localeCompare(b.name));
    const people = (await db.profiles.toArray()).filter((p) => p.is_active).sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { rows: positionDepth(positions, designations, manilaToday()), designations, offices, people };
  }, []);
  if (!data) return null;
  const sum = depthSummary(data.rows);
  const officeName = new Map(data.offices.map((o) => [o.id, o.name]));
  const who = (d: EocDesignation) => [d.designee_position, d.office_id && officeName.get(d.office_id)].filter(Boolean).join(', ') || 'Linked account';

  const propose = async () => {
    if (!target) return;
    if (!form.office_id && !form.person_id) { setProblem('Choose the office, or the account of the person designated.'); return; }
    if (form.valid_until && form.valid_until < form.valid_from) { setProblem('The end date is before the start date.'); return; }
    const row: EocDesignation & { _new: true } = {
      _new: true, id: uuid(), position_id: target.position.id, rank: form.rank, person_id: form.person_id || null, office_id: form.office_id || null,
      designee_position: form.designee_position.trim() || null, status: 'proposed', valid_from: form.valid_from, valid_until: form.valid_until || null,
      note: form.note.trim() || null, proposed_by: userId, approved_by: null, approved_at: null, version: 1,
    };
    await save('eoc_designations', row, `Propose ${RANK[form.rank].toLowerCase()} for ${target.position.title}`);
    setTarget(null); toast(`Proposed: ${RANK[form.rank]} for ${target.position.title}`);
  };
  const decide = async (d: EocDesignation, status: 'approved' | 'withdrawn') => {
    setBusy(true);
    try { await updateOnline('eoc_designations', d, { status }, status === 'approved' ? 'Approving a designation' : 'Withdrawing a designation'); toast(status === 'approved' ? 'Designation approved' : 'Designation withdrawn'); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <PageHeader title="EOC Roster" subtitle="Each EOC position needs a primary and two alternates for 72-hour operations. Designations name a position and office; the CDRRMO Head approves them." />
      <Tabs items={EOC_TABS} />
      {data.rows.length === 0 ? <EmptyState title="No EOC positions yet" body="They arrive with the EOC structure data (operational file 06)." /> : <>
        <Section title="Depth">
          <Meter label={`${sum.twoDeep} of ${sum.positions} positions covered at least two deep`} value={sum.twoDeep} max={sum.positions || 1} tone={sum.share !== null && sum.share >= 0.8 ? 'ok' : 'warn'} />
          <p className="mt-2 text-sm text-muted">{sum.threeDeep} three deep. {sum.noPrimary} without an approved primary.</p>
        </Section>
        {SECTIONS.map((sec) => {
          const rows = data.rows.filter((r) => r.position.section === sec);
          if (!rows.length) return null;
          return (
            <Section key={sec} title={SECTION[sec]}>
              <ul className="space-y-3">
                {rows.map((r) => (
                  <li key={r.position.id} className="rounded-control border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.position.title}</p>
                        <p className="font-data text-xs text-muted">{r.position.code}</p>
                      </div>
                      <Badge tone={r.threeDeep ? 'ok' : r.twoDeep ? 'info' : 'warn'}>{r.approved} of {r.position.required_depth} approved</Badge>
                    </div>
                    <ol className="mt-3 space-y-2">
                      {([1, 2, 3] as const).filter((k) => k <= r.position.required_depth).map((k) => {
                        const d = r.byRank[k];
                        return (
                          <li key={k} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-32 shrink-0 text-muted">{RANK[k]}</span>
                            {d ? <>
                              <span className="min-w-0 flex-1">{who(d)}{d.valid_until ? <span className="text-muted">, until {fmtDate(d.valid_until)}</span> : null}</span>
                              <Badge tone={d.status === 'approved' ? 'ok' : 'warn'}>{DESIGNATION_STATUS[d.status]}</Badge>
                              {isHead && d.status === 'proposed' && <Button tip="Approve this designation. It is then fixed (CDRRMO Head; needs a connection)" disabled={busy} onClick={() => decide(d, 'approved')}>Approve</Button>}
                              {(d.status === 'proposed' ? canPropose : canWithdraw) && <Button tip="Withdraw this designation. It stays on record (needs a connection)" variant="quiet" disabled={busy} onClick={() => decide(d, 'withdrawn')}>Withdraw</Button>}
                            </> : <span className="min-w-0 flex-1 text-muted">Not designated</span>}
                          </li>
                        );
                      })}
                    </ol>
                    {canPropose && <Button tip="Propose a designation for this position. Works offline; the CDRRMO Head approves it" className="mt-3" variant="secondary"
                      onClick={() => { const free = ([1, 2, 3] as const).find((k) => !r.byRank[k]) ?? 1; setForm({ ...blank(), rank: free }); setProblem(null); setTarget(r); }}>Propose designation</Button>}
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
      </>}
      <Sheet open={!!target} onClose={() => setTarget(null)} title={target ? `Propose: ${target.position.title}` : ''}
        footer={<><Button tip="Go back without proposing" variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button tip="Save the proposal. The CDRRMO Head approves it" onClick={propose}>Propose</Button></>}>
        <Notice tone="info">Name the position title and office, not the person. Link an account only if the person uses this app.</Notice>
        <ChoiceGroup legend="Rank" value={form.rank} columns={3} onChange={(v) => setForm({ ...form, rank: v })}
          options={([1, 2, 3] as const).map((k) => ({ value: k, label: RANK[k], tip: `Propose the ${RANK[k].toLowerCase()}` }))} />
        <Field label="Office">{(id, d) => <Select id={id} aria-describedby={d} value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
          <option value="">Choose…</option>{data.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
        <Field label="Position title of the designee" optional hint="For example: Operations Officer III">{(id, d) => <Input id={id} aria-describedby={d} maxLength={160} value={form.designee_position} onChange={(e) => setForm({ ...form, designee_position: e.target.value })} />}</Field>
        <Field label="App account" optional>{(id, d) => <Select id={id} aria-describedby={d} value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
          <option value="">None</option>{data.people.map((p) => <option key={p.id} value={p.id}>{p.position ?? p.full_name}</option>)}</Select>}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">{(id, d) => <Input id={id} aria-describedby={d} type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />}</Field>
          <Field label="Until" optional>{(id, d) => <Input id={id} aria-describedby={d} type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />}</Field>
        </div>
        <Field label="Note" optional error={problem}>{(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>
      </Sheet>
    </div>
  );
}
