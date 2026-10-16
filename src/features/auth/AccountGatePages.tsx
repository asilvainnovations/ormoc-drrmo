import { useState, type FormEvent } from 'react';
import { useAuth, UnsentChangesError } from '@/lib/auth';
import { Button, Field, Input, Notice } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { AuthLayout, formCard } from './AuthLayout';

/** Signed in, email confirmed, waiting for an administrator to grant a role. No City data loads. */
export function PendingApprovalPage() {
  const { email, profile, refreshAccount, updateOwnProfile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [position, setPosition] = useState(profile?.position ?? '');
  const check = async () => {
    setBusy(true);
    try { await refreshAccount(); toast('Checked. Still waiting for approval.'); } finally { setBusy(false); }
  };
  const saveDetails = async (e: FormEvent) => {
    e.preventDefault(); if (!name.trim()) return;
    try { await updateOwnProfile(name, position); toast('Details saved'); } catch (err) { toast((err as Error).message, 'bad'); }
  };
  return (
    <AuthLayout title="Waiting for approval"
      intro={<>You are signed in as <strong className="text-ink">{email}</strong>. A system administrator must approve your account and grant your role before you can see City records.</>}>
      <div className={formCard}>
        <Notice tone="info" title="What happens next">
          The administrator checks who you are, usually with your office, then grants the role for your work. This page opens the app by itself when they do. You can also ask them directly.
        </Notice>
        <Button full size="lg" busy={busy} onClick={check} tip="Check now whether your account has been approved">Check again</Button>
      </div>
      <form onSubmit={saveDetails} className={formCard} aria-label="Your details">
        <h2 className="text-xl font-bold">Your details</h2>
        <p className="text-sm text-muted">This is what the administrator sees with your email. After approval only an administrator can change it.</p>
        <Field label="Full name">{(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Position and office" optional>{(id) => <Input id={id} value={position} onChange={(e) => setPosition(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary" disabled={!name.trim()} tip="Save your name and position">Save details</Button>
      </form>
      <SignOutBlock />
    </AuthLayout>
  );
}

export function DeactivatedPage() {
  const { email } = useAuth();
  return (
    <AuthLayout title="This account is not active"
      intro={<>The account <strong className="text-ink">{email}</strong> has been deactivated by a system administrator. Its past entries stay in the City's records.</>}>
      <div className={formCard}><Notice tone="warn">Ask the system administrator if you think this is a mistake.</Notice></div>
      <SignOutBlock />
    </AuthLayout>
  );
}

/** Sign out, offering to discard changes that can never be sent (shared devices). */
export function SignOutBlock({ label = 'Sign out and clear this device' }: { label?: string }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const go = async (discardUnsent = false) => {
    setBusy(true);
    try { await signOut({ discardUnsent }); }
    catch (e) { if (e instanceof UnsentChangesError) setBlocked(e.count); setBusy(false); }
  };
  return (
    <div className="mt-6 space-y-3">
      {blocked !== null && (
        <Notice tone="warn" title={`${blocked} change${blocked === 1 ? '' : 's'} not on the server`}>
          <p>Connect and open Settings, then Sync and offline data, to send or review them. If they can never be sent (for example on a device you are handing over), type DISCARD to delete them and sign out.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Type DISCARD">{(id) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} className="w-40" />}</Field>
            <Button variant="danger" disabled={typed.trim().toUpperCase() !== 'DISCARD'} busy={busy} onClick={() => go(true)}
              tip="Delete the unsent changes on this device and sign out. This cannot be undone">Discard and sign out</Button>
          </div>
        </Notice>
      )}
      <Button variant="secondary" busy={busy && blocked === null} onClick={() => go(false)} tip="Sign out and erase this device’s copy of the data">{label}</Button>
    </div>
  );
}
