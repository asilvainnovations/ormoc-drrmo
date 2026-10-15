import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LogOut, RefreshCw, Upload } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { syncNow, useSyncState } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import { ALL_ROLES, ROLE_LABEL, useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { fmtDateTime, relative } from '@/lib/time';
import { useOnline } from '@/lib/hooks';
import { Badge, Button, Checkbox, EmptyState, Field, List, ListRow, Notice, PageHeader, Section, Textarea, TextLink } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { Barangay, Role } from '@/types';

export function SettingsPage() {
  const { profile, email, roles, signOut, setDemoRoles, has } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="page">
      <PageHeader title="Settings" />
      <Section title="Your account">
        <p className="font-semibold">{profile?.full_name || 'Name not set'}</p>
        <p className="text-muted">{email}{profile?.position ? `, ${profile.position}` : ''}</p>
        <p className="mt-2 flex flex-wrap gap-1.5">{roles.length ? roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>) : <Badge tone="warn">No role yet: ask the administrator</Badge>}</p>
      </Section>
      {env.demo && (
        <Section title="Demo roles">
          <p className="mb-3 text-sm text-muted">Choose which roles the demo user holds. The real system enforces the same rules on the server.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_ROLES.map((r) => (
              <Checkbox key={r} className="flex" checked={roles.includes(r)} onChange={() => void setDemoRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])}>
                {ROLE_LABEL[r]}
              </Checkbox>
            ))}
          </div>
        </Section>
      )}
      <Section title="This device">
        <List>
          <ListRow to="/settings/sync" title="Sync and offline data" meta="What is waiting to send, and anything the server refused" />
          {has('admin') && <ListRow to="/settings/users" title="Users and roles" meta="Grant or remove roles" />}
          {has('admin') && <ListRow to="/settings/barangays" title="Barangay list" meta="Import the barangays with their PSGC codes" />}
          <ListRow to="/settings/about" title="About and data privacy" />
        </List>
      </Section>
      {!env.demo && (
        <Button variant="secondary" icon={LogOut} busy={busy} onClick={async () => {
          setBusy(true);
          try { await signOut(); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
        }}>Sign out and clear this device</Button>
      )}
    </div>
  );
}

export function SyncPage() {
  const sync = useSyncState();
  const online = useOnline();
  const toast = useToast();
  const data = useLiveQuery(async () => ({
    outbox: await db.outbox.orderBy('seq').toArray(), failed: await db.failed.reverse().toArray(), conflicts: await db.conflicts.reverse().toArray(),
  }), []);
  const retryConflict = async (id: number) => {
    const c = await db.conflicts.get(id);
    if (!c || !c.server) return;
    await save(c.table, { ...c.server, ...c.local, version: c.server.version }, `Reapply: ${c.label}`);
    await db.conflicts.delete(id);
    toast('Your change was applied on top of the latest version');
  };
  return (
    <div className="page">
      <PageHeader title="Sync and offline data" back="/settings"
        subtitle={env.demo ? 'Demo mode: nothing is sent to a server.' : `${online ? 'Online' : 'Offline'}. ${sync.lastSyncAt ? `Last synced ${relative(sync.lastSyncAt)}.` : 'Not synced yet.'}`}
        actions={!env.demo && <Button icon={RefreshCw} busy={sync.status === 'syncing'} disabled={!online} onClick={() => syncNow({ forceReference: true })}>Sync now</Button>} />
      {sync.status === 'error' && <Notice tone="bad" title="Sync stopped">{sync.message}</Notice>}
      {sync.status === 'signed_out' && <Notice tone="warn" title="Signed out">Sign in again to send your changes.</Notice>}
      <Section title={`Waiting to send (${data?.outbox.length ?? 0})`}>
        {data?.outbox.length ? <List>{data.outbox.map((o) => <ListRow key={o.seq} title={o.label} meta={`${fmtDateTime(o.createdAt)}${o.attempts ? `, ${o.attempts} attempt(s)` : ''}`} />)}</List>
          : <p className="text-muted">Nothing waiting. Changes save on this device first and send automatically when there is a connection.</p>}
      </Section>
      <Section title={`Refused by the server (${data?.failed.length ?? 0})`}>
        {data?.failed.length ? (
          <List>{data.failed.map((f) => <li key={f.id} className="py-3">
            <p className="font-semibold">{f.label}</p><p className="text-sm text-bad">{f.error}</p>
            <p className="text-xs text-muted">{fmtDateTime(f.at)}. The record shows the server copy again.</p>
            <Button className="mt-1" variant="quiet" onClick={() => db.failed.delete(f.id!)}>Dismiss</Button></li>)}</List>
        ) : <p className="text-muted">None.</p>}
      </Section>
      <Section title={`Edited by someone else first (${data?.conflicts.length ?? 0})`}>
        {data?.conflicts.length ? (
          <List>{data.conflicts.map((c) => <li key={c.id} className="py-3">
            <p className="font-semibold">{c.label}</p>
            <p className="text-sm text-muted">Another person saved this record before your change arrived. The record now shows their version.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => retryConflict(c.id!)}>Apply my change on top</Button>
              <Button variant="quiet" onClick={() => db.conflicts.delete(c.id!)}>Keep theirs</Button>
            </div></li>)}</List>
        ) : <p className="text-muted">None.</p>}
      </Section>
    </div>
  );
}

export function UsersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<{ id: string; full_name: string; position: string | null; is_active: boolean; roles: Role[] }[] | null>(null);
  const load = async () => {
    if (!supabase) return;
    const [{ data: ps, error }, { data: rs }] = await Promise.all([supabase.from('profiles').select('id, full_name, position, is_active').order('full_name'), supabase.from('user_roles').select('user_id, role')]);
    if (error) { toast(error.message, 'bad'); return; }
    setRows((ps ?? []).map((p) => ({ ...p, roles: (rs ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role) })));
  };
  const toggle = async (uid: string, role: Role, has: boolean) => {
    const q = has ? supabase!.from('user_roles').delete().eq('user_id', uid).eq('role', role) : supabase!.from('user_roles').insert({ user_id: uid, role });
    const { error } = await q;
    if (error) toast(error.message, 'bad'); else { toast(has ? 'Role removed' : 'Role granted'); void load(); }
  };
  // Deactivating keeps the person's records and audit trail; RLS then denies them everything.
  const setActive = async (uid: string, active: boolean) => {
    const { error } = await supabase!.from('profiles').update({ is_active: active }).eq('id', uid);
    if (error) toast(error.message, 'bad'); else { toast(active ? 'Account reactivated' : 'Account deactivated'); void load(); }
  };
  if (env.demo) return <div className="page"><PageHeader title="Users and roles" back="/settings" /><Notice>In demo mode, change roles on the Settings page.</Notice></div>;
  return (
    <div className="page">
      <PageHeader title="Users and roles" back="/settings" subtitle="Invite staff from the Supabase dashboard (Authentication). They appear here as soon as they are invited. Changes need a connection."
        actions={<Button onClick={load}>Load users</Button>} />
      {!rows ? <EmptyState title="Load the user list" /> : rows.map((u) => (
        <Section key={u.id} title={u.full_name || u.id}
          action={u.is_active ? <Button variant="quiet" size="md" onClick={() => setActive(u.id, false)}>Deactivate</Button>
            : <Button variant="secondary" onClick={() => setActive(u.id, true)}>Reactivate</Button>}>
          {!u.is_active && <Notice tone="warn">Deactivated. This person can no longer see or change anything. Their past entries stay.</Notice>}
          <div className="flex flex-wrap gap-2">{ALL_ROLES.map((r) => (
            <Checkbox key={r} checked={u.roles.includes(r)} onChange={() => toggle(u.id, r, u.roles.includes(r))}>{ROLE_LABEL[r]}</Checkbox>))}</div>
        </Section>
      ))}
    </div>
  );
}

/** CSV: psgc,name,classification,population,lat,lng — classification separated by ";" (urban;coastal;riverine;upland). */
export function parseBarangayCsv(text: string): { rows: Barangay[]; errors: string[] } {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const errors: string[] = []; const rows: Barangay[] = [];
  const start = /psgc/i.test(lines[0] ?? '') ? 1 : 0;
  lines.slice(start).forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const [psgc, name, cls, pop, lat, lng] = cells;
    if (!psgc || !/^\d{9,10}$/.test(psgc)) { errors.push(`Line ${i + start + 1}: PSGC code must be 9 or 10 digits`); return; }
    if (!name) { errors.push(`Line ${i + start + 1}: name is missing`); return; }
    rows.push({ psgc, name, classification: cls ? cls.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean) : [],
      population: pop ? Number(pop) : null, lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null });
  });
  return { rows, errors };
}

export function BarangaysAdminPage() {
  const toast = useToast();
  const count = useLiveQuery(() => db.barangays.count(), [], 0);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const { rows, errors: errs } = parseBarangayCsv(text);
    setErrors(errs);
    if (errs.length || rows.length === 0) return;
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from('barangays').upsert(rows, { onConflict: 'psgc' });
        if (error) throw new Error(error.message);
      }
      await db.barangays.bulkPut(rows.map((r) => ({ ...r, version: 1 })));
      toast(`${rows.length} barangays imported`); setText('');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  return (
    <div className="page">
      <PageHeader title="Barangay list" back="/settings" subtitle={`${count} barangays loaded. Use the official PSA PSGC codes for the City of Ormoc.`} />
      <div className="max-w-3xl space-y-4">
        <Field label="Paste CSV" hint={<>Columns: <code>psgc,name,classification,population,lat,lng</code>. Classification uses <code>;</code> between values, for example <code>coastal;urban</code>. Only PSGC and name are required.</>}>
          {(id, d) => <Textarea id={id} aria-describedby={d} rows={10} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <label className="inline-flex min-h-tap cursor-pointer items-center gap-2 font-semibold underline">
          <Upload className="h-4 w-4" aria-hidden />Or choose a CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        </label>
        {errors.length > 0 && <Notice tone="bad" title="Fix these lines first"><ul className="list-disc pl-5">{errors.slice(0, 10).map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
        <Button busy={busy} disabled={!text.trim()} onClick={run}>Import barangays</Button>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="page">
      <PageHeader title="About and data privacy" back="/settings" />
      <div className="max-w-prose space-y-4">
        <p>Ormoc DRRM Operations, version {env.appVersion}. Built for the City Disaster Risk Reduction and Management Office and the Emergency Operations Center of the City of Ormoc as part of the Manual of Operations consultancy.</p>
        <p>It carries the Institutional Assessment Tool v1.1, the CDRRMO Manual of Operations and EOC Manual, CDRRMO protocols, EOC operations and the anticipatory action workflow under RA 12287 and its IRR.</p>
        <h2 className="text-lg font-bold">Data privacy</h2>
        <p>The City Government of Ormoc controls the data (RA 10173). The platform stores staff names, positions and offices, operational records and aggregate counts. It does not store the names of affected persons, evacuees, beneficiaries or informants. Evidence files are kept in a private store and opened only through short-lived links.</p>
        <p>Records are kept on this device so the app works without a signal. Signing out clears this device.</p>
        <p className="text-sm text-muted"><TextLink to="/library/requirements">Master requirements</TextLink> describe what the platform must do.</p>
      </div>
    </div>
  );
}
