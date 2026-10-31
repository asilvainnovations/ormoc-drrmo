import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authMessage, MIN_PASSWORD, passwordProblem, useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/oauth';
import { Button, Field, Input, Loading, Notice } from '@/components/ui';
import { AuthLayout, formCard } from './AuthLayout';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Every email link lands here: account confirmation, invitation, sign-in link and
 * password reset. Three link shapes are understood:
 *  - ?token_hash=…&type=…  (recommended email templates; works on any device or browser)
 *  - ?code=…               (default templates; works in the browser that asked for the link)
 *  - #access_token=…       (older invitation links)
 */
export function AuthCallbackPage() {
  const nav = useNavigate();
  const { refreshAccount } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const linkError = q.get('error_description') ?? h.get('error_description');
      // Only ever continue to a page of this app (never '//other-site' or 'https://…').
      const next = safeNext(q.get('next'));
      try {
        if (linkError) throw new Error(linkError.replace(/\+/g, ' '));
        const type = (q.get('type') ?? h.get('type')) as EmailOtpType | null;
        const tokenHash = q.get('token_hash');
        const code = q.get('code');
        if (tokenHash && type && OTP_TYPES.includes(type)) {
          const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (e) throw e;
        } else if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) {
            if (/code verifier|both auth code and code verifier/i.test(e.message)) {
              throw new Error('Open this link in the same browser where you asked for it, or ask for a new link from this browser.');
            }
            throw e;
          }
        } else if (h.get('access_token') && h.get('refresh_token')) {
          const { error: e } = await supabase.auth.setSession({ access_token: h.get('access_token')!, refresh_token: h.get('refresh_token')! });
          if (e) throw e;
        } else {
          throw new Error('This link is incomplete. Copy the whole link from the email, or ask for a new one.');
        }
        await refreshAccount();
        // Invited people and password resets choose a password next.
        if (type === 'recovery' || type === 'invite' || next === '/auth/reset') { nav('/auth/reset', { replace: true }); return; }
        nav(next, { replace: true });
      } catch (e) {
        setError(authMessage(e as Error));
      }
    })();
  }, [nav, refreshAccount]);

  if (!error) return <Loading />;
  return (
    <AuthLayout title="This link did not work">
      <div className={formCard}>
        <Notice tone="bad">{error}</Notice>
        <Link to="/login" className="inline-flex min-h-tap items-center font-semibold underline">Go to sign in</Link>
      </div>
    </AuthLayout>
  );
}

/** Choose a new password: after a reset link or an invitation, or from Settings. */
export function SetPasswordPage() {
  const { ready, userId, email, updatePassword } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ready) return <Loading />;
  if (!userId) {
    return (
      <AuthLayout title="Set a new password">
        <div className={formCard}>
          <Notice tone="warn">Open the link in the password email first. It signs you in for this step.</Notice>
          <Link to="/login?mode=forgot" className="inline-flex min-h-tap items-center font-semibold underline">Ask for a new link</Link>
        </div>
      </AuthLayout>
    );
  }
  const problem = passwordProblem(pw, email ?? '') ?? (pw !== again ? 'The two passwords do not match.' : null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try { await updatePassword(pw); nav('/', { replace: true }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <AuthLayout title="Set a new password" intro={email ? `For ${email}.` : undefined}>
      <form onSubmit={submit} className={formCard} noValidate aria-label="Set a new password">
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters, with letters and a number.`}>
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <Field label="New password again" error={error}>
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}
        </Field>
        <Button type="submit" full size="lg" busy={busy} tip={problem ?? 'Save the new password'}>Save password</Button>
      </form>
    </AuthLayout>
  );
}
