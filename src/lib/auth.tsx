import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { env } from './env';
import { db, getMeta, setMeta } from './db';
import type { Profile, Role } from '@/types';

export const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d3e0';
export const ALL_ROLES: Role[] = ['admin', 'cdrrmo_head', 'assessor', 'validator', 'eoc_manager', 'eoc_staff', 'duty_officer', 'lead_office_focal', 'author', 'viewer'];
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'System administrator', cdrrmo_head: 'CDRRMO Head', assessor: 'Assessor', validator: 'Validator',
  eoc_manager: 'EOC Manager', eoc_staff: 'EOC staff', duty_officer: 'Duty officer', lead_office_focal: 'Lead-office focal person',
  author: 'Manual author', viewer: 'Viewer',
};
const DEMO_DEFAULT: Role[] = ['cdrrmo_head', 'eoc_manager', 'assessor', 'validator', 'author'];

interface AuthState {
  ready: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  roles: Role[];
  has: (...r: Role[]) => boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDemoRoles: (roles: Role[]) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadIdentity = useCallback(async (s: Session | null) => {
    if (env.demo) {
      const r = await getMeta<Role[]>('demo:roles', DEMO_DEFAULT);
      setRoles(r);
      setProfile({ id: DEMO_USER_ID, full_name: 'Demo user', position: 'Demonstration', office_id: null, is_active: true });
      return;
    }
    if (!s) { setRoles([]); setProfile(null); return; }
    // Cached copy first, so roles survive offline restarts; then refresh.
    setRoles(await getMeta<Role[]>(`roles:${s.user.id}`, []));
    setProfile((await db.profiles.get(s.user.id)) ?? null);
    try {
      const [{ data: r, error: re }, { data: p }] = await Promise.all([
        supabase!.rpc('my_roles'),
        supabase!.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      ]);
      if (!re && Array.isArray(r)) { setRoles(r as Role[]); await setMeta(`roles:${s.user.id}`, r); }
      if (p) { setProfile(p as Profile); await db.profiles.put(p as Profile); }
    } catch { /* offline: keep cached identity */ }
  }, []);

  useEffect(() => {
    if (env.demo) { void loadIdentity(null).then(() => setReady(true)); return; }
    let alive = true;
    void supabase!.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadIdentity(data.session);
      setReady(true);
    });
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => { setSession(s); void loadIdentity(s); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadIdentity]);

  const value = useMemo<AuthState>(() => ({
    ready,
    userId: env.demo ? DEMO_USER_ID : session?.user.id ?? null,
    email: env.demo ? 'demo@device' : session?.user.email ?? null,
    profile,
    roles,
    has: (...r: Role[]) => roles.includes('admin') || r.some((x) => roles.includes(x)),
    signInWithPassword: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is wrong.' : error.message);
    },
    sendMagicLink: async (email) => {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
      // Sign-up is invite-only, so an address that was never invited gets "Signups not allowed".
      if (error) throw new Error(/signups? not allowed|user not found/i.test(error.message)
        ? 'This email address has not been invited. Ask the system administrator to invite it, then try again.' : error.message);
    },
    signOut: async () => {
      if (env.demo) return;
      const pending = await db.outbox.count();
      if (pending > 0) throw new Error(`${pending} change${pending === 1 ? ' has' : 's have'} not been sent yet. Connect and sync before signing out.`);
      await supabase!.auth.signOut();
      await db.delete();          // leave nothing on a shared device
      window.location.assign('/');
    },
    setDemoRoles: async (r) => { setRoles(r); await setMeta('demo:roles', r); },
  }), [ready, session, profile, roles]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
