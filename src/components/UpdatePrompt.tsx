import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Ask before reloading for a new version, so nobody loses a half-filled form. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } =
    useRegisterSW({
      immediate: true,
      // An EOC screen can stay open for days without a page load: look for a new version hourly.
      onRegisteredSW(_url, reg) { if (reg) setInterval(() => { if (navigator.onLine) void reg.update(); }, 60 * 60 * 1000); },
    });
  // "Works offline" is news once: it disappears by itself so it never covers a form.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, needRefresh, setOfflineReady]);
  if (!needRefresh && !offlineReady) return null;
  return (
    // Floats above the phone tab bar and beside the desktop menu, on every screen including sign-in.
    <div role="status" className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 rounded-sheet border border-line bg-info-soft shadow-raised lg:inset-x-auto lg:bottom-4 lg:right-4 lg:max-w-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-ink">
          {needRefresh ? 'A new version is ready. Finish what you are typing, then reload.' : 'The app is saved on this device and works offline.'}
        </p>
        <div className="flex gap-2">
          {needRefresh && <Button tip="Load the new version now. Finish any entry you are typing first" onClick={() => updateServiceWorker(true)}>Reload</Button>}
          <Button tip="Keep using this version. The update installs next time you open the app" variant="quiet" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}
