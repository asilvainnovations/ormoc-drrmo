import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authMessage, useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { consentReturnPath, describeScopes, hostOf, isSafeRedirect } from '@/lib/oauth';
import { Button, Loading, Notice } from '@/components/ui';
import { AuthLayout, formCard } from './AuthLayout';
import { SignOutBlock } from './AccountGatePages';

type View =
  | { kind: 'loading' }
  | { kind: 'consent'; details: OAuthAuthorizationDetails }
  | { kind: 'leaving'; to: string }
  | { kind: 'error'; message: string };

/**
 * "Sign in with Ormoc DRRM" consent screen (OAuth 2.1 server, Authorization Path).
 * Another City system sends the person to Supabase Auth's /oauth/authorize; Supabase checks
 * the request and sends them here with ?authorization_id=…. The person signs in if needed,
 * sees which app is asking and what it wants, and allows or refuses. Supabase then issues the
 * code and tokens (/oauth/token) and the app verifies them against the project's JWKS.
 *
 * Only an approved, active account can allow an app (a pending account has no City role).
 * Allowing needs a connection (ADR-006: actions that carry authority are online-only).
 */
export function OAuthConsentPage() {
  const { ready, status, email } = useAuth();
  const [params] = useSearchParams();
  const online = useOnline();
  const authorizationId = params.get('authorization_id') ?? '';
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const loaded = useRef<string | null>(null);

  const leave = (to: string) => {
    if (!isSafeRedirect(to)) { setView({ kind: 'error', message: 'The app gave a return address this platform will not open. Tell the app\'s administrator.' }); return; }
    setView({ kind: 'leaving', to });
    window.location.assign(to);
  };

  useEffect(() => {
    if (!ready || status !== 'active' || !authorizationId || !online || loaded.current === authorizationId) return;
    loaded.current = authorizationId;
    void (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) { setView({ kind: 'error', message: requestError(error) }); return; }
      // Already allowed earlier for these scopes: Supabase answers with where to go next.
      if ('redirect_url' in data && !('authorization_id' in data)) { leave(data.redirect_url); return; }
      setView({ kind: 'consent', details: data as OAuthAuthorizationDetails });
    })();
  }, [ready, status, authorizationId, online]);

  if (!ready) return <Loading />;
  if (!authorizationId) {
    return <Shell title="Nothing to approve"><Notice tone="warn">This page opens when another app asks to use your Ormoc DRRM account. Start again from that app.</Notice></Shell>;
  }
  if (status === 'signed_out') {
    // Sign in first, then come back to this exact request.
    return <Navigate to="/login" replace state={{ from: consentReturnPath(authorizationId) }} />;
  }
  if (status === 'pending' || status === 'deactivated') {
    return (
      <Shell title="This account cannot allow other apps">
        <Notice tone="warn">
          {status === 'pending'
            ? 'Your account is still waiting for an administrator to approve it. Once it is approved, start again from the other app.'
            : 'This account has been deactivated by a system administrator.'}
        </Notice>
        <SignOutBlock label="Sign out" />
      </Shell>
    );
  }
  if (!online) {
    return <Shell title="This needs a connection"><Notice tone="warn">Allowing another app to use your account needs a connection. Try again when you are online.</Notice></Shell>;
  }

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'deny');
    const fn = approve ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization;
    const { data, error } = await fn.call(supabase.auth.oauth, authorizationId, { skipBrowserRedirect: true });
    setBusy(null);
    if (error || !data?.redirect_url) { setView({ kind: 'error', message: requestError(error) }); return; }
    leave(data.redirect_url);
  };

  if (view.kind === 'loading') return <Loading />;
  if (view.kind === 'leaving') {
    return <Shell title="Returning to the app"><Notice tone="ok">Taking you back to {hostOf(view.to) || 'the app'}…</Notice></Shell>;
  }
  if (view.kind === 'error') {
    return (
      <Shell title="This request did not work">
        <Notice tone="bad">{view.message}</Notice>
        <Link to="/" className="inline-flex min-h-tap items-center font-semibold underline">Go to Ormoc DRRM</Link>
      </Shell>
    );
  }

  const d = view.details;
  const appName = d.client.name || 'An app';
  const site = hostOf(d.client.uri);
  const returnHost = hostOf(d.redirect_uri);
  const scopes = describeScopes(d.scope);
  return (
    <AuthLayout title={`Allow ${appName}?`}
      intro={<>{appName}{site ? <> (<span className="font-data">{site}</span>)</> : null} wants to use your Ormoc DRRM account, <strong className="text-ink">{d.user?.email ?? email}</strong>.</>}>
      <div className={formCard}>
        <div>
          <h2 className="text-lg font-bold">It will be able to</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {scopes.map((s) => <li key={s.scope}>{s.text}</li>)}
          </ul>
        </div>
        <Notice tone="info" title="What it cannot do">
          Apps you allow can read the City records your role can read. They cannot add, change or delete anything in Ormoc DRRM. You can withdraw access at any time in Settings, then Connected apps.
        </Notice>
        {returnHost && <p className="text-sm text-muted">After you choose, you go back to <span className="font-data text-ink">{returnHost}</span>.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" busy={busy === 'deny'} disabled={busy !== null} onClick={() => void decide(false)}
            tip={`Refuse. ${appName} gets no access to your account`}>Refuse</Button>
          <Button size="lg" busy={busy === 'approve'} disabled={busy !== null} onClick={() => void decide(true)}
            tip={`Allow ${appName} to use your account as listed above`}>Allow</Button>
        </div>
        <p className="text-sm text-muted">Do not allow an app you do not recognise. If in doubt, ask the system administrator.</p>
      </div>
    </AuthLayout>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <AuthLayout title={title}><div className={formCard}>{children}</div></AuthLayout>;
}

function requestError(error: { message: string; status?: number } | null): string {
  if (!error) return 'The request could not be completed. Start again from the other app.';
  if (error.status === 404 || /not found|expired|invalid authorization/i.test(error.message)) {
    return 'This request has expired or was already answered. Start again from the other app.';
  }
  return authMessage(error);
}
