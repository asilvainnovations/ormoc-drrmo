import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';

type ToastTone = 'ok' | 'bad' | 'info';
interface Toast { id: number; text: string; tone: ToastTone }
const Ctx = createContext<(text: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t.slice(-2), { id, text, tone }]);   // at most three on screen
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 8000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'bad' ? 'alert' : 'status'}
            className={clsx('pointer-events-auto max-w-md rounded-control px-4 py-3 text-sm font-semibold shadow-raised',
              t.tone === 'bad' ? 'bg-bad text-on-strong' : t.tone === 'info' ? 'bg-info text-on-strong' : 'bg-ink text-paper')}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
