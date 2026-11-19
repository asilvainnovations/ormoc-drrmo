import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signInWithGoogle = vi.fn(async () => undefined);
vi.mock('@/lib/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth')>()),
  useAuth: () => ({ userId: null, ready: true, signInWithGoogle, signInWithPassword: vi.fn(), sendMagicLink: vi.fn(), resendConfirmation: vi.fn(), signUp: vi.fn(), requestPasswordReset: vi.fn() }),
}));
const flags = vi.hoisted(() => ({ google: true }));
vi.mock('@/lib/env', async (orig) => {
  const m = await orig<typeof import('@/lib/env')>();
  return { ...m, env: new Proxy(m.env, { get: (t, k) => (k === 'googleSignIn' ? flags.google : (t as Record<string | symbol, unknown>)[k]) }) };
});
import { LoginPage } from './LoginPage';

describe('Google sign-in (1.28.0)', () => {
  beforeEach(() => { cleanup(); signInWithGoogle.mockClear(); });
  it('offers Google on sign-in and starts it', async () => {
    flags.google = true;
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Continue with Google'));
    expect(signInWithGoogle).toHaveBeenCalledWith('/today');
  });
  it('asks for the privacy agreement before a Google sign-up', () => {
    flags.google = true;
    render(<MemoryRouter initialEntries={['/login?mode=signup']}><LoginPage /></MemoryRouter>);
    const btn = screen.getByText('Sign up with Google').closest('button')!;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByText(/I agree that the City Government of Ormoc/));
    expect(btn.disabled).toBe(false);
    expect(screen.getAllByText(/I agree that the City Government of Ormoc/)).toHaveLength(1);
  });
  it('is hidden until the City switches it on', () => {
    flags.google = false;
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });
});
