// Validation workspace look (1.24.0), modelled on public/validation.html: eyebrow + title header, a tab strip with
// counts, big-number metric cards, bar rows by priority/status, and pills. Built on the platform's colour tokens so
// dark mode keeps working.
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { db } from '@/lib/db';

export type PillTone = 'red' | 'orange' | 'green' | 'blue' | 'grey';
const PILL: Record<PillTone, string> = {
  red: 'bg-bad-soft text-bad', orange: 'bg-warn-soft text-warn', green: 'bg-ok-soft text-ok', blue: 'bg-sky-soft text-sky', grey: 'bg-sunken text-muted',
};
export function Pill({ tone = 'grey', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold', PILL[tone])}>{children}</span>;
}

export function Panel({ title, note, children, className }: { title?: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-sheet border border-line bg-surface p-5 shadow-raised', className)}>
      {title && <h2 className="mb-1 text-xl font-extrabold tracking-tight text-ink">{title}</h2>}
      {note && <p className="mb-3 text-xs text-muted">{note}</p>}
      {!note && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'bad' | 'warn' | 'ok' }) {
  return (
    <div className="min-h-[7.5rem] rounded-sheet border border-line bg-surface p-5 shadow-raised">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className={clsx('mt-3 font-display text-4xl font-extrabold leading-tight', tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function BarRow({ label, value, max, tone = 'grey', display, labelWidth = '8rem', valueWidth = '2rem' }: { label: string; value: number; max: number; tone?: 'red' | 'orange' | 'green' | 'grey'; display?: string; labelWidth?: string; valueWidth?: string }) {
  const fill = { red: 'bg-bad', orange: 'bg-warn', green: 'bg-ok', grey: 'bg-muted/50' }[tone];
  return (
    <div className="my-3 grid items-center gap-3 text-xs font-bold text-ink" style={{ gridTemplateColumns: `${labelWidth} 1fr ${valueWidth}` }}>
      <span>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${label}: ${value} of ${max}`}>
        <div className={clsx('h-full rounded-full', fill)} style={{ width: `${max ? (100 * value) / max : 0}%` }} />
      </div>
      <span className="text-right font-data">{display ?? value}</span>
    </div>
  );
}

export function WorkspaceHead({ eyebrow, title, subtitle, aside }: { eyebrow: string; title: string; subtitle?: ReactNode; aside?: ReactNode }) {
  const counts = useLiveQuery(async () => ({
    reviews: await db.manual_review_items.count(),
    decisions: await db.outstanding_decisions.count(),
    sessions: await db.workshop_sessions.count(),
    stakeholders: await db.manual_governance_stakeholders.count(),
  }), []);
  const tabs = [
    { to: '/governance', label: 'Overview', end: true },
    { to: '/governance/intelligence', label: 'Validation Intelligence' },
    { to: '/governance/follow-through', label: 'Follow-Through' },
    { to: '/governance/reviews', label: 'Register', n: counts?.reviews },
    { to: '/governance/decisions', label: 'Decisions', n: counts?.decisions },
    { to: '/governance/workshop', label: 'Workshop', n: counts?.sessions },
    { to: '/governance/stakeholders', label: 'Stakeholders', n: counts?.stakeholders },
  ];
  return (
    <header className="mb-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky">{eyebrow}</p>
          <h1 className="mb-1 mt-1 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="max-w-prose leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      <nav aria-label="Validation workspace" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx('inline-flex min-h-tap items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-sm font-bold', isActive ? 'border-sky text-ink' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}{t.n !== undefined && t.n > 0 && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-extrabold text-muted">{t.n}</span>}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
