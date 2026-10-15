import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Ask before reloading for a new version, so nobody loses a half-filled form. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } =
    useRegisterSW({ immediate: true });
  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="border-b border-line bg-info-soft">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-2 lg:px-8">
        <p className="text-sm font-semibold text-ink">
          {needRefresh ? 'A new version is ready. Finish what you are typing, then reload.' : 'The app is saved on this device and works offline.'}
        </p>
        <div className="flex gap-2">
          {needRefresh && <Button onClick={() => updateServiceWorker(true)}>Reload</Button>}
          <Button variant="quiet" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}
