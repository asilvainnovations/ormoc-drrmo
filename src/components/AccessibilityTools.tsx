// Accessibility preferences (1.10.0): text size, contrast, a plainer font and reduced motion. Stored on this
// device only (key below; listed in the Cookies and Device Storage policy). Styles: styles/public-accessibility.css.
import { useEffect, useState } from 'react';
import { Accessibility, Contrast, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { tip } from '@/components/Tooltip';

type Preferences = { textScale: number; highContrast: boolean; dyslexiaFont: boolean; reducedMotion: boolean };
const DEFAULTS: Preferences = { textScale: 100, highContrast: false, dyslexiaFont: false, reducedMotion: false };
export const A11Y_KEY = 'mode-accessibility-preferences';
const MIN = 90, MAX = 130, STEP = 5;

function read(): Preferences {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(A11Y_KEY) ?? '{}') }; } catch { return DEFAULTS; }
}

export function AccessibilityTools() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(read);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--a11y-scale', String(prefs.textScale / 100));
    r.dataset.highContrast = String(prefs.highContrast);
    r.dataset.dyslexiaFont = String(prefs.dyslexiaFont);
    r.dataset.reduceMotion = String(prefs.reducedMotion);
    try { localStorage.setItem(A11Y_KEY, JSON.stringify(prefs)); } catch { /* storage blocked: preferences last for this visit */ }
  }, [prefs]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const update = (v: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...v }));
  const check = 'flex min-h-tap items-center gap-3';

  return (
    <>
      <button type="button" aria-expanded={open} aria-controls="a11y-panel" onClick={() => setOpen((v) => !v)}
        {...tip('Change text size, contrast, font and animation on this device')}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-50 inline-flex min-h-tap items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold text-ink shadow-raised print:hidden lg:bottom-5">
        <Accessibility aria-hidden className="h-5 w-5" /> <span className="sr-only sm:not-sr-only">Accessibility</span>
      </button>
      {open && (
        <section id="a11y-panel" role="dialog" aria-modal="false" aria-labelledby="a11y-title"
          className="fixed inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 max-w-sm rounded-sheet border border-line bg-surface p-4 shadow-raised sm:left-auto sm:right-4 lg:bottom-20">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="a11y-title" className="text-lg font-bold">Accessibility</h2>
            <button type="button" onClick={() => setOpen(false)} {...tip('Close this panel')} aria-label="Close accessibility settings" className="a11y-control"><X aria-hidden /></button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-2 font-semibold" aria-live="polite">Text size: {prefs.textScale}%</p>
              <div className="flex gap-2">
                <button type="button" className="a11y-control" aria-label="Smaller text" disabled={prefs.textScale <= MIN}
                  {...tip(prefs.textScale <= MIN ? 'Text is already at the smallest size' : 'Make text smaller')}
                  onClick={() => update({ textScale: Math.max(MIN, prefs.textScale - STEP) })}><Minus aria-hidden /></button>
                <button type="button" className="a11y-control" aria-label="Larger text" disabled={prefs.textScale >= MAX}
                  {...tip(prefs.textScale >= MAX ? 'Text is already at the largest size' : 'Make text larger')}
                  onClick={() => update({ textScale: Math.min(MAX, prefs.textScale + STEP) })}><Plus aria-hidden /></button>
              </div>
            </div>
            <label className={check} {...tip('Strengthen the contrast of text and lines')}>
              <input type="checkbox" checked={prefs.highContrast} onChange={(e) => update({ highContrast: e.target.checked })} /><Contrast aria-hidden className="h-4 w-4" /> Higher contrast
            </label>
            <label className={check} {...tip('Use a plainer font with wider spacing')}>
              <input type="checkbox" checked={prefs.dyslexiaFont} onChange={(e) => update({ dyslexiaFont: e.target.checked })} /> Plainer font
            </label>
            <label className={check} {...tip('Turn off movement and transitions')}>
              <input type="checkbox" checked={prefs.reducedMotion} onChange={(e) => update({ reducedMotion: e.target.checked })} /> Reduce motion
            </label>
            <button type="button" onClick={() => setPrefs(DEFAULTS)} {...tip('Go back to the standard settings')}
              className="inline-flex min-h-tap items-center gap-2 rounded-control border border-line px-3 font-semibold"><RotateCcw aria-hidden className="h-4 w-4" /> Reset</button>
            <p className="text-xs text-muted">Saved on this device only. These settings change how MODE looks; they do not replace a screen reader or other assistive technology.</p>
          </div>
        </section>
      )}
    </>
  );
}
