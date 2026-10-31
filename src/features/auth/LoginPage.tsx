import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MIN_PASSWORD, passwordProblem, useAuth } from '@/lib/auth';
import { CONSENT_PATH, safeNext } from '@/lib/oauth';
import { Button, Checkbox, Field, Input, Notice } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { AuthLayout, formCard } from './AuthLayout';

type Mode = 'signin' | 'signup' | 'forgot';

const MODES: { mode: Mode; label: string; tip: string }[] = [
  { mode: 'signin', label: 'Have an account', tip: 'Sign in to an account you already have' },
  { mode: 'signup', label: 'New account', tip: 'New here? Create an account. An administrator approves it before you see City records' },
];

export function LoginPage() {
  const { userId, ready } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };
  const [params, setParams] = useSearchParams();
  const mode = (['signin', 'signup', 'forgot'].includes(params.get('mode') ?? '') ? params.get('mode') : 'signin') as Mode;
  const setMode = (m: Mode) => setParams(m === 'signin' ? {} : { mode: m }, { replace: true });
  // Where to go after signing in: a page of this app only (state from RequireAuth or the consent screen).
  const from = safeNext(loc.state?.from ?? params.get('next'), '/');
  const forApp = from.startsWith(CONSENT_PATH);

  if (ready && userId) return <Navigate to={from} replace />;

  return (
    <AuthLayout title="Ormoc City DRRM and Emergency Operations"
      intro="For CDRRMO, EOC and partner office staff of the City of Ormoc. Any email address can be used, including a personal one.">
      {forApp && (
        <div className="mt-6">
          <Notice tone="info" title="Another app is asking to use your account">
            Sign in to Ormoc DRRM first. You will then see which app is asking and what it wants, and you can allow or refuse it.
          </Notice>
        </div>
      )}
      {mode !== 'forgot' && (
        <div role="group" aria-label="Account" className="mt-8 grid grid-cols-2 gap-1 rounded-control border border-line bg-sunken p-1">
          {MODES.map((m) => (
            <button key={m.mode} type="button" aria-pressed={mode === m.mode} onClick={() => setMode(m.mode)} {...tip(m.tip)}
              className={`min-h-tap rounded-control px-3 font-semibold ${mode === m.mode ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink'}`}>{m.label}</button>
          ))}
        </div>
      )}
      {mode === 'signin' && <SignInForm onForgot={() => setMode('forgot')} from={from} />}
      {mode === 'signup' && <SignUpForm onSignIn={() => setMode('signin')} />}
      {mode === 'forgot' && <ForgotForm onBack={() => setMode('signin')} />}
    </AuthLayout>
  );
}

function SignInForm({ onForgot, from }: { onForgot: () => void; from?: string }) {
  const { signInWithPassword, sendMagicLink, resendConfirmation } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const unconfirmed = error?.startsWith('Confirm your email');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null); setSent(null);
    try {
      if (password) { await signInWithPassword(email.trim(), password); nav(from ?? '/', { replace: true }); }
      else { await sendMagicLink(email.trim(), from); setSent(`If ${email.trim()} has an account, a sign-in link is on its way. Open it on this device.`); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true);
    try { await resendConfirmation(email.trim()); setError(null); setSent(`We sent the confirmation link to ${email.trim()} again.`); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={formCard} noValidate aria-label="Sign in">
      {sent && <Notice tone="ok" title="Check your email">{sent}</Notice>}
      <Field label="Email" error={error}>
        {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...tip('The email address of your account')} />}
      </Field>
      {unconfirmed && <Button type="button" variant="secondary" busy={busy} onClick={resend} tip="Email the confirmation link again">Send the confirmation link again</Button>}
      <Field label="Password" optional hint="Leave empty to get a sign-in link by email instead.">
        {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...tip('Your password, or leave it empty to sign in with an emailed link')} />}
      </Field>
      <Button type="submit" full size="lg" busy={busy} disabled={!email.includes('@')} tip={password ? 'Sign in with your email and password' : 'We email you a one-time link. Open it on this device to sign in'}>{password ? 'Sign in' : 'Email me a sign-in link'}</Button>
      <button type="button" onClick={onForgot} className="min-h-tap font-semibold text-ink underline" {...tip('Set a new password through a link sent to your email')}>Forgot your password?</button>
    </form>
  );
}

function SignUpForm({ onSignIn }: { onSignIn: () => void }) {
  const { signUp } = useAuth();
  const [f, setF] = useState({ name: '', position: '', email: '', password: '', confirm: '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // A message about the form disappears as soon as the person changes something.
  useEffect(() => { setError(null); }, [f, consent]);
  const pwProblem = f.password ? passwordProblem(f.password, f.email) : null;
  const mismatch = f.confirm && f.confirm !== f.password ? 'The two passwords do not match.' : null;
  const problem = !f.name.trim() ? 'Enter your full name.' : !f.email.includes('@') ? 'Enter your email address.'
    : passwordProblem(f.password, f.email) ?? (f.confirm !== f.password ? 'The two passwords do not match.' : null) ?? (!consent ? 'Agree to the data privacy notice.' : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try { await signUp(f.email.trim(), f.password, f.name, f.position); setDone(true); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className={formCard}>
        <Notice tone="ok" title="Check your email">
          We sent a confirmation link to {f.email.trim()}. Open it to confirm your address. After that, a system administrator reviews your account and grants your role. You will see City records once they do.
        </Notice>
        <Button full variant="secondary" onClick={onSignIn} tip="Go back to sign in">Back to sign in</Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className={formCard} noValidate aria-label="Create an account">
      <Notice tone="info">New accounts see nothing until a system administrator approves them and grants a role.</Notice>
      <Field label="Full name" hint="As the administrator knows you, for example: Maria Santos.">
        {(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
      </Field>
      <Field label="Position and office" optional hint="For example: LDRRMO III, CDRRMO Operations.">
        {(id, d) => <Input id={id} aria-describedby={d} autoComplete="organization-title" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />}
      </Field>
      <Field label="Email">
        {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
      <Field label="Password" hint={`At least ${MIN_PASSWORD} characters, with letters and a number.`} error={pwProblem}>
        {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
      </Field>
      <Field label="Password again" error={mismatch}>
        {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />}
      </Field>
      <Checkbox checked={consent} onChange={() => setConsent(!consent)} className="flex py-2"
        tip="Required under the Data Privacy Act of 2012 (RA 10173)">
        <span className="text-sm">I agree that the City Government of Ormoc keeps my name, position, office and email to run my account, under the Data Privacy Act of 2012 (RA 10173).</span>
      </Checkbox>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      <Button type="submit" full size="lg" busy={busy} tip={problem ?? 'Create the account. We email you a link to confirm your address'}>Create account</Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await requestPasswordReset(email.trim()); setSent(true); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className={formCard} noValidate aria-label="Reset your password">
      <h2 className="text-xl font-bold">Reset your password</h2>
      {sent && <Notice tone="ok" title="Check your email">If {email.trim()} has an account, a link to set a new password is on its way.</Notice>}
      <Field label="Email" error={error}>
        {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" full size="lg" busy={busy} disabled={!email.includes('@')} tip="Email me a link to set a new password">Email me a reset link</Button>
      <button type="button" onClick={onBack} className="min-h-tap font-semibold text-ink underline" {...tip('Go back to sign in')}>Back to sign in</button>
    </form>
  );
}
