// EOC roster (1.25.0): the org chart with the people in it. Every position shows its primary and two alternates by name;
// tap a slot to type or change the name and contact. No proposal and approval steps: the EOC team keeps its own roster.
// Work contacts only (name, position, number). The server records who confirmed each entry and keeps withdrawn ones on record.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Phone, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { depthSummary, manilaToday, positionDepth, type PositionDepth } from '@/domain/structure';
import { Badge, Button, EmptyState, Field, Input, PageHeader, Select, Tabs } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { EocDesignation, EocSection } from '@/types';
import { Block, Ring } from './kit';
import { EOC_TABS, RANK, SECTION } from './labels';

const SECTIONS: EocSection[] = ['command', 'command_staff', 'operations', 'planning', 'logistics', 'finance_admin', 'cluster_desk', 'barangay_desk'];
type Slot = { row: PositionDepth; rank: 1 | 2 | 3; d: EocDesignation | undefined };

export function RosterPage() {
  const { has, userId } = useAuth();
  const toast = useToast();
  const canEdit = has('cdrrmo_head') || has('eoc_manager') || has('eoc_staff');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', office: '' });
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => {
    const offices = (await db.offices.toArray()).sort((a, b) => a.name.localeCompare(b.name));
    const people = new Map((await db.profiles.toArray()).map((p) => [p.id, p.full_name]));
    return { rows: positionDepth(await db.eoc_positions.toArray(), await db.eoc_designations.toArray(), manilaToday()), offices, people };
  }, []);
  if (!data) return null;
  const sum = depthSummary(data.rows);
  const officeName = new Map(data.offices.map((o) => [o.id, o.name]));
  const nameOf = (d: EocDesignation) => d.designee_position || (d.person_id && data.people.get(d.person_id)) || (d.office_id && officeName.get(d.office_id)) || 'Linked account';

  const open = (s: Slot) => {
    setForm({ name: s.d?.designee_position ?? (s.d?.person_id ? data.people.get(s.d.person_id) ?? '' : ''), contact: s.d?.note ?? '', office: s.d?.office_id ?? '' });
    setSlot(s);
  };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); toast(done); setSlot(null); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const commit = () => slot && run(async () => {
    const name = form.name.trim().slice(0, 160); const patch = { designee_position: name || null, note: form.contact.trim() || null, office_id: form.office || null, status: 'approved' as const };
    if (slot.d) await save('eoc_designations', { ...slot.d, ...patch }, `Update ${slot.row.position.title}`);
    else {
      const row: EocDesignation & { _new: true } = { _new: true, id: uuid(), position_id: slot.row.position.id, rank: slot.rank, person_id: null, valid_from: manilaToday(), valid_until: null,
        proposed_by: userId, approved_by: userId, approved_at: new Date().toISOString(), version: 1, ...patch };
      await save('eoc_designations', row, `Add ${RANK[slot.rank].toLowerCase()} for ${slot.row.position.title}`);
    }
  }, `Saved: ${slot.row.position.title}, ${RANK[slot.rank].toLowerCase()}`);
  const clear = () => slot?.d && run(() => save('eoc_designations', { ...slot.d!, status: 'withdrawn' as const }, `Clear ${slot.row.position.title}`), 'Cleared');

  return (
    <div className="page">
      <PageHeader title="EOC Roster" subtitle="Each EOC position has a primary and two alternates for 72-hour operations. Tap a slot to type the name and contact." />
      <Tabs items={EOC_TABS} />
      {data.rows.length === 0 ? <EmptyState title="No EOC positions yet" body="They arrive with the EOC structure data (operational file 06)." /> : <>
        <div className="mb-5 flex flex-wrap items-center gap-5 rounded-sheet border border-line bg-surface p-4 shadow-raised">
          <Ring value={sum.twoDeep} max={sum.positions || 1} tone={sum.share !== null && sum.share >= 0.8 ? 'ok' : 'warn'}>{sum.share !== null ? `${Math.round(sum.share * 100)}%` : '–'}</Ring>
          <div><p className="text-lg font-extrabold">{sum.twoDeep} of {sum.positions} positions covered two deep</p>
            <p className="text-sm text-muted">{sum.threeDeep} three deep · {sum.noPrimary} without a primary</p></div>
        </div>
        <div className="space-y-5">
          {SECTIONS.map((sec) => {
            const rows = data.rows.filter((r) => r.position.section === sec);
            if (!rows.length) return null;
            return (
              <Block key={sec} title={SECTION[sec]}>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((r) => (
                    <li key={r.position.id} className="rounded-control border border-line bg-surface p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="font-bold leading-tight">{r.position.title}</p><p className="font-data text-[11px] text-muted">{r.position.code}</p></div>
                        <Badge tone={r.threeDeep ? 'ok' : r.twoDeep ? 'info' : 'warn'}>{r.approved}/{r.position.required_depth}</Badge>
                      </div>
                      <ol className="space-y-1.5">
                        {([1, 2, 3] as const).filter((k) => k <= r.position.required_depth).map((k) => {
                          const d = r.byRank[k];
                          const s: Slot = { row: r, rank: k, d };
                          const inner = d ? (
                            <><span className="block truncate text-sm font-bold">{nameOf(d)}</span>
                              <span className="flex items-center gap-1 truncate text-xs text-muted">{d.note && <Phone size={11} />}{[d.note, d.office_id && officeName.get(d.office_id)].filter(Boolean).join(' · ') || 'No contact yet'}</span></>
                          ) : <span className="flex items-center gap-1 text-sm font-semibold text-muted"><Plus size={14} />{canEdit ? 'Add name' : 'Not designated'}</span>;
                          return (
                            <li key={k} className="flex items-center gap-2">
                              <span className="w-16 shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">{k === 1 ? 'Primary' : `Alt ${k - 1}`}</span>
                              <button type="button" disabled={!canEdit} onClick={() => open(s)}
                                className={clsx('min-w-0 flex-1 rounded-control border px-2 py-1.5 text-left', d ? 'border-line bg-surface hover:border-sky' : 'border-dashed border-line bg-sunken hover:border-sky')}>{inner}</button>
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  ))}
                </ul>
              </Block>
            );
          })}
        </div>
      </>}
      <Sheet open={!!slot} onClose={() => setSlot(null)} title={slot ? `${slot.row.position.title}, ${RANK[slot.rank].toLowerCase()}` : ''}
        footer={<>
          {slot?.d && <Button tip="Remove this name from the slot; it stays on record" variant="quiet" disabled={busy} onClick={clear}>Clear slot</Button>}
          <Button tip="Close without saving" variant="secondary" onClick={() => setSlot(null)}>Cancel</Button>
          <Button tip="Save this name" busy={busy} disabled={!form.name.trim()} onClick={commit}>Save</Button>
        </>}>
        <div className="space-y-4">
          <Field label="Name and position" hint="For example: Juan Dela Cruz, Operations Officer">{(id) => <Input id={id} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Mobile or radio" optional hint="Work number or call sign.">{(id) => <Input id={id} inputMode="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />}</Field>
          <Field label="Office" optional>{(id) => (
            <Select id={id} value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })}>
              <option value="">None</option>{data.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>)}</Field>
        </div>
      </Sheet>
    </div>
  );
}
