import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { TooltipLayer } from '@/components/Tooltip';
import { Loading } from '@/components/ui';
import { bootstrapReference, requestPersistentStorage } from '@/lib/bootstrap';
import { startSync } from '@/lib/sync';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthCallbackPage, SetPasswordPage } from '@/features/auth/AuthCallbackPage';
import { DeactivatedPage, PendingApprovalPage } from '@/features/auth/AccountGatePages';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { TodayPage } from '@/features/home/TodayPage';
import { OAuthConsentPage } from '@/features/auth/OAuthConsentPage';
import { CONSENT_PATH } from '@/lib/oauth';
import { AccessibilityTools } from '@/components/AccessibilityTools';
import { PUBLIC_PATHS, setPageMeta } from '@/lib/site';
import { AboutPage, FAQPage, PolicyPage, PublicHome, PublicNotFound, SupportPage } from '@/features/public/PublicPages';

// Modules load on demand to keep the first paint small on low-end phones.
const AssessRoutes = lazy(() => import('@/features/iat/routes'));
const DrrmRoutes = lazy(() => import('@/features/protocols/routes'));
const EocRoutes = lazy(() => import('@/features/eoc/routes'));
const LibraryRoutes = lazy(() => import('@/features/library/routes'));
const SettingsRoutes = lazy(() => import('@/features/settings/routes'));
const VaultRoutes = lazy(() => import('@/features/vault/routes'));
const ToolsRoutes = lazy(() => import('@/features/tools/routes'));


/** /protocols and /protocols/run/:id (before 1.9) open the same place in the DRRM module. */
function OldProtocolsLink() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/protocols\/?/, '');
  return <Navigate to={rest.startsWith('run/') ? `/drrm/${rest}` : '/drrm/protocols'} replace />;
}

/** Workspace and sign-in screens are never indexed; public pages set their own meta (PublicPages Frame). */
function WorkspaceMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!(PUBLIC_PATHS as readonly string[]).includes(pathname)) setPageMeta({ title: 'Workspace', index: false });
  }, [pathname]);
  return null;
}

/** Signed in AND approved: an account without a role sees only the waiting page, never City data. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, status } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (status === 'pending') return <PendingApprovalPage />;
  if (status === 'deactivated') return <DeactivatedPage />;
  return <>{children}</>;
}

function Boot({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void requestPersistentStorage();
    bootstrapReference().then(() => setOk(true)).catch((e: Error) => setErr(e.message));
  }, []);
  const { userId, status } = useAuth();
  // Sync (and its realtime connection) runs only for an approved account, and restarts per account.
  useEffect(() => (ok && userId && status === 'active' ? startSync() : undefined), [ok, userId, status]);
  if (err) return <div className="page"><p role="alert" className="font-semibold text-bad">The app could not open its local storage: {err}. Check that the browser allows site data.</p></div>;
  if (!ok) return <Loading />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <UpdatePrompt />
      <ToastProvider>
        <AuthProvider>
          <WorkspaceMeta />
          <Routes>
            {/* 1.10: public, indexable pages. They open without the workspace (no reference load, no sync). */}
            <Route path="/" element={<PublicHome />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/policies" element={<Navigate to="/policies/privacy" replace />} />
            <Route path="/policies/:slug" element={<PolicyPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/confirm" element={<AuthCallbackPage />} />
            <Route path="/auth/reset" element={<SetPasswordPage />} />
            {/* Supabase Auth sends other apps' sign-in requests here (OAuth 2.1 server). */}
            <Route path={CONSENT_PATH} element={<OAuthConsentPage />} />
            {/* 1.10: the signed-in workspace starts at /today (was /). */}
            <Route element={<Boot><RequireAuth><AppShell /></RequireAuth></Boot>}>
              <Route path="today" element={<TodayPage />} />
              <Route path="assess/*" element={<Suspense fallback={<Loading />}><AssessRoutes /></Suspense>} />
              <Route path="drrm/*" element={<Suspense fallback={<Loading />}><DrrmRoutes /></Suspense>} />
              {/* 1.9: Protocols moved into the DRRM module; old links and bookmarks still work. */}
              <Route path="protocols/*" element={<OldProtocolsLink />} />
              <Route path="eoc/*" element={<Suspense fallback={<Loading />}><EocRoutes /></Suspense>} />
              <Route path="library/*" element={<Suspense fallback={<Loading />}><LibraryRoutes /></Suspense>} />
              <Route path="settings/*" element={<Suspense fallback={<Loading />}><SettingsRoutes /></Suspense>} />
              <Route path="vault/*" element={<Suspense fallback={<Loading />}><VaultRoutes /></Suspense>} />
              <Route path="tools/*" element={<Suspense fallback={<Loading />}><ToolsRoutes /></Suspense>} />
            </Route>
            <Route path="*" element={<PublicNotFound />} />
          </Routes>
          <AccessibilityTools />
        </AuthProvider>
      </ToastProvider>
      <TooltipLayer />
    </BrowserRouter>
  );
}
