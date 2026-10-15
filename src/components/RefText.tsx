// Renders a reference field ("RA 10121 Sec. 21; JMC 2013-1") with each recognized law,
// issuance or framework as a tappable term. Tapping opens a short plain-language note,
// with a link to the Document Vault for the documents themselves.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { explain, parseCitations, type Citation } from '@/data/references';
import { canUseVault } from '@/features/vault/access';
import { tip } from './Tooltip';

export function RefText({ text, context = 'indicator', className }: { text: string | null | undefined; context?: 'indicator' | 'aa'; className?: string }) {
  const cites = parseCitations(text, context);
  if (!cites.length) return <span className={className}>{text ?? '—'}</span>;
  return (
    <span className={className}>
      {cites.map((c, i) => (
        <span key={`${c.text}-${i}`}>
          {i > 0 && '; '}
          {c.key ? <RefTerm c={c} /> : c.text}
        </span>
      ))}
    </span>
  );
}

function RefTerm({ c }: { c: Citation }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  return (
    <>
      <button ref={btn} type="button" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}
        {...tip('Tap to see what this reference is')}
        className="rounded-sm text-left font-semibold text-ink underline decoration-accent decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid">
        {c.text}
      </button>
      {open && <RefPopover id={id} c={c} anchor={btn} onClose={() => { setOpen(false); btn.current?.focus(); }} />}
    </>
  );
}

function RefPopover({ id, c, anchor, onClose }: { id: string; c: Citation; anchor: React.RefObject<HTMLButtonElement>; onClose: () => void }) {
  const crosswalk = useLiveQuery(() => db.framework_crosswalk.toArray(), [], []);
  const { has } = useAuth();
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const e = explain(c, crosswalk);

  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect(); const p = panel.current;
    if (!r || !p) return;
    const w = p.offsetWidth, h = p.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const below = r.bottom + 8 + h < vh - 8 || r.top - 8 - h < 8;
    setPos({ top: below ? r.bottom + 8 : r.top - 8 - h, left: Math.min(Math.max(8, r.left), vw - w - 8) });
  }, [anchor, crosswalk.length]);

  useEffect(() => {
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    const down = (ev: PointerEvent) => {
      if (!panel.current?.contains(ev.target as Node) && !anchor.current?.contains(ev.target as Node)) onClose();
    };
    const away = () => onClose();
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    window.addEventListener('resize', away);
    panel.current?.focus();
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); window.removeEventListener('resize', away); };
  }, [anchor, onClose]);

  return (
    <div ref={panel} id={id} role="dialog" aria-label={e.title} tabIndex={-1}
      className="fixed z-[55] w-[min(24rem,calc(100vw-1rem))] rounded-control border border-line border-l-4 border-l-accent-bright bg-surface p-4 text-left text-sm leading-6 text-ink shadow-raised outline-none"
      style={{ top: pos.top, left: pos.left }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display font-bold leading-5">{e.title}</p>
        <button type="button" onClick={onClose} {...tip('Close this note (Esc)')} aria-label="Close"
          className="-mr-2 -mt-2 inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-control hover:bg-sky-soft"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {c.text !== c.key && <p className="mt-1 font-data text-muted">Cited as: {c.text}</p>}
      {e.summary && <p className="mt-2">{e.summary}</p>}
      {e.details.map((d) => <p key={d} className="mt-2">{d}</p>)}
      <p className="mt-3 text-xs text-muted">A plain-language note for orientation. The official text governs.</p>
      {canUseVault(has) && (
        <Link to={`/vault?ref=${encodeURIComponent(c.key!)}`} onClick={onClose} {...tip('Open the Document Vault filtered to this reference')}
          className="mt-2 inline-flex min-h-tap items-center font-semibold underline underline-offset-2">Find it in the Document Vault</Link>
      )}
    </div>
  );
}
