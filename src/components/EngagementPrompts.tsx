import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, X, Smartphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
type InstallGuide = { title: string; steps: string[]; action: string };

const INSTALL_DISMISSED = 'mode-install-prompt-dismissed-v1';
const ACCOUNT_DISMISSED = 'mode-account-prompt-dismissed-v1';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function getInstallGuide(): InstallGuide {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isFirefox = /Firefox\//i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isChrome = /Chrome\//i.test(ua) && !isEdge && !isSamsung;
  const isAndroid = /Android/i.test(ua);

  if (isIOS) return {
    title: 'Install on your iPhone or iPad',
    steps: ['Tap the Share button in Safari.', 'Choose “Add to Home Screen”.', 'Tap “Add” to place MODE on your Home Screen.'],
    action: 'Open this page in Safari to install',
  };
  if (isAndroid && (isChrome || isEdge || isSamsung)) return {
    title: 'Install on your Android device',
    steps: ['Tap the browser menu (⋮).', 'Choose “Install app” or “Add to Home screen”.', 'Confirm to add MODE to your device.'],
    action: 'Use your browser menu to install',
  };
  if (isFirefox && isAndroid) return {
    title: 'Add MODE to your Home Screen',
    steps: ['Open the Firefox menu (⋮).', 'Choose “Install” or “Add to Home screen”, if shown.', 'Confirm the shortcut.'],
    action: 'Use the Firefox menu',
  };
  if (isFirefox) return {
    title: 'Use MODE like an app',
    steps: ['Open MODE in Chrome or Microsoft Edge.', 'Select the install icon in the address bar or browser menu.', 'Confirm “Install” to open MODE in its own window.'],
    action: 'Open in Chrome or Edge to install',
  };
  return {
    title: 'Install MODE on this device',
    steps: ['Open your browser menu or address-bar install icon.', 'Choose “Install app” or “Add to Home Screen”.', 'Confirm to keep MODE one tap away.'],
    action: 'Look for Install in your browser menu',
  };
}

export function EngagementPrompts() {
  const { status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [modal, setModal] = useState<'install' | 'account' | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try { return localStorage.getItem(INSTALL_DISMISSED) === '1'; } catch { return false; }
  });
  const [accountDismissed, setAccountDismissed] = useState(() => {
    try { return sessionStorage.getItem(ACCOUNT_DISMISSED) === '1'; } catch { return false; }
  });
  const guide = getInstallGuide();

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent); };
    const installed = () => { setInstallDismissed(true); setModal((current) => current === 'install' ? null : current); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const authRoute = location.pathname === '/login' || location.pathname.startsWith('/auth') || location.pathname.startsWith('/oauth');
  const installed = typeof window !== 'undefined' && isStandalone();

  useEffect(() => {
    if (authRoute || installed || modal || elapsed < 60 || installDismissed) return;
    setModal('install');
  }, [authRoute, elapsed, installed, modal, installDismissed]);

  useEffect(() => {
    if (authRoute || status !== 'signed_out' || modal || elapsed < 120 || accountDismissed) return;
    setModal('account');
  }, [authRoute, status, modal, elapsed, accountDismissed]);

  const closeInstall = () => {
    setInstallDismissed(true);
    try { localStorage.setItem(INSTALL_DISMISSED, '1'); } catch { /* storage may be unavailable */ }
    setModal(null);
  };
  const closeAccount = () => {
    setAccountDismissed(true);
    try { sessionStorage.setItem(ACCOUNT_DISMISSED, '1'); } catch { /* storage may be unavailable */ }
    setModal(null);
  };
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') closeInstall();
  };

  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) modal === 'install' ? closeInstall() : closeAccount(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="mode-engagement-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-white text-slate-900 shadow-2xl">
        <div className="bg-gradient-to-br from-[#0F3D66] via-[#14598A] to-[#0B2946] px-6 pb-7 pt-6 text-white">
          <button type="button" onClick={modal === 'install' ? closeInstall : closeAccount}
            aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white">
            <X size={20} />
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            {modal === 'install' ? <Download size={25} /> : <ShieldCheck size={25} />}
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-sky-200">
            {modal === 'install' ? 'MODE · Ready when you are' : 'MODE · Your operational workspace'}
          </p>
          <h2 id="mode-engagement-title" className="pr-7 text-2xl font-extrabold leading-tight">
            {modal === 'install' ? 'Take MODE with you.' : 'Make your work count.'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-blue-50">
            {modal === 'install'
              ? 'Install MODE for one-tap access to the Manual, tools and EOC workspace—even when connectivity is limited.'
              : 'Sign in or create your account to continue to your workspace, keep your work together and access the tools assigned to your role.'}
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {modal === 'install' ? (
            <>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Smartphone size={18} className="text-[#14598A]" />{guide.title}</div>
              <ol className="space-y-2 text-sm text-slate-600">
                {guide.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-[#14598A]">{index + 1}</span><span className="pt-0.5">{step}</span></li>)}
              </ol>
              {installEvent && <button type="button" onClick={() => void install()}
                className="min-h-12 w-full rounded-xl bg-[#0F3D66] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#14598A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3D66]">
                <Download size={17} className="mr-2 inline" />Install MODE now
              </button>}
              <p className="text-center text-xs text-slate-500">{installEvent ? 'Your browser will ask you to confirm.' : guide.action}</p>
              <button type="button" onClick={closeInstall} className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Maybe later</button>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-blue-50 p-3 text-sm leading-relaxed text-blue-950">
                <strong>Built for Ormoc’s DRRM and EOC teams.</strong> Your account connects you to the workspace. New accounts require administrator approval before City records become available.
              </div>
              <button type="button" onClick={() => { closeAccount(); navigate('/login?mode=signin'); }}
                className="min-h-12 w-full rounded-xl bg-[#0F3D66] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#14598A]">Sign in</button>
              <button type="button" onClick={() => { closeAccount(); navigate('/login?mode=signup'); }}
                className="min-h-12 w-full rounded-xl border border-[#0F3D66] px-4 py-3 text-sm font-bold text-[#0F3D66] transition hover:bg-blue-50">Create an account</button>
              <button type="button" onClick={closeAccount} className="w-full py-1 text-sm font-semibold text-slate-500 hover:text-slate-800">Continue exploring</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
