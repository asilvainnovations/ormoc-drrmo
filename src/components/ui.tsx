// Primitive components. One source for spacing, radius, type and states so every
// screen reads the same (see docs/design-system.md).
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tip as tipAttr } from './Tooltip';

// ------------------------------------------------------------------ buttons
type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-action text-on-action shadow-sm hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line hover:border-sky hover:bg-sky-soft',
  quiet: 'text-ink hover:bg-sky-soft',
  danger: 'bg-bad text-on-strong hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; icon?: LucideIcon; busy?: boolean; full?: boolean; size?: 'md' | 'lg';
  /** Tooltip: what the button does or is for. Required so no control goes unexplained. */
  tip: string;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', icon: Icon, busy, full, size = 'md', className, children, disabled, type = 'button', tip, ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || busy} {...tipAttr(tip)}
      className={clsx('inline-flex min-h-tap items-center justify-center gap-2 rounded-control px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'min-h-[3.25rem] text-lg' : 'text-base', VARIANT[variant], full && 'w-full', className)} {...rest}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : Icon ? <Icon className="h-5 w-5" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ to, variant = 'secondary', icon: Icon, children, className, tip }: { to: string; variant?: Variant; icon?: LucideIcon; children: ReactNode; className?: string; tip: string }) {
  return (
    <Link to={to} {...tipAttr(tip)} className={clsx('inline-flex min-h-tap items-center justify-center gap-2 rounded-control px-4 font-semibold', VARIANT[variant], className)}>
      {Icon && <Icon className="h-5 w-5" aria-hidden />}{children}
    </Link>
  );
}

// ------------------------------------------------------------------ form fields
interface FieldProps { label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy: string | undefined) => ReactNode; optional?: boolean;
  /** Tooltip for the field. Defaults to the hint, or to the label. A control's own tip wins. */
  tip?: string }
export function Field({ label, hint, error, children, optional, tip }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const fallback = tip ?? (typeof hint === 'string' ? hint : `${label}${optional ? ' (optional)' : ''}`);
  return (
    <div className="space-y-1.5" {...tipAttr(fallback)}>
      <label htmlFor={id} className="block font-semibold">
        {label}{optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {hint && <p id={hintId} className="text-sm text-muted">{hint}</p>}
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
      {error && <p id={errId} role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
const control = 'w-full rounded-control border border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/30 disabled:bg-sunken';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx(control, 'min-h-tap', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx(control, 'py-2.5 leading-6', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={clsx(control, 'min-h-tap pr-8', className)} {...p} />;
});

/** Large radio choices — used for scores, conditions and decisions. */
export function ChoiceGroup<V extends string | number>({ legend, value, onChange, options, columns = 1, hint }: {
  legend: string; value: V | null; onChange: (v: V) => void; hint?: ReactNode; columns?: 1 | 2 | 3 | 5;
  options: { value: V; label: string; detail?: string; disabled?: boolean; disabledReason?: string; tip?: string }[];
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={clsx('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', columns === 5 && 'grid-cols-5')}>
        {options.map((o) => (
          <label key={String(o.value)} {...tipAttr(o.disabled ? o.disabledReason : o.tip ?? (o.detail ? `${o.label}: ${o.detail}` : `Choose ${o.label}`))}
            className={clsx('flex min-h-tap cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5',
              value === o.value ? 'border-action bg-sky-soft ring-1 ring-action' : 'border-line bg-surface hover:border-sky',
              o.disabled && 'cursor-not-allowed opacity-50')}>
            <input type="radio" name={name} className="mt-1 h-4 w-4 accent-[rgb(var(--action))]" checked={value === o.value}
              disabled={o.disabled} onChange={() => onChange(o.value)} />
            <span>
              <span className="block font-semibold">{o.label}</span>
              {o.detail && <span className="block text-sm text-muted">{o.detail}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------------ layout
export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 space-y-2">
      {back && (
        <Link to={back} {...tipAttr('Go back to the previous screen')} className="-ml-1 inline-flex min-h-tap items-center gap-1 rounded-control pr-2 text-sm font-semibold text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold lg:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className, id }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={clsx('mb-8', className)} aria-labelledby={title && id ? id : undefined}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-line pb-2">
          {title && <h2 id={id} className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A divided list. Rows are links or buttons with a 44px minimum height. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={clsx('divide-y divide-line', className)}>{children}</ul>;
}
/** Clickable rows need a `tip` saying what opening the row does (checked by e2e/tooltips.spec.ts). */
export function ListRow({ to, onClick, title, meta, leading, trailing, tone, tip }: {
  to?: string; onClick?: () => void; title: ReactNode; meta?: ReactNode; leading?: ReactNode; trailing?: ReactNode; tone?: 'bad' | 'warn'; tip?: string;
}) {
  if (import.meta.env.DEV && (to || onClick) && !tip) console.warn('ListRow without a tip:', title);
  const inner = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className={clsx('block font-semibold', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{title}</span>
        {meta && <span className="mt-0.5 block text-sm text-muted">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm">{trailing}</span>}
      {(to || onClick) && <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls = 'flex min-h-[3.25rem] w-full items-center gap-3 py-3 text-left';
  return (
    <li>
      {to ? <Link to={to} {...tipAttr(tip)} className={clsx(cls, 'hover:bg-sky-soft/70 -mx-2 px-2 rounded-control')}>{inner}</Link>
        : onClick ? <button type="button" onClick={onClick} {...tipAttr(tip)} className={clsx(cls, 'hover:bg-sky-soft/70 -mx-2 px-2 rounded-control')}>{inner}</button>
          : <div className={cls}>{inner}</div>}
    </li>
  );
}

// ------------------------------------------------------------------ status
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';
const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-data text-[0.8125rem] font-semibold leading-5 tracking-wide', TONE[tone], className)}>{children}</span>;
}

export function Notice({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={clsx('mb-4 rounded-control border-l-4 px-4 py-3', TONE[tone],
      tone === 'bad' ? 'border-bad' : tone === 'warn' ? 'border-warn' : tone === 'ok' ? 'border-ok' : tone === 'info' ? 'border-info' : 'border-line')}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className="text-sm leading-6 text-ink">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-control border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-prose text-sm text-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Meter({ value, max = 1, label, tone = 'action' }: { value: number; max?: number; label: string; tone?: 'action' | 'ok' | 'warn' | 'bad' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-sunken">
      <div className={clsx('h-full rounded-full', tone === 'action' ? 'bg-sky' : tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-bad')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Section tabs (sub-navigation inside a module). */
export function Tabs({ items }: { items: { to: string; label: string; end?: boolean; tip: string }[] }) {
  return (
    <nav aria-label="Section" className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1">
        {items.map((t) => (
          <li key={t.to}>
            <NavLink to={t.to} end={t.end} {...tipAttr(t.tip)}
              className={({ isActive }) => clsx('inline-flex min-h-tap items-center whitespace-nowrap border-b-[3px] px-3 font-semibold',
                isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:border-sky hover:text-ink')}>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="font-semibold">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ shared states & links
export function Loading() {
  return <div className="page" aria-busy="true"><p className="text-muted">Loading…</p></div>;
}

/** Inline text link. `size="sm"` for section actions; always underlined so it reads as a link without hover. */
export function TextLink({ to, children, size = 'base', block, tip }: { to: string; children: ReactNode; size?: 'sm' | 'base'; block?: boolean; tip: string }) {
  return <Link to={to} {...tipAttr(tip)} className={clsx('font-semibold underline underline-offset-2 hover:text-muted', size === 'sm' && 'text-sm', block && 'block')}>{children}</Link>;
}

/** Bordered checkbox chip with a 44px target; pairs with ChoiceGroup radios. */
export function Checkbox({ checked, onChange, children, className, tip }: { checked: boolean; onChange: () => void; children: ReactNode; className?: string; tip: string }) {
  return (
    <label {...tipAttr(tip)} className={clsx('inline-flex min-h-tap cursor-pointer items-center gap-3 rounded-control border px-3',
      checked ? 'border-action bg-sky-soft' : 'border-line bg-surface hover:border-sky', className)}>
      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--action))]" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}
