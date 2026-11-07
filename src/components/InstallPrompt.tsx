// "Install MODE" reminder (1.10.0), shown on public pages only, in the page flow (above the footer) so it never covers content or the Accessibility button. Uses the browser's own install prompt where it
// exists, otherwise short instructions. A dismissal is remembered on this device for 30 days.
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { tip } from '@/components/Tooltip';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
export const INSTALL_DISMISS_KEY = 'mode-install-dismissed-at';
const DISMISS_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(INSTALL_DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch { return false; }
}
function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(() => isStandalone() || dismissedRecently());
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => { setHidden(true); setEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (hidden) return null;
  const dismiss = () => { try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch { /* blocked */ } setHidden(true); };

  return (
    <aside aria-label="Install MODE" className="mx-auto mb-6 max-w-page rounded-sheet border border-line bg-surface p-3 pr-2 print:hidden">
      <div className="flex items-start gap-3">
        <Download className="mt-1 h-5 w-5 shrink-0 text-action" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Install MODE on this device</p>
          <p className="text-sm text-muted">Open it from your home screen and keep working when the signal drops.</p>
          {event ? (
            <button type="button" {...tip('Add MODE to this device as an app')}
              className="mt-2 inline-flex min-h-tap items-center rounded-control bg-action px-4 font-semibold text-on-action"
              onClick={async () => { await event.prompt(); const c = await event.userChoice; if (c.outcome === 'accepted') setHidden(true); else setEvent(null); }}>Install app</button>
          ) : (
            <button type="button" aria-expanded={help} onClick={() => setHelp((s) => !s)} {...tip('Show how to install MODE on this device')}
              className="mt-1 min-h-tap font-semibold text-action underline underline-offset-2">How to install</button>
          )}
          {help && (
            <ul className="mt-1 space-y-1 text-sm">
              <li><strong>Android, Chrome or Edge:</strong> browser menu, then Install app or Add to Home screen.</li>
              <li><strong>iPhone or iPad:</strong> in Safari, tap Share, then Add to Home Screen.</li>
              <li><strong>Computer:</strong> the install icon in the address bar, where the browser offers one.</li>
            </ul>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Hide the install reminder" {...tip('Hide this reminder for 30 days')} className="a11y-control border-0"><X aria-hidden /></button>
      </div>
    </aside>
  );
}
