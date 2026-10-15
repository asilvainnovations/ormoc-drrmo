import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { TooltipLayer } from '@/components/Tooltip';
import { Loading, PageHeader } from '@/components/ui';
import { bootstrapReference, requestPersistentStorage } from '@/lib/bootstrap';
import { startSync } from '@/lib/sync';
import { env } from '@/lib/env';
import { LoginPage } from '@/features/auth/LoginPage';
import { TodayPage } from '@/features/home/TodayPage';

// Modules load on demand to keep the first paint small on low-end phones.
const AssessRoutes = lazy(() => import('@/features/iat/routes'));
const ProtocolRoutes = lazy(() => import('@/features/protocols/routes'));
const EocRoutes = lazy(() => import('@/features/eoc/routes'));
const LibraryRoutes = lazy(() => import('@/features/library/routes'));
const SettingsRoutes = lazy(() => import('@/features/settings/routes'));
const VaultRoutes = lazy(() => import('@/features/vault/routes'));


function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, userId } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!env.demo && !userId) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function Boot({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void requestPersistentStorage();
    bootstrapReference().then(() => setOk(true)).catch((e: Error) => setErr(e.message));
  }, []);
  const { userId } = useAuth();
  // Sync (and its realtime connection) runs only for a signed-in user, and restarts per user.
  useEffect(() => (ok && userId ? startSync() : undefined), [ok, userId]);
  if (err) return <div className="page"><p role="alert" className="font-semibold text-bad">The app could not open its local storage: {err}. Check that the browser allows site data.</p></div>;
  if (!ok) return <Loading />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Boot>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<TodayPage />} />
                <Route path="assess/*" element={<Suspense fallback={<Loading />}><AssessRoutes /></Suspense>} />
                <Route path="protocols/*" element={<Suspense fallback={<Loading />}><ProtocolRoutes /></Suspense>} />
                <Route path="eoc/*" element={<Suspense fallback={<Loading />}><EocRoutes /></Suspense>} />
                <Route path="library/*" element={<Suspense fallback={<Loading />}><LibraryRoutes /></Suspense>} />
                <Route path="settings/*" element={<Suspense fallback={<Loading />}><SettingsRoutes /></Suspense>} />
                <Route path="vault/*" element={<Suspense fallback={<Loading />}><VaultRoutes /></Suspense>} />
                <Route path="*" element={<div className="page"><PageHeader title="Page not found" subtitle="Use the menu to go to a section." /></div>} />
              </Route>
            </Routes>
          </Boot>
        </AuthProvider>
      </ToastProvider>
      <TooltipLayer />
    </BrowserRouter>
  );
}
