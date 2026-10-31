import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const oauth = {
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
};
let authState: { ready: boolean; status: string; email: string | null } = { ready: true, status: 'active', email: 'duty@ormoc.gov.ph' };

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { oauth } } }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ ...authState, signOut: vi.fn(), unsent: vi.fn(async () => 0) }),
  authMessage: (e: { message: string }) => e.message,
  UnsentChangesError: class extends Error {},
}));
vi.mock('@/lib/hooks', () => ({ useOnline: () => true }));
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }));

const { OAuthConsentPage } = await import('./OAuthConsentPage');

function LoginProbe() { const l = useLocation() as { state?: { from?: string } }; return <p>login from {l.state?.from}</p>; }
const renderAt = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/oauth/consent" element={<OAuthConsentPage />} />
      <Route path="/login" element={<LoginProbe />} />
    </Routes>
  </MemoryRouter>,
);

const details = {
  authorization_id: 'az1', redirect_uri: 'https://reports.ormoc.gov.ph/callback', scope: 'openid email',
  client: { id: 'c1', name: 'City Reports', uri: 'https://reports.ormoc.gov.ph', logo_uri: '' },
  user: { id: 'u1', email: 'duty@ormoc.gov.ph' },
};

describe('OAuth consent screen', () => {
  const assign = vi.fn();
  beforeEach(() => {
    authState = { ready: true, status: 'active', email: 'duty@ormoc.gov.ph' };
    Object.values(oauth).forEach((f) => f.mockReset());
    assign.mockReset();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
  });

  it('sends a signed-out person to sign in, then back to the same request', () => {
    authState = { ready: true, status: 'signed_out', email: null };
    renderAt('/oauth/consent?authorization_id=az1');
    expect(screen.getByText('login from /oauth/consent?authorization_id=az1')).toBeTruthy();
  });

  it('does not let a pending account allow an app', () => {
    authState = { ready: true, status: 'pending', email: 'new@x.ph' };
    renderAt('/oauth/consent?authorization_id=az1');
    expect(screen.getByText(/cannot allow other apps/i)).toBeTruthy();
    expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it('shows the app, scopes and return address, and returns with the code on Allow', async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null });
    oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: 'https://reports.ormoc.gov.ph/callback?code=abc&state=s' }, error: null });
    renderAt('/oauth/consent?authorization_id=az1');
    expect(await screen.findByRole('heading', { name: 'Allow City Reports?' })).toBeTruthy();
    expect(screen.getByText('See your email address')).toBeTruthy();
    expect(screen.getAllByText('reports.ormoc.gov.ph').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://reports.ormoc.gov.ph/callback?code=abc&state=s'));
    expect(oauth.approveAuthorization).toHaveBeenCalledWith('az1', { skipBrowserRedirect: true });
  });

  it('refuses through Supabase and returns to the app', async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null });
    oauth.denyAuthorization.mockResolvedValue({ data: { redirect_url: 'https://reports.ormoc.gov.ph/callback?error=access_denied' }, error: null });
    renderAt('/oauth/consent?authorization_id=az1');
    fireEvent.click(await screen.findByRole('button', { name: 'Refuse' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://reports.ormoc.gov.ph/callback?error=access_denied'));
  });

  it('goes straight back when the app was already allowed, but never to a non-https address', async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: 'http://evil.example/cb?code=x' }, error: null });
    renderAt('/oauth/consent?authorization_id=az1');
    expect(await screen.findByText(/will not open/i)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('explains an expired request', async () => {
    oauth.getAuthorizationDetails.mockResolvedValue({ data: null, error: { message: 'authorization not found', status: 404 } });
    renderAt('/oauth/consent?authorization_id=old');
    expect(await screen.findByText(/expired or was already answered/i)).toBeTruthy();
  });
});
