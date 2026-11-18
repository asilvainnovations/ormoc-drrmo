// Resource requests as a board (1.25.0): four columns from Requested to Delivered, each card one tap from its next step. A new
// request is item chips, a quantity stepper and who needs it, so nobody has to compose a sentence in an emergency.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canDecideRequest, canOperate, currentLevel, REQUEST_NEXT, REQUEST_VERB } from '@/domain/eoc';
import { NEEDED_BY, neededByIso, REQUEST_GROUPS, REQUESTER_CHIPS, type NeededBy } from '@/domain/requestTemplates';
import { fmtTime, relative } from '@/lib/time';
import { Badge, Button, EmptyState, Field, Input, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { RequestStatus, ResourceRequest } from '@/types';
import { Chips, Stepper } from './kit';
import { EOC_TABS, PRIORITY, REQUEST_STATUS } from './labels';

const STAMP: Partial<Record<RequestStatus, keyof ResourceRequest>> = { approved: 'approved_at', mobilized: 'mobilized_at', delivered: 'delivered_at', demobilized: 'demobilized_at' };
const COLUMNS: { status: RequestStatus; title: string }[] = [
  { status: 'requested', title: 'Requested' }, { status: 'approved', title: 'Approved' }, { status: 'mobilized', title: 'On the way' }, { status: 'delivered', title: 'Delivered' },
];
const EDGE = { life_safety: 'border-l-bad', urgent: 'border-l-warn', routine: 'border-l-line' } as const;
const blank = { item: '', unit: 'units', qty: 1, party: '', priority: 'urgent' as ResourceRequest['priority'], needed: 'today' as NeededBy };

export function RequestsPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deciding, setDeciding] = useState<ResourceRequest | null>(null);
  const [note, setNote] = useState('');
  const [f, setF] = useState(blank);
  const data = useLiveQuery(async () => ({
    rows: await db.resource_requests.orderBy('requested_at').reverse().toArray(),
    barangays: (await db.barangays.orderBy('name').toArray()).map((b) => b.name),
  }), []);
  const rows = data?.rows ?? [];
  const closed = rows.filter((r) => r.status === 'demobilized' || r.status === 'rejected');
  const byCol = useMemo(() => COLUMNS.map((c) => ({ ...c, rows: rows.filter((r) => r.status === c.status).sort((a, b) => Number(b.priority === 'life_safety') - Number(a.priority === 'life_safety')) })), [rows]);
  const operator = canOperate(roles);

  const create = async () => {
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const r: ResourceRequest & { _new: true } = { _new: true, id: uuid(), activation_id: activation?.id ?? null, requesting_party: f.party.trim(), item: f.item.trim(), quantity: f.qty,
      unit: f.unit.trim() || 'unit', priority: f.priority, needed_by: neededByIso(f.needed), status: 'requested', decision_note: null, requested_at: new Date().toISOString(),
      approved_at: null, mobilized_at: null, delivered_at: null, demobilized_at: null, version: 1 };
    await save('resource_requests', r, `Request ${r.item}`);
    setOpen(false); setF({ ...blank, party: f.party }); toast('Request recorded');
  };
  const move = async (r: ResourceRequest, to: RequestStatus, decision?: string) => {
    if (to === 'rejected' && !decision?.trim()) { toast('Give the reason for rejecting.', 'bad'); return; }
    const stamp = STAMP[to];
    await save('resource_requests', { ...r, status: to, decision_note: decision?.trim() || r.decision_note, ...(stamp ? { [stamp]: new Date().toISOString() } : {}) }, `${REQUEST_VERB[to]} ${r.item}`);
    setDeciding(null); setNote(''); toast(`${REQUEST_STATUS[to]}: ${r.item}`);
  };

  const card = (r: ResourceRequest) => {
    const next = REQUEST_NEXT[r.status].filter((s) => (s === 'approved' || s === 'rejected') ? canDecideRequest(roles) : operator);
    return (
      <li key={r.id} className={clsx('rounded-control border border-l-4 border-line bg-surface p-3 shadow-raised', EDGE[r.priority])}>
        <p className="font-display text-lg font-extrabold leading-tight">{r.quantity} {r.unit}</p>
        <p className="font-bold">{r.item}</p>
        <p className="mt-1 text-xs text-muted">{r.requesting_party} · {relative(r.requested_at)}{r.needed_by ? ` · need by ${fmtTime(r.needed_by)}` : ''}</p>
        {r.decision_note && <p className="mt-1 text-xs">{r.decision_note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {r.priority !== 'routine' && <Badge tone={r.priority === 'life_safety' ? 'bad' : 'warn'}>{PRIORITY[r.priority]}</Badge>}
          {next.map((s) => <Button key={s} tip={s === 'rejected' ? 'Reject; you will be asked for the reason' : `Move to: ${REQUEST_VERB[s]}`} variant={s === 'rejected' ? 'quiet' : 'secondary'} onClick={() => (s === 'rejected' ? setDeciding(r) : move(r, s))}>{REQUEST_VERB[s]}</Button>)}
        </div>
      </li>
    );
  };

  const ready = f.item.trim() && f.party.trim() && f.qty > 0;
  return (
    <div className="page">
      <PageHeader title="Resource Requests" subtitle="Requested, approved, on the way, delivered. Only the EOC Manager approves or rejects."
        actions={operator && <Button tip="Record a new resource request" icon={Plus} onClick={() => setOpen(true)}>New request</Button>} />
      <Tabs items={EOC_TABS} />
      {rows.length === 0 ? <EmptyState title="No requests yet" body="Tap New request: pick the item, set the quantity, say who needs it." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {byCol.map((c) => (
            <section key={c.status} aria-label={c.title} className="rounded-sheet bg-sunken p-3">
              <h2 className="mb-3 flex items-center justify-between text-sm font-extrabold uppercase tracking-wider text-muted">{c.title}<span className="font-data text-ink">{c.rows.length}</span></h2>
              <ul className="space-y-3">{c.rows.map(card)}{c.rows.length === 0 && <li className="py-6 text-center text-sm text-muted">Empty</li>}</ul>
            </section>
          ))}
        </div>
      )}
      {closed.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-bold text-muted">Closed ({closed.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{closed.slice(0, 40).map(card)}</ul>
        </details>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New resource request"
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button tip="Save the request. The EOC Manager approves it" disabled={!ready} onClick={create}>Record request</Button></>}>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-bold">What is needed</p>
            {REQUEST_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{g.title}</p>
                <Chips label={g.title} value={f.item} onChange={(v) => { const it = g.items.find((i) => i.label === v)!; setF({ ...f, item: it.label, unit: it.unit }); }} options={g.items.map((i) => ({ value: i.label, label: i.label }))} />
              </div>
            ))}
            <Field label="Something else" optional>{(id) => <Input id={id} value={REQUEST_GROUPS.some((g) => g.items.some((i) => i.label === f.item)) ? '' : f.item} placeholder="Type the item" onChange={(e) => setF({ ...f, item: e.target.value })} />}</Field>
          </div>
          <div><p className="mb-2 text-sm font-bold">How many ({f.unit})</p>
            <Stepper label="quantity" value={f.qty} min={1} onChange={(n) => setF({ ...f, qty: n })} jumps={[1, 5, 10, 50, 100]} />
            <Field label="Unit">{(id) => <Input id={id} className="mt-2 w-40" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />}</Field>
          </div>
          <div><p className="mb-2 text-sm font-bold">Who needs it</p>
            <Chips label="Requester" value={REQUESTER_CHIPS.includes(f.party) ? f.party : null} onChange={(v) => setF({ ...f, party: v })} options={REQUESTER_CHIPS.map((c) => ({ value: c, label: c }))} />
            <Field label="Or a barangay">{(id) => (
              <Select id={id} className="mt-2" value={data?.barangays.includes(f.party) ? f.party : ''} onChange={(e) => setF({ ...f, party: e.target.value })}>
                <option value="">Choose a barangay…</option>{data?.barangays.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>)}</Field>
          </div>
          <div><p className="mb-2 text-sm font-bold">How urgent</p>
            <Chips label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={[{ value: 'life_safety', label: 'Life safety' }, { value: 'urgent', label: 'Urgent' }, { value: 'routine', label: 'Routine' }]} /></div>
          <div><p className="mb-2 text-sm font-bold">Needed</p>
            <Chips label="Needed by" value={f.needed} onChange={(v) => setF({ ...f, needed: v })} options={NEEDED_BY} /></div>
          <p className="rounded-control bg-sunken px-3 py-2 text-sm"><span className="font-bold">Will be recorded as: </span>{ready ? `${f.qty} ${f.unit} ${f.item}, for ${f.party}, ${(PRIORITY[f.priority] ?? f.priority).toLowerCase()}, needed by ${fmtTime(neededByIso(f.needed))}.` : 'Pick an item and who needs it.'}</p>
        </div>
      </Sheet>
      <Sheet open={!!deciding} onClose={() => setDeciding(null)} title="Reject request"
        footer={<><Button tip="Close without rejecting" variant="secondary" onClick={() => setDeciding(null)}>Cancel</Button><Button tip="Reject the request with the reason given" variant="danger" disabled={!note.trim()} onClick={() => deciding && move(deciding, 'rejected', note)}>Reject request</Button></>}>
        <Field label="Reason">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </Sheet>
    </div>
  );
}
