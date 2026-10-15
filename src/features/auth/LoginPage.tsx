import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Button, Field, Input, Notice } from '@/components/ui';

export function LoginPage() {
  const { userId, ready, signInWithPassword, sendMagicLink } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (env.demo || (ready && userId)) return <Navigate to={loc.state?.from ?? '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (password) { await signInWithPassword(email.trim(), password); nav(loc.state?.from ?? '/', { replace: true }); }
      else { await sendMagicLink(email.trim()); setSent(true); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="h-2 w-full bg-lvl-white" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-3xl font-bold">Ormoc DRRM Operations</h1>
        <p className="mt-2 text-muted">For CDRRMO, EOC and partner office staff of the City of Ormoc. Sign in with the email address your invitation was sent to. Any address can be invited, including a personal one.</p>
        <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
          {sent && <Notice tone="ok" title="Check your email">We sent a sign-in link to {email}. Open it on this device.</Notice>}
          <Field label="Email" error={error}>
            {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password" optional hint="Leave empty to get a sign-in link by email instead.">
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" full size="lg" busy={busy} disabled={!email.includes('@')}>{password ? 'Sign in' : 'Email me a sign-in link'}</Button>
        </form>
        <p className="mt-8 text-sm text-muted">Data is held by the City Government of Ormoc under the Data Privacy Act of 2012 (RA 10173). Do not enter the names of affected persons or informants.</p>
      </main>
    </div>
  );
}
