import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Button, Field, Input, Notice } from '@/components/ui';
import { BrandLockup } from '@/components/Brand';
import { tip } from '@/components/Tooltip';

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
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,1fr)]">
      {/* The City banner. Navy behind it matches the artwork's edges when it is letterboxed. */}
      <div className="relative overflow-hidden bg-banner lg:sticky lg:top-0 lg:flex lg:h-dvh lg:items-center">
        <div aria-hidden className="absolute inset-0 hidden scale-110 bg-cover bg-center opacity-40 blur-2xl lg:block" style={{ backgroundImage: "url('/brand/app-banner-800.webp')" }} />
        <picture className="relative block w-full">
          <source type="image/webp" srcSet="/brand/app-banner-800.webp 800w, /brand/app-banner-1600.webp 1600w" sizes="(min-width: 1024px) 58vw, 100vw" />
          <img src="/brand/app-banner-800.jpg" srcSet="/brand/app-banner-800.jpg 800w, /brand/app-banner-1600.jpg 1600w" sizes="(min-width: 1024px) 58vw, 100vw"
            alt="DRRM and Emergency Operations Platform: prepare before, respond together, recover stronger, build safer communities"
            width={1600} height={916} className="block h-auto w-full lg:max-h-dvh lg:object-contain" fetchPriority="high" />
        </picture>
        <div className="h-1.5 w-full bg-accent-bright lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1.5" aria-hidden />
      </div>

      <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8 lg:py-12">
        <BrandLockup size={52} />
        <h1 className="mt-6 text-3xl font-extrabold">Ormoc City DRRM and Emergency Operations</h1>
        <p className="mt-2 text-muted">For CDRRMO, EOC and partner office staff of the City of Ormoc. Sign in with the email address your invitation was sent to. Any address can be invited, including a personal one.</p>
        <form onSubmit={submit} className="mt-8 space-y-5 rounded-sheet border border-line bg-surface p-5 shadow-raised" noValidate>
          {sent && <Notice tone="ok" title="Check your email">We sent a sign-in link to {email}. Open it on this device.</Notice>}
          <Field label="Email" error={error}>
            {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...tip('The email address your invitation was sent to')} />}
          </Field>
          <Field label="Password" optional hint="Leave empty to get a sign-in link by email instead.">
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...tip('Your password, or leave it empty to sign in with an emailed link')} />}
          </Field>
          <Button type="submit" full size="lg" busy={busy} disabled={!email.includes('@')} tip={password ? 'Sign in with your email and password' : 'We email you a one-time link. Open it on this device to sign in'}>{password ? 'Sign in' : 'Email me a sign-in link'}</Button>
        </form>
        <p className="mt-8 text-sm text-muted">Data is held by the City Government of Ormoc under the Data Privacy Act of 2012 (RA 10173). Do not enter the names of affected persons or informants.</p>
      </main>
    </div>
  );
}
