// One tooltip layer for the whole app. Any element with a `data-tip` attribute gets a
// tooltip: after a short hover with a mouse, at once on keyboard focus, or on a long
// press on touch screens (the press then does not also trigger the element).
//
// WCAG 1.4.13: the tip can be dismissed (Escape), stays while the pointer moves onto it,
// and stays until the pointer or focus leaves. Screen readers get the same text as an
// accessible description of the focused element.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HOVER_DELAY = 450;
const LONG_PRESS = 500;
const HIDE_GRACE = 150;
export const TIP_ID = 'app-tooltip';

/** Spread onto any element: `<a {...tip('Open the logbook')}>`. */
export const tip = (text: string | undefined | null) => (text ? { 'data-tip': text } : {});

interface Shown { text: string; rect: DOMRect; el: Element }

function place(rect: DOMRect, bubble: HTMLElement | null) {
  const w = bubble?.offsetWidth ?? 240, h = bubble?.offsetHeight ?? 40, gap = 8, vw = window.innerWidth;
  const above = rect.top - h - gap > 8;
  const top = above ? rect.top - h - gap : rect.bottom + gap;
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
  return { top, left };
}

export function TooltipLayer() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const bubble = useRef<HTMLDivElement>(null);
  const timers = useRef<{ show?: number; hide?: number; press?: number }>({});
  const suppressClick = useRef(false);

  useEffect(() => {
    const clear = (k: 'show' | 'hide' | 'press') => { window.clearTimeout(timers.current[k]); timers.current[k] = undefined; };
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest('[data-tip]') : null);
    const open = (el: Element) => {
      clear('hide');
      const text = el.getAttribute('data-tip');
      if (text) setShown({ text, rect: el.getBoundingClientRect(), el });
    };
    const close = (now = false) => {
      clear('show');
      if (now) { setShown(null); return; }
      clear('hide'); timers.current.hide = window.setTimeout(() => setShown(null), HIDE_GRACE);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (bubble.current?.contains(e.target as Node)) { clear('hide'); return; }   // hovering the tip itself
      const el = target(e);
      if (!el) { close(); return; }
      clear('show'); timers.current.show = window.setTimeout(() => open(el), HOVER_DELAY);
    };
    const focusIn = (e: FocusEvent) => {
      const el = target(e);
      if (el && (e.target as Element).matches?.(':focus-visible')) open(el); else close(true);
    };
    const focusOut = () => close(true);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') { close(true); return; }
      const el = target(e);
      clear('press');
      if (el) timers.current.press = window.setTimeout(() => { suppressClick.current = true; open(el); navigator.vibrate?.(10); }, LONG_PRESS);
    };
    const up = () => clear('press');
    const click = (e: MouseEvent) => {
      if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; return; }
      close(true);
    };
    const menu = (e: Event) => { if (target(e)) e.preventDefault(); };   // long press shows the tip, not the browser menu
    const moved = () => close(true);

    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('click', click, true);
    document.addEventListener('contextmenu', menu);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('click', click, true);
      document.removeEventListener('contextmenu', menu);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', moved);
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Describe the focused element by the tip while it is shown.
  useEffect(() => {
    if (!shown) return;
    const el = shown.el;
    const prev = el.getAttribute('aria-describedby');
    if (!prev?.split(' ').includes(TIP_ID)) el.setAttribute('aria-describedby', [prev, TIP_ID].filter(Boolean).join(' '));
    return () => {
      if (prev === null) el.removeAttribute('aria-describedby'); else el.setAttribute('aria-describedby', prev);
    };
  }, [shown]);

  useEffect(() => { if (shown) setPos(place(shown.rect, bubble.current)); }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div ref={bubble} id={TIP_ID} role="tooltip" className="tip-bubble" style={{ top: pos.top, left: pos.left, pointerEvents: 'auto' }}
      onPointerLeave={() => setShown(null)}>
      {shown.text}
    </div>,
    document.body,
  );
}
