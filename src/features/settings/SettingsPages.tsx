import { tip } from '@/components/Tooltip';
import { checkBarangayList, ORMOC_BARANGAY_COUNT } from '@/domain/barangays';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, Upload } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { syncNow, useSyncState } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import { ALL_ROLES, ROLE_LABEL, useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { fmtDateTime, relative } from '@/lib/time';
import { useOnline } from '@/lib/hooks';
import { Badge, Button, Checkbox, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Select, Textarea, TextLink } from '@/components/ui';
import { SignOutBlock } from '@/features/auth/AccountGatePages';
import { useToast } from '@/components/Toast';
import type { Barangay, Role } from '@/types';

export function SettingsPage() {
  const { profile, email, roles, has } = useAuth();
  return (
    <div className="page">
      <PageHeader title="Settings" />
      <Section title="Your account">
        <p className="font-semibold">{profile?.full_name || 'Name not set'}</p>
        <p className="text-muted">{email}{profile?.position ? `, ${profile.position}` : ''}</p>
        <p className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)}</p>
        <p className="mt-3"><TextLink to="/auth/reset" tip="Choose a new password for this account">Change password</TextLink></p>
        <p className="mt-1"><TextLink to="/settings/apps" tip="See and withdraw the other City systems you allowed to sign you in with this account">Connected apps</TextLink></p>
      </Section>
      <Section title="This device">
        <List>
          <ListRow tip="See what is waiting to send and anything the server refused" to="/settings/sync" title="Sync and offline data" meta="What is waiting to send, and anything the server refused" />
          {has('admin') && <ListRow tip="Approve new accounts, grant or remove roles, deactivate people" to="/settings/users" title="Users and roles" meta="Approve new accounts and grant roles" />}
          {has('admin') && <ListRow tip="Load or update the barangay list from the PSA PSGC file" to="/settings/barangays" title="Barangay list" meta="Import the barangays with their PSGC codes" />}
          <ListRow tip="Version, data privacy and where the data is held" to="/settings/about" title="About and data privacy" />
        </List>
      </Section>
      <SignOutBlock />
    </div>
  );
}

/** A readable copy of what someone typed, so a refused entry can be entered again. */
function entryText(rows: Record<string, unknown>[] | undefined): string {
  if (!rows?.length) return '';
  const skip = new Set(['id', 'version', 'created_at', 'updated_at']);
  return rows.map((r) => Object.entries(r).filter(([k, v]) => !skip.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('\n')).join('\n\n');
}

export function SyncPage() {
  const sync = useSyncState();
  const online = useOnline();
  const toast = useToast();
  const { userId } = useAuth();
  const data = useLiveQuery(async () => ({
    outbox: await db.outbox.orderBy('seq').toArray(), failed: await db.failed.reverse().toArray(), conflicts: await db.conflicts.reverse().toArray(),
  }), []);
  const mine = data?.outbox.filter((o) => !o.userId || o.userId === userId) ?? [];
  const held = data?.outbox.filter((o) => o.userId && o.userId !== userId) ?? [];
  // Apply only the fields this person changed on top of the server's latest version.
  const retryConflict = async (id: number) => {
    const c = await db.conflicts.get(id);
    if (!c || !c.server) return;
    const changed = c.base
      ? Object.fromEntries(Object.entries(c.local).filter(([k, v]) => k !== 'version' && JSON.stringify(v ?? null) !== JSON.stringify(c.base![k] ?? null)))
      : c.local;
    await save(c.table, { ...c.server, ...changed, version: c.server.version }, `Reapply: ${c.label}`);
    await db.conflicts.delete(id);
    toast('Your change was applied on top of the latest version');
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it where you enter the record again.'); }
    catch { toast('Copying is blocked in this browser. Select the text and copy it.', 'bad'); }
  };
  return (
    <div className="page">
      <PageHeader title="Sync and offline data" back="/settings"
        subtitle={`${online ? 'Online' : 'Offline'}. ${sync.lastSyncAt ? `Last synced ${relative(sync.lastSyncAt)}.` : 'Not synced yet.'}`}
        actions={<Button tip="Send waiting changes and fetch the latest data now" icon={RefreshCw} busy={sync.status === 'syncing'} disabled={!online} onClick={() => syncNow({ forceReference: true })}>Sync now</Button>} />
      {sync.status === 'error' && <Notice tone="bad" title="Sync stopped">{sync.message}</Notice>}
      {sync.status === 'signed_out' && <Notice tone="warn" title="Signed out">Sign in again to send your changes.</Notice>}
      <Section title={`Waiting to send (${mine.length})`}>
        {mine.length ? <List>{mine.map((o) => <ListRow key={o.seq} title={o.label} meta={`${fmtDateTime(o.createdAt)}${o.attempts ? `, ${o.attempts} attempt(s)` : ''}`} />)}</List>
          : <p className="text-muted">Nothing waiting. Changes save on this device first and send automatically when there is a connection.</p>}
      </Section>
      {held.length > 0 && (
        <Section title={`From another account (${held.length})`}>
          <Notice tone="warn">These changes were made on this device by someone who has since signed out. They are sent only when that person signs in here again. They are never sent under your account.</Notice>
          <List>{held.map((o) => <ListRow key={o.seq} title={o.label} meta={fmtDateTime(o.createdAt)} />)}</List>
        </Section>
      )}
      <Section title={`Refused by the server (${data?.failed.length ?? 0})`}>
        {data?.failed.length ? (
          <List>{data.failed.map((f) => <li key={f.id} className="py-3">
            <p className="font-semibold">{f.label}</p><p className="text-sm text-bad">{f.error}</p>
            <p className="text-xs text-muted">{fmtDateTime(f.at)}. The record shows the server copy again.</p>
            {f.rows?.length ? (
              <details className="mt-2"><summary className="min-h-tap cursor-pointer font-semibold" {...tip('Show what you entered, so you can enter it again')}>What you entered</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded-control bg-sunken p-3 text-sm">{entryText(f.rows)}</pre>
                <Button tip="Copy what you entered" className="mt-1" variant="secondary" onClick={() => copy(entryText(f.rows))}>Copy</Button>
              </details>) : null}
            <Button tip="Remove this message from the list" className="mt-1" variant="quiet" onClick={() => db.failed.delete(f.id!)}>Dismiss</Button></li>)}</List>
        ) : <p className="text-muted">None.</p>}
      </Section>
      <Section title={`Edited by someone else first (${data?.conflicts.length ?? 0})`}>
        {data?.conflicts.length ? (
          <List>{data.conflicts.map((c) => <li key={c.id} className="py-3">
            <p className="font-semibold">{c.label}</p>
            <p className="text-sm text-muted">{c.server ? 'Another person saved this record before your change arrived. The record now shows their version.' : 'This record is no longer on the server or not visible to your role.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.server && <Button tip="Apply the fields you changed on top of the other person’s version" variant="secondary" onClick={() => retryConflict(c.id!)}>Apply my change on top</Button>}
              <Button tip="Keep the other person’s version and discard yours" variant="quiet" onClick={() => db.conflicts.delete(c.id!)}>Keep theirs</Button>
            </div></li>)}</List>
        ) : <p className="text-muted">None.</p>}
      </Section>
    </div>
  );
}

interface Account {
  id: string; email: string; email_confirmed_at: string | null; created_at: string; last_sign_in_at: string | null;
  full_name: string; position: string | null; office_id: string | null; is_active: boolean; roles: Role[]; version: number;
}

export function UsersPage() {
  const toast = useToast();
  const online = useOnline();
  const { userId, has } = useAuth();
  const offices = useLiveQuery(() => db.offices.orderBy('code').toArray(), [], []);
  const [rows, setRows] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const load = async () => {
    const { data, error: e } = await supabase.rpc('admin_list_accounts');
    if (e) { setError(e.message); return; }
    setError(null); setRows((data as Account[]) ?? []);
  };
  useEffect(() => { if (online && has('admin')) void load(); }, [online]);  // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error: e } = await p;
    if (e) toast(e.message, 'bad'); else { toast(ok); await load(); }
  };
  const toggle = (u: Account, role: Role) => u.roles.includes(role)
    ? act(supabase.from('user_roles').delete().eq('user_id', u.id).eq('role', role), `${ROLE_LABEL[role]} removed`)
    : act(supabase.from('user_roles').insert({ user_id: u.id, role }), u.roles.length ? `${ROLE_LABEL[role]} granted` : `Approved as ${ROLE_LABEL[role]}`);
  // Deactivating keeps the person's records and audit trail; RLS then denies them everything.
  const setActive = (u: Account, active: boolean) => act(supabase.from('profiles').update({ is_active: active, version: u.version }).eq('id', u.id), active ? 'Account reactivated' : 'Account deactivated');
  const setOffice = (u: Account, office: string) => act(supabase.from('profiles').update({ office_id: office || null, version: u.version }).eq('id', u.id), 'Office saved');

  if (!has('admin')) return <div className="page"><PageHeader title="Users and roles" back="/settings" /><Notice tone="warn">Only a system administrator can manage accounts.</Notice></div>;
  const match = (u: Account) => !q.trim() || `${u.email} ${u.full_name} ${u.position ?? ''}`.toLowerCase().includes(q.trim().toLowerCase());
  const pending = (rows ?? []).filter((u) => u.is_active && u.roles.length === 0 && match(u));
  const active = (rows ?? []).filter((u) => u.is_active && u.roles.length > 0 && match(u));
  const inactive = (rows ?? []).filter((u) => !u.is_active && match(u));

  const card = (u: Account) => (
    <Section key={u.id} title={u.full_name || 'Name not given'}
      action={u.id === userId ? <Badge>You</Badge> : u.is_active
        ? <Button tip={u.roles.length ? 'Remove this person’s access. Their records stay' : 'Decline this account: it can no longer sign in to anything'} variant="quiet" size="md" onClick={() => setActive(u, false)}>{u.roles.length ? 'Deactivate' : 'Decline'}</Button>
        : <Button tip="Give this person access again" variant="secondary" onClick={() => setActive(u, true)}>Reactivate</Button>}>
      <p className="font-semibold">{u.email}</p>
      <p className="text-sm text-muted">
        {u.position ? `${u.position}. ` : ''}Signed up {fmtDateTime(u.created_at)}. {u.email_confirmed_at ? 'Email confirmed.' : 'Email not confirmed yet.'}
        {u.last_sign_in_at ? ` Last sign-in ${relative(u.last_sign_in_at)}.` : ''}
      </p>
      {!u.email_confirmed_at && <Notice tone="warn">Wait until this person confirms their email before approving.</Notice>}
      {u.is_active && u.email_confirmed_at && (
        <>
          {u.roles.length === 0 && <p className="mt-2 text-sm">Check who this is (for example with their office), then tick the role for their work to approve the account.</p>}
          <div className="mt-2 flex flex-wrap gap-2">{ALL_ROLES.map((r) => (
            <Checkbox tip={u.id === userId && r === 'admin' ? 'You cannot remove your own administrator role' : `${u.roles.includes(r) ? 'Remove' : 'Grant'} the ${ROLE_LABEL[r]} role`} key={r}
              checked={u.roles.includes(r)} onChange={() => { if (!(u.id === userId && r === 'admin')) void toggle(u, r); }}>{ROLE_LABEL[r]}</Checkbox>))}</div>
          <Field label="Office" optional hint="Needed for lead-office focal persons (Part C indicators of their office).">
            {(id, d) => <Select id={id} aria-describedby={d} value={u.office_id ?? ''} onChange={(e) => void setOffice(u, e.target.value)}>
              <option value="">No office</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.code} {o.name}</option>)}
            </Select>}
          </Field>
        </>
      )}
      {!u.is_active && <Notice tone="warn">Deactivated. This person can no longer see or change anything. Their past entries stay.</Notice>}
    </Section>
  );

  return (
    <div className="page">
      <PageHeader title="Users and roles" back="/settings"
        subtitle="Anyone can create an account. It sees nothing until you approve it by granting a role. Changes need a connection."
        actions={<Button tip="Fetch the latest list of accounts" icon={RefreshCw} disabled={!online} onClick={load}>Refresh</Button>} />
      {!online && <Notice tone="warn">Connect to manage accounts.</Notice>}
      {error && <Notice tone="bad" title="The account list could not be loaded">{error}</Notice>}
      {rows && (
        <div className="mb-4 max-w-md"><Field label="Find a person">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, name or position" />}</Field></div>
      )}
      {!rows ? (online ? <Loading /> : null) : (<>
        <h2 className="mb-3 mt-6 text-xl font-bold">Waiting for approval ({pending.length})</h2>
        {pending.length ? pending.map(card) : <p className="mb-6 text-muted">No accounts are waiting.</p>}
        <h2 className="mb-3 mt-8 text-xl font-bold">Active ({active.length})</h2>
        {active.map(card)}
        {inactive.length > 0 && <><h2 className="mb-3 mt-8 text-xl font-bold">Deactivated or declined ({inactive.length})</h2>{inactive.map(card)}</>}
      </>)}
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const { rows, errors: errs } = parseBarangayCsv(text);
    setErrors(errs);
    if (errs.length || rows.length === 0) return;
    // A list that does not look like the current PSA masterlist needs an explicit confirmation.
    const w = checkBarangayList(rows);
    setWarnings(w);
    if (w.length && !confirmed) return;
    setBusy(true);
    try {
      if (!navigator.onLine) throw new Error('Importing the barangay list needs a connection.');
      const { error } = await supabase.from('barangays').upsert(rows, { onConflict: 'psgc' });
      if (error) throw new Error(error.message);
      await db.barangays.bulkPut(rows.map((r) => ({ ...r, version: 1 })));
      toast(`${rows.length} barangays imported`); setText(''); setWarnings([]); setConfirmed(false);
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  return (
    <div className="page">
      <PageHeader title="Barangay list" back="/settings" subtitle={`${count} of ${ORMOC_BARANGAY_COUNT} barangays loaded. Use the current PSA PSGC masterlist for the City of Ormoc.`} />
      <div className="max-w-3xl space-y-4">
        <Field label="Paste CSV" hint={<>Columns: <code>psgc,name,classification,population,lat,lng</code>. Classification uses <code>;</code> between values, for example <code>coastal;urban</code>. Only PSGC and name are required.</>}>
          {(id, d) => <Textarea id={id} aria-describedby={d} rows={10} value={text} onChange={(e) => { setText(e.target.value); setWarnings([]); setConfirmed(false); }} />}
        </Field>
        <label {...tip('Load the CSV file downloaded or prepared from the PSA PSGC masterlist')} className="inline-flex min-h-tap cursor-pointer items-center gap-2 font-semibold underline">
          <Upload className="h-4 w-4" aria-hidden />Or choose a CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setWarnings([]); setConfirmed(false); } }} />
        </label>
        <Notice tone="info" title="Use the current list">Ormoc has {ORMOC_BARANGAY_COUNT} barangays since the PSA 4th quarter 2022 update. The former numbered Poblacion barangays are now Barangays South, East and West (City Ordinance No. 052, s. 2021, ratified on 8 October 2022), and Barangay 29 is Barangay North. Lists showing 110 barangays are out of date.</Notice>
        {warnings.length > 0 && (
          <Notice tone="warn" title="This does not look like the current PSA list">
            <ul className="list-disc pl-5">{warnings.map((x) => <li key={x}>{x}</li>)}</ul>
            <Checkbox className="mt-3" checked={confirmed} onChange={() => setConfirmed((c) => !c)} tip="Tick only if you have checked this list against the current PSA PSGC masterlist">I have checked this list against the current PSA masterlist. Import it anyway.</Checkbox>
          </Notice>
        )}
        {errors.length > 0 && <Notice tone="bad" title="Fix these lines first"><ul className="list-disc pl-5">{errors.slice(0, 10).map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
        <Button tip="Check the list and save the barangays" busy={busy} disabled={!text.trim()} onClick={run}>Import barangays</Button>
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
        <p className="text-sm text-muted"><TextLink tip="Open the master requirements" to="/library/requirements">Master requirements</TextLink> describe what the platform must do.</p>
      </div>
    </div>
  );
}
