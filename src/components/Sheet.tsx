// Bottom sheet on phones, centred dialog on larger screens. Uses <dialog> for
// native focus trapping, Esc handling and an inert background.
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}
      aria-labelledby="sheet-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-sheet bg-surface p-0 text-ink shadow-sheet backdrop:bg-scrim/40 sm:m-auto sm:max-w-lg sm:rounded-sheet">
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="sheet-title" className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="inline-flex h-tap w-tap items-center justify-center rounded-control hover:bg-sunken" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
