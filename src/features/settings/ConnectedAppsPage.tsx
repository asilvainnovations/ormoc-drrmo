import { useCallback, useEffect, useState } from 'react';
import type { OAuthGrant } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authMessage, useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/time';
import { CONSENT_PATH, describeScopes, hostOf, oauthEndpoints } from '@/lib/oauth';
import { useToast } from '@/components/Toast';
import { Button, List, Loading, Notice, PageHeader, Section } from '@/components/ui';

/** Apps this account has allowed through "Sign in with Ormoc DRRM", with a way to withdraw each. */
export function ConnectedAppsPage() {
  const { has } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const [grants, setGrants] = useState<OAuthGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.auth.oauth.listGrants();
    if (e) { setError(/not enabled|not found|404/i.test(e.message) ? 'Sign-in for other apps is not turned on for this project.' : authMessage(e)); setGrants([]); return; }
    setGrants(data ?? []);
  }, []);
  useEffect(() => { if (online) void load(); }, [online, load]);

  const revoke = async (g: OAuthGrant) => {
    setBusy(g.client.id);
    const { error: e } = await supabase.auth.oauth.revokeGrant({ clientId: g.client.id });
    setBusy(null);
    if (e) { toast(authMessage(e), 'bad'); return; }
    toast(`${g.client.name || 'The app'} can no longer use your account`);
    await load();
  };

  return (
    <div className="page">
      <PageHeader title="Connected apps" back="/settings" subtitle="Other City systems you have allowed to sign you in with your Ormoc DRRM account." />
      <Section>
        {!online ? <Notice tone="warn">This needs a connection.</Notice>
          : grants === null ? <Loading />
          : error ? <Notice tone="warn">{error}</Notice>
          : grants.length === 0 ? <Notice tone="info">You have not allowed any app.</Notice>
          : (
            <List>
              {grants.map((g) => (
                <li key={g.client.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{g.client.name || 'Unnamed app'}{hostOf(g.client.uri) && <span className="ml-2 font-data text-sm text-muted">{hostOf(g.client.uri)}</span>}</p>
                    <p className="text-sm text-muted">Allowed {fmtDateTime(g.granted_at)}: {describeScopes(g.scopes).map((s) => s.text.toLowerCase()).join('; ')}</p>
                  </div>
                  <Button variant="danger" busy={busy === g.client.id} onClick={() => void revoke(g)}
                    tip={`Withdraw access. ${g.client.name || 'The app'} must ask again before it can use your account`}>Withdraw</Button>
                </li>
              ))}
            </List>
          )}
      </Section>
      {has('admin') && <OAuthServerDetails />}
    </div>
  );
}

/** For the system administrator: what to give a City system that wants "Sign in with Ormoc DRRM". */
function OAuthServerDetails() {
  const e = oauthEndpoints();
  const rows: [string, string][] = [
    ['Issuer', e.issuer],
    ['Authorization endpoint', e.authorize],
    ['Token endpoint', e.token],
    ['JWKS (public signing keys)', e.jwks],
    ['OpenID Connect discovery', e.discovery],
    ['Consent screen (Authorization Path)', `${window.location.origin}${CONSENT_PATH}`],
  ];
  return (
    <Section title="For administrators: OAuth server">
      <p className="mb-3 text-sm text-muted">
        Register each app in Supabase (Authentication, then OAuth Apps) with its exact redirect address. Apps use the authorization code flow with PKCE. Their tokens are read-only in this platform: the database refuses any change made with them.
      </p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm font-semibold">{k}</dt>
            <dd className="break-all font-data text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
