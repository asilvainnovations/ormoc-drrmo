import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthError, Session } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, supabase } from './supabase';
import { db, getMeta, setMeta } from './db';
import { setActingUser } from './store';
import { resetSyncedData } from './sync';
import type { Profile, Role } from '@/types';

export const ALL_ROLES: Role[] = ['admin', 'cdrrmo_head', 'assessor', 'validator', 'eoc_manager', 'eoc_staff', 'duty_officer', 'lead_office_focal', 'author', 'viewer'];
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'System administrator', cdrrmo_head: 'CDRRMO Head', assessor: 'Assessor', validator: 'Validator',
  eoc_manager: 'EOC Manager', eoc_staff: 'EOC staff', duty_officer: 'Duty officer', lead_office_focal: 'Lead-office focal person',
  author: 'Manual author', viewer: 'Viewer',
};
export const MIN_PASSWORD = 10;

/**
 * signed_out: no account on this device.
 * pending: signed in, waiting for an administrator to grant a role (sees no City data).
 * deactivated: an administrator turned the account off.
 * active: at least one role; the app and sync run.
 */
export type AccountStatus = 'signed_out' | 'pending' | 'deactivated' | 'active';

interface Identity { userId: string; email: string | null }

interface AuthState {
  ready: boolean;
  status: AccountStatus;
  userId: string | null;
  email: string | null;
  /** Working from the last known sign-in while there is no connection to renew it. */
  offlineIdentity: boolean;
  profile: Profile | null;
  roles: Role[];
  has: (...r: Role[]) => boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, position: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateOwnProfile: (fullName: string, position: string) => Promise<void>;
  refreshAccount: () => Promise<void>;
  /** Changes on this device that have not reached the server (queued, refused, conflicting). */
  unsent: () => Promise<number>;
  signOut: (opts?: { discardUnsent?: boolean }) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export const authRedirect = (path = '/auth/confirm') => `${window.location.origin}${path}`;

/** Messages people can act on. Never reveals whether an address has an account. */
export function authMessage(e: AuthError | Error | { message: string; status?: number; code?: string }): string {
  const m = e.message ?? '';
  const status = (e as { status?: number }).status;
  if (typeof navigator !== 'undefined' && !navigator.onLine || /fetch|network|load failed/i.test(m)) return 'This needs a connection. Try again when you are online.';
  if (/invalid login credentials/i.test(m)) return 'Email or password is wrong.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email address first. Open the link we emailed you, or send it again below.';
  if (status === 429 || /rate limit|too many/i.test(m)) return 'Too many attempts. Wait a few minutes, then try again.';
  if (/weak|pwned|password should/i.test(m)) return `Choose a stronger password: at least ${MIN_PASSWORD} characters, not one that has appeared in a data breach.`;
  if (/signups? not allowed/i.test(m)) return 'New accounts are not open at the moment. Ask the system administrator.';
  if (/expired|invalid.*(token|otp|link)|otp/i.test(m)) return 'This link has expired or was already used. Ask for a new one.';
  return m;
}

export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Use letters and at least one number.';
  if (email && pw.toLowerCase().includes(email.split('@')[0]!.toLowerCase())) return 'Do not use your email name in the password.';
  return null;
}

/** Same role set, ignoring order. */
const sameRoles = (a: Role[], b: Role[]) => a.length === b.length && a.every((r) => b.includes(r));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [offlineIdentity, setOfflineIdentity] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const loading = useRef<Promise<void> | null>(null);

  const clearIdentity = useCallback(() => {
    setIdentity(null); setRoles([]); setProfile(null); setIsActive(true); setOfflineIdentity(false); setActingUser(null);
  }, []);

  /**
   * Load who is signed in. The device belongs to one account at a time: when a
   * different account signs in, the previous account's synced copy is removed first
   * (its unsent changes are held for it, never sent under this account).
   */
  const loadIdentity = useCallback(async (s: Session | null) => {
    if (!s) { clearIdentity(); return; }
    const id = s.user.id;
    const owner = await getMeta<string | null>('deviceOwner', null);
    if (owner && owner !== id) await resetSyncedData();
    await setMeta('deviceOwner', id);
    await setMeta('lastIdentity', { userId: id, email: s.user.email ?? null } satisfies Identity);
    setActingUser(id);
    setIdentity({ userId: id, email: s.user.email ?? null });
    setOfflineIdentity(false);
    // Cached copy first, so roles survive offline restarts; then refresh.
    const cached = await getMeta<Role[]>(`roles:${id}`, []);
    setRoles(cached);
    setIsActive(await getMeta<boolean>(`active:${id}`, true));
    setProfile((await db.profiles.get(id)) ?? null);
    try {
      const { data, error } = await supabase.rpc('my_account');
      if (!error && data) {
        const acc = data as { full_name: string; position: string | null; is_active: boolean; roles: Role[] };
        const fresh = acc.is_active ? acc.roles : [];
        // A changed role set changes what this account may read: fetch everything again.
        if (owner === id && !sameRoles(cached, fresh)) await resetSyncedData();
        setRoles(fresh); setIsActive(acc.is_active);
        await setMeta(`roles:${id}`, fresh); await setMeta(`active:${id}`, acc.is_active);
        setProfile((p) => ({ ...(p ?? { id, office_id: null }), id, full_name: acc.full_name, position: acc.position, is_active: acc.is_active } as Profile));
      }
    } catch { /* offline: keep cached identity */ }
  }, [clearIdentity]);

  const load = useCallback((s: Session | null) => {
    const run = (loading.current ?? Promise.resolve()).then(() => loadIdentity(s));
    loading.current = run.catch(() => undefined);
    return run;
  }, [loadIdentity]);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!alive) return;
      if (data.session) { await load(data.session); setReady(true); return; }
      // Offline restart after the access token expired: supabase-js keeps the stored session
      // but cannot renew it without a connection. Keep working as the last known account;
      // the outbox waits, and the session renews itself when the connection returns.
      const stored = (() => { try { return localStorage.getItem(AUTH_STORAGE_KEY); } catch { return null; } })();
      const last = await getMeta<Identity | null>('lastIdentity', null);
      const retryable = !navigator.onLine || (error && /fetch|network|retryable/i.test(`${error.name} ${error.message}`));
      if (stored && last && retryable) {
        setActingUser(last.userId);
        setIdentity(last); setOfflineIdentity(true);
        setRoles(await getMeta<Role[]>(`roles:${last.userId}`, []));
        setIsActive(await getMeta<boolean>(`active:${last.userId}`, true));
        setProfile((await db.profiles.get(last.userId)) ?? null);
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return;                 // handled by getSession above
      if (event === 'SIGNED_OUT') { clearIdentity(); return; }
      if (event === 'TOKEN_REFRESHED' && s) { setOfflineIdentity(false); return; }
      // Leave the auth callback before talking to the database (supabase-js advice).
      setTimeout(() => { void load(s); }, 0);
    });
    const onOnline = () => { void supabase.auth.getSession().then(({ data }) => { if (data.session) void load(data.session); }); };
    window.addEventListener('online', onOnline);
    return () => { alive = false; sub.subscription.unsubscribe(); window.removeEventListener('online', onOnline); };
  }, [load, clearIdentity]);

  const refreshAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  // Waiting for approval: check again when the person comes back to the app.
  const status: AccountStatus = !identity ? 'signed_out' : !isActive ? 'deactivated' : roles.length ? 'active' : 'pending';
  useEffect(() => {
    if (status !== 'pending') return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAccount(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(() => void refreshAccount(), 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, [status, refreshAccount]);

  const unsent = useCallback(async () => {
    const mine = (await db.outbox.toArray()).filter((o) => !o.userId || o.userId === identity?.userId).length;
    return mine + (await db.failed.count()) + (await db.conflicts.count());
  }, [identity]);

  const value = useMemo<AuthState>(() => ({
    ready, status, offlineIdentity,
    userId: identity?.userId ?? null,
    email: identity?.email ?? null,
    profile,
    roles,
    has: (...r: Role[]) => roles.includes('admin') || r.some((x) => roles.includes(x)),
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authMessage(error));
    },
    signUp: async (email, password, fullName, position) => {
      const { error } = await supabase.auth.signUp({ email, password,
        options: { emailRedirectTo: authRedirect(), data: { full_name: fullName.trim(), position: position.trim() || null } } });
      // An address that already has an account gets the same answer (Supabase sends no second email).
      if (error) throw new Error(authMessage(error));
    },
    resendConfirmation: async (email) => {
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirect() } });
      if (error) throw new Error(authMessage(error));
    },
    sendMagicLink: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: authRedirect() } });
      // An address without an account gets the same answer as one with an account.
      if (error && !/signups? not allowed|user not found/i.test(error.message)) throw new Error(authMessage(error));
    },
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirect('/auth/confirm?next=/auth/reset') });
      if (error && !/user not found/i.test(error.message)) throw new Error(authMessage(error));
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(authMessage(error));
    },
    updateOwnProfile: async (fullName, position) => {
      if (!identity) return;
      const { data: cur } = await supabase.from('profiles').select('version').eq('id', identity.userId).maybeSingle();
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), position: position.trim() || null, version: cur?.version ?? 1 }).eq('id', identity.userId);
      if (error) throw new Error(authMessage(error));
      await refreshAccount();
    },
    refreshAccount,
    unsent,
    signOut: async (opts = {}) => {
      const n = await unsent();
      if (n > 0 && !opts.discardUnsent) {
        throw new UnsentChangesError(n);
      }
      // Revoke every session of this account when there is a connection, then always
      // clear this device, even offline (a shared EOC device must not stay signed in).
      if (navigator.onLine) await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      try { localStorage.removeItem(AUTH_STORAGE_KEY); localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`); } catch { /* storage blocked */ }
      setActingUser(null);
      await db.delete();          // leave nothing on a shared device
      window.location.assign('/login');
    },
  }), [ready, status, offlineIdentity, identity, profile, roles, refreshAccount, unsent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export class UnsentChangesError extends Error {
  constructor(public count: number) {
    super(`${count} change${count === 1 ? ' has' : 's have'} not reached the server. Connect and sync, or discard them to sign out.`);
  }
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
