// Shared pieces for the EOC screens (1.25.0): big tiles, a progress ring, tap-to-choose chips, a quantity stepper and the
// barangay status tile. Colours come from the platform tokens so dark mode keeps working.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Minus, Plus } from 'lucide-react';
import type { BarangayCondition } from '@/types';

export type Cond = BarangayCondition | 'silent';

/** One look per condition. "silent" = no report in this period: outlined, empty. */
export const COND_STYLE: Record<Cond, string> = {
  silent: 'border-dashed border-line bg-surface text-muted',
  normal: 'border-ok/40 bg-ok-soft text-ok',
  monitoring: 'border-sky/40 bg-sky-soft text-sky',
  affected: 'border-warn bg-warn-soft text-warn',
  evacuating: 'border-warn bg-warn text-on-level',
  isolated: 'border-bad bg-bad text-on-level',
};
export const COND_LABEL: Record<Cond, string> = {
  silent: 'No report', normal: 'Normal', monitoring: 'Monitoring', affected: 'Affected', evacuating: 'Evacuating', isolated: 'Isolated',
};
export const COND_ORDER: Cond[] = ['isolated', 'evacuating', 'affected', 'monitoring', 'normal', 'silent'];

export function Legend({ counts }: { counts?: Partial<Record<Cond, number>> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
      {COND_ORDER.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className={clsx('inline-block h-3.5 w-3.5 rounded-sm border', COND_STYLE[c])} />
          {COND_LABEL[c]}{counts?.[c] != null && <span className="font-data text-ink">{counts[c]}</span>}
        </li>
      ))}
    </ul>
  );
}

export function BarangayTile({ name, cond, sub, onClick, to }: { name: string; cond: Cond; sub?: string; onClick?: () => void; to?: string }) {
  const cls = clsx('flex h-14 min-w-0 flex-col justify-center rounded-control border px-2 text-left leading-tight transition-shadow hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus', COND_STYLE[cond]);
  const body = (
    <>
      <span className="truncate text-[11px] font-extrabold">{name}</span>
      <span className="truncate text-[10px] font-semibold opacity-90">{sub ?? COND_LABEL[cond]}</span>
    </>
  );
  const label = `${name}: ${COND_LABEL[cond]}${sub ? `, ${sub}` : ''}`;
  return to
    ? <Link to={to} className={cls} aria-label={label}>{body}</Link>
    : <button type="button" onClick={onClick} className={cls} aria-label={label}>{body}</button>;
}

export function Tile({ label, value, hint, tone, to, children }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'bad' | 'warn' | 'ok'; to?: string; children?: ReactNode }) {
  const body = (
    <>
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className={clsx('mt-2 font-display text-4xl font-extrabold leading-none', tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      {children}
    </>
  );
  const cls = 'block rounded-sheet border border-line bg-surface p-4 shadow-raised';
  return to ? <Link to={to} className={clsx(cls, 'hover:border-sky')}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Ring({ value, max, size = 88, tone = 'ok', children }: { value: number; max: number; size?: number; tone?: 'ok' | 'warn' | 'bad'; children?: ReactNode }) {
  const r = (size - 12) / 2; const c = 2 * Math.PI * r; const f = max > 0 ? Math.min(1, value / max) : 0;
  const stroke = { ok: 'stroke-ok', warn: 'stroke-warn', bad: 'stroke-bad' }[tone];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${value} of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} className="stroke-sunken" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} strokeLinecap="round" className={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
      </svg>
      <span className="absolute font-display text-xl font-extrabold text-ink">{children}</span>
    </div>
  );
}

export function Chips<T extends string | number>({ value, onChange, options, label, disabled }: {
  value: T | null; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[]; label?: string; disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.value)} type="button" disabled={disabled} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('min-h-tap rounded-full border px-4 text-sm font-bold transition-colors disabled:opacity-50',
            value === o.value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-sky')}>
          {o.label}{o.hint && <span className="ml-1 text-xs font-semibold opacity-70">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, jumps = [1, 5, 10], label }: { value: number; onChange: (n: number) => void; min?: number; jumps?: number[]; label: string }) {
  const set = (n: number) => onChange(Math.max(min, Math.round(n)));
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label}`} onClick={() => set(value - 1)} className="grid h-11 w-11 place-items-center rounded-control border border-line bg-surface hover:border-sky"><Minus size={16} /></button>
      <input aria-label={label} inputMode="numeric" value={value} onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className="h-11 w-24 rounded-control border border-line bg-surface text-center font-data text-lg font-extrabold" />
      <button type="button" aria-label={`More ${label}`} onClick={() => set(value + 1)} className="grid h-11 w-11 place-items-center rounded-control border border-line bg-surface hover:border-sky"><Plus size={16} /></button>
      {jumps.filter((j) => j > 1).map((j) => (
        <button key={j} type="button" onClick={() => set(value + j)} className="h-11 rounded-control border border-line bg-sunken px-3 text-sm font-bold hover:border-sky">+{j}</button>
      ))}
    </div>
  );
}

export function Block({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-sheet border border-line bg-surface p-4 shadow-raised', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
