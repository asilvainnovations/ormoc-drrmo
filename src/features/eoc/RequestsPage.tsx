import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canDecideRequest, canOperate, currentLevel, REQUEST_NEXT, REQUEST_VERB } from '@/domain/eoc';
import { fmtDateTime, relative } from '@/lib/time';
import { Badge, Button, ChoiceGroup, EmptyState, Field, Input, List, PageHeader, Section, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { RequestStatus, ResourceRequest } from '@/types';
import { EOC_TABS, PRIORITY, REQUEST_STATUS } from './labels';

const STAMP: Partial<Record<RequestStatus, keyof ResourceRequest>> = { approved: 'approved_at', mobilized: 'mobilized_at', delivered: 'delivered_at', demobilized: 'demobilized_at' };

export function RequestsPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deciding, setDeciding] = useState<{ r: ResourceRequest; to: RequestStatus } | null>(null);
  const [note, setNote] = useState('');
  const [form, setForm] = useState({ requesting_party: '', item: '', quantity: '1', unit: 'unit', priority: 'urgent' as ResourceRequest['priority'] });
  const rows = useLiveQuery(() => db.resource_requests.orderBy('requested_at').reverse().toArray(), [], []);
  const active = rows.filter((r) => !['demobilized', 'rejected'].includes(r.status));
  const closed = rows.filter((r) => ['demobilized', 'rejected'].includes(r.status));

  const create = async () => {
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const r: ResourceRequest & { _new: true } = { _new: true, id: uuid(), activation_id: activation?.id ?? null, requesting_party: form.requesting_party.trim(),
      item: form.item.trim(), quantity: Number(form.quantity), unit: form.unit.trim() || 'unit', priority: form.priority, needed_by: null, status: 'requested',
      decision_note: null, requested_at: new Date().toISOString(), approved_at: null, mobilized_at: null, delivered_at: null, demobilized_at: null, version: 1 };
    await save('resource_requests', r, `Request ${r.item}`);
    setOpen(false); setForm({ ...form, item: '', quantity: '1' }); toast('Request recorded');
  };

  const move = async (r: ResourceRequest, to: RequestStatus, decision?: string) => {
    if (to === 'rejected' && !decision?.trim()) { toast('Give the reason for rejecting.', 'bad'); return; }
    const stamp = STAMP[to];
    await save('resource_requests', { ...r, status: to, decision_note: decision?.trim() || r.decision_note, ...(stamp ? { [stamp]: new Date().toISOString() } : {}) }, `${REQUEST_VERB[to]} ${r.item}`);
    setDeciding(null); setNote(''); toast(`${REQUEST_STATUS[to]}: ${r.item}`);
  };

  const row = (r: ResourceRequest) => {
    const next = REQUEST_NEXT[r.status].filter((s) => (s === 'approved' || s === 'rejected') ? canDecideRequest(roles) : canOperate(roles));
    return (
      <li key={r.id} className="py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{r.quantity} {r.unit} {r.item}</p>
            <p className="text-sm text-muted">{r.requesting_party}, requested {relative(r.requested_at)}{r.decision_note ? `. ${r.decision_note}` : ''}</p>
          </div>
          <span className="flex gap-1.5"><Badge tone={r.priority === 'life_safety' ? 'bad' : r.priority === 'urgent' ? 'warn' : 'neutral'}>{PRIORITY[r.priority]}</Badge><Badge>{REQUEST_STATUS[r.status]}</Badge></span>
        </div>
        {next.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {next.map((s) => <Button tip={s === 'rejected' ? 'Reject this request. You will be asked for the reason' : `Move this request to: ${REQUEST_VERB[s]}`} key={s} variant={s === 'rejected' ? 'quiet' : 'secondary'} onClick={() => (s === 'rejected' ? setDeciding({ r, to: s }) : move(r, s))}>{REQUEST_VERB[s]}</Button>)}
          </div>
        )}
        <p className="mt-1 text-xs text-muted">{[r.approved_at && `Approved ${fmtDateTime(r.approved_at)}`, r.mobilized_at && `mobilized ${fmtDateTime(r.mobilized_at)}`, r.delivered_at && `delivered ${fmtDateTime(r.delivered_at)}`].filter(Boolean).join(', ')}</p>
      </li>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Resource requests" subtitle="Requested, approved, mobilized, delivered, demobilized. Only the EOC Manager approves or rejects."
        actions={canOperate(roles) && <Button tip="Record a new request for resources (vehicles, equipment, relief, teams)" icon={Plus} onClick={() => setOpen(true)}>New request</Button>} />
      <Tabs items={EOC_TABS} />
      <Section title={`Open (${active.length})`}>{active.length ? <List>{active.map(row)}</List> : <EmptyState title="No open requests" />}</Section>
      {closed.length > 0 && <Section title="Closed"><List>{closed.slice(0, 30).map(row)}</List></Section>}
      <Sheet open={open} onClose={() => setOpen(false)} title="New resource request"
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button tip="Save the request. The EOC Manager approves it" disabled={!form.item.trim() || !form.requesting_party.trim() || !(Number(form.quantity) > 0)} onClick={create}>Record request</Button></>}>
        <Field label="Requested by" hint="Office, barangay or incident commander.">{(id, d) => <Input id={id} aria-describedby={d} value={form.requesting_party} onChange={(e) => setForm({ ...form, requesting_party: e.target.value })} />}</Field>
        <Field label="Item">{(id) => <Input id={id} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">{(id) => <Input id={id} type="number" min={1} inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />}</Field>
          <Field label="Unit">{(id) => <Input id={id} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />}</Field>
        </div>
        <ChoiceGroup legend="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} columns={3}
          options={[{ value: 'life_safety', label: 'Life safety' }, { value: 'urgent', label: 'Urgent' }, { value: 'routine', label: 'Routine' }]} />
      </Sheet>
      <Sheet open={!!deciding} onClose={() => setDeciding(null)} title="Reject request"
        footer={<><Button tip="Close without rejecting" variant="secondary" onClick={() => setDeciding(null)}>Cancel</Button><Button tip="Reject the request with the reason given" variant="danger" disabled={!note.trim()} onClick={() => deciding && move(deciding.r, deciding.to, note)}>Reject request</Button></>}>
        <Field label="Reason">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </Sheet>
    </div>
  );
}
