// The City's register of connected apps (1.9, ADR-018, migration 20261106001600). An administrator registers an
// app's OAuth client; an administrator or the CDRRMO Head approves, suspends or retires it. Until it is approved,
// tokens issued to that client read nothing (app.oauth_client_allowed). Apps stay read-only in every case.
// Online only: this is a small, authority-held register and is not kept on devices.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '@/components/Toast';
import { Badge, Button, Field, Input, List, Loading, Notice, Section, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import type { ConnectedApp } from '@/types';

const STATUS: Record<ConnectedApp['status'], string> = { requested: 'Waiting for approval', approved: 'Approved', suspended: 'Suspended', retired: 'Retired' };
const TONE = { requested: 'warn', approved: 'ok', suspended: 'bad', retired: 'neutral' } as const;
const blank = { client_id: '', name: '', purpose: '', owner_office_id: '', contact_position: '', redirect_uri: '', data_scope: '' };

/** Plain-language check before sending; the database checks the same limits. */
export function appProblem(f: typeof blank): string | null {
  if (f.client_id.trim().length < 8) return 'Copy the client ID from Supabase (Authentication, then OAuth Apps).';
  if (f.name.trim().length < 2) return 'Give the app a name.';
  if (f.purpose.trim().length < 10) return 'Say what the app is for, in a sentence.';
  if (!/^(https:\/\/|http:\/\/localhost)/.test(f.redirect_uri.trim())) return 'The redirect address must start with https:// (or http://localhost for testing).';
  if (f.data_scope.trim().length < 5) return 'Say what the app will read, in plain words.';
  return null;
}

export function CityAppRegister() {
  const { has } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const isAdmin = has('admin');
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const offices = useLiveQuery(async () => (await db.offices.toArray()).sort((a, b) => a.name.localeCompare(b.name)), [], []);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from('connected_apps').select('*').order('created_at', { ascending: false });
    if (e) { setError(e.message); setApps([]); return; }
    setApps((data ?? []) as ConnectedApp[]);
  }, []);
  useEffect(() => { if (online) void load(); }, [online, load]);

  const register = async () => {
    const p = appProblem(f); setProblem(p); if (p) return;
    setBusy('new');
    const { error: e } = await supabase.from('connected_apps').insert({
      client_id: f.client_id.trim(), name: f.name.trim(), purpose: f.purpose.trim(), owner_office_id: f.owner_office_id || null,
      contact_position: f.contact_position.trim() || null, redirect_uri: f.redirect_uri.trim(), data_scope: f.data_scope.trim(), status: 'requested',
    });
    setBusy(null);
    if (e) { setProblem(/duplicate|unique/i.test(e.message) ? 'This client ID is already registered.' : e.message); return; }
    setOpen(false); setF(blank); toast(`Registered ${f.name.trim()}. It waits for approval.`); await load();
  };
  const setStatus = async (a: ConnectedApp, status: ConnectedApp['status'], verb: string) => {
    setBusy(a.id);
    const { error: e } = await supabase.from('connected_apps').update({ status, version: a.version }).eq('id', a.id);
    setBusy(null);
    if (e) { toast(e.code === 'PT409' ? 'Someone changed this app a moment ago. Look again and try once more.' : e.message, 'bad'); await load(); return; }
    toast(`${verb}: ${a.name}`); await load();
  };
  const officeName = new Map(offices.map((o) => [o.id, o.name]));

  return (
    <Section title="City register of connected apps" action={isAdmin && online && <Button tip="Register a City system's OAuth client so it can be reviewed and approved (administrator)" variant="secondary" onClick={() => { setF(blank); setProblem(null); setOpen(true); }}>Register an app</Button>}>
      <p className="mb-3 text-sm text-muted">An app can read City records only after it is approved here, and only what the signed-in person's role can read. It can never change anything. Approval is reviewed every year.</p>
      {!online ? <Notice tone="warn">This needs a connection.</Notice>
        : apps === null ? <Loading />
        : error ? <Notice tone="warn">{error}</Notice>
        : apps.length === 0 ? <Notice tone="info">No app is registered.</Notice>
        : (
          <List>
            {apps.map((a) => (
              <li key={a.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.name}</p>
                    <p className="break-all font-data text-xs text-muted">{a.client_id}</p>
                  </div>
                  <Badge tone={TONE[a.status]}>{STATUS[a.status]}</Badge>
                </div>
                <p className="text-sm">{a.purpose}</p>
                <p className="text-sm text-muted">Reads: {a.data_scope}</p>
                <p className="text-xs text-muted">{[a.owner_office_id && officeName.get(a.owner_office_id), a.contact_position, `Returns to ${a.redirect_uri}`,
                  a.reviewed_at && `Reviewed ${fmtDateTime(a.reviewed_at)}`, a.review_due && `Review due ${fmtDate(a.review_due)}`].filter(Boolean).join('. ')}</p>
                <div className="flex flex-wrap gap-2">
                  {(a.status === 'requested' || a.status === 'suspended') && <Button tip="Approve: the app may read what the signed-in person's role can read (administrator or CDRRMO Head)" busy={busy === a.id} onClick={() => void setStatus(a, 'approved', 'Approved')}>Approve</Button>}
                  {a.status === 'approved' && <Button tip="Suspend: the app reads nothing until approved again" variant="secondary" busy={busy === a.id} onClick={() => void setStatus(a, 'suspended', 'Suspended')}>Suspend</Button>}
                  {a.status !== 'retired' && <Button tip="Retire for good. To use it again, register it as a new request" variant="quiet" busy={busy === a.id} onClick={() => void setStatus(a, 'retired', 'Retired')}>Retire</Button>}
                </div>
              </li>
            ))}
          </List>
        )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Register an app"
        footer={<><Button tip="Go back without registering" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button tip="Register the app. It waits for approval" busy={busy === 'new'} onClick={register}>Register</Button></>}>
        <Notice tone="info">First create the app in Supabase (Authentication, then OAuth Apps). Copy its client ID and redirect address here.</Notice>
        <Field label="Client ID">{(id, d) => <Input id={id} aria-describedby={d} className="font-data" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} />}</Field>
        <Field label="Name">{(id, d) => <Input id={id} aria-describedby={d} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="What it is for">{(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />}</Field>
        <Field label="What it will read" hint="In plain words, for example: EOC level and SitReps, for the City dashboard.">{(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={f.data_scope} onChange={(e) => setF({ ...f, data_scope: e.target.value })} />}</Field>
        <Field label="Redirect address">{(id, d) => <Input id={id} aria-describedby={d} className="font-data" inputMode="url" value={f.redirect_uri} onChange={(e) => setF({ ...f, redirect_uri: e.target.value })} />}</Field>
        <Field label="Office that owns it" optional>{(id, d) => <Select id={id} aria-describedby={d} value={f.owner_office_id} onChange={(e) => setF({ ...f, owner_office_id: e.target.value })}>
          <option value="">Not set</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
        <Field label="Contact position" optional hint="A position title, not a name." error={problem}>{(id, d) => <Input id={id} aria-describedby={d} value={f.contact_position} onChange={(e) => setF({ ...f, contact_position: e.target.value })} />}</Field>
      </Sheet>
    </Section>
  );
}
