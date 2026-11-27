// B = MAP prompt (1.34.0): the seven elements a useful prompt names (Manual Introduction, Table I.4). A missing element is
// shown as the CDRRMO's next coordination task; it is never filled with a guess.
import clsx from 'clsx';
import { GAP_ACTION, PROMPT_ELEMENTS, PROMPT_LABEL, promptGaps, type Prompt } from '@/domain/bmap';

export function PromptCard({ prompt, compact, className }: { prompt: Prompt; compact?: boolean; className?: string }) {
  const gaps = promptGaps(prompt);
  return (
    <section aria-label="Action prompt" className={clsx('rounded-panel border p-4', gaps.length ? 'border-warn/40 bg-warn/5' : 'border-action/30 bg-sky-soft/30', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Action prompt</p>
        <p className={clsx('text-[11px] font-bold', gaps.length ? 'text-warn' : 'text-ok')}>
          {gaps.length ? `${gaps.length} of 7 missing: the CDRRMO completes ${gaps.length === 1 ? 'it' : 'them'} first` : 'Complete: ready to issue'}
        </p>
      </div>
      <h3 className="mt-1 font-bold text-ink">{prompt.behaviour}</h3>
      <dl className={clsx('mt-3 grid gap-3 text-sm', !compact && 'sm:grid-cols-2')}>
        {PROMPT_ELEMENTS.map((k) => (
          <div key={k} className={clsx(k === 'how' || k === 'why' ? 'sm:col-span-2' : undefined)}>
            <dt className="text-xs font-bold text-muted">{PROMPT_LABEL[k]}</dt>
            <dd className={clsx('mt-1 leading-relaxed', prompt[k] ? 'text-ink' : 'font-semibold text-warn')}>{prompt[k] ?? `Missing. ${GAP_ACTION[k]}`}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
