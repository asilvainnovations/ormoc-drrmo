import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BellRing, Target, Wrench } from 'lucide-react';

export interface BehavioralDesignGuideProps {
  area: string;
  motivation: string;
  ability: string;
  prompt: string;
  actionHref: string;
  actionLabel: string;
  boundary?: string;
}

/**
 * B = MAP guidance shared by MODE workspaces.
 * A prompt is useful only when the responsible actor has a clear reason,
 * sufficient authority and practical means to complete the requested action.
 * This component guides action; it does not itself record validation or approval.
 */
export function BehavioralDesignGuide({
  area,
  motivation,
  ability,
  prompt,
  actionHref,
  actionLabel,
  boundary,
}: BehavioralDesignGuideProps) {
  // A link back to the page it sits on helps no one act; show it only when it goes somewhere else.
  const here = useLocation().pathname.replace(/\/$/, '') === actionHref.replace(/\/$/, '');
  return (
    <section
      aria-label={`Behavioural design guidance for ${area}`}
      className="mb-4 overflow-hidden rounded-sheet border border-line bg-surface shadow-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/50 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Behavioural design · B = MAP</p>
          <h2 className="text-sm font-extrabold text-ink">{area}: turn information into institutional action</h2>
        </div>
        <span className="rounded-control border border-line bg-surface px-2 py-1 text-[10px] font-semibold text-muted">Action guidance</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink"><Target className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Motivation · why</p>
          <p className="text-xs leading-relaxed text-muted">{motivation}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink"><Wrench className="h-3.5 w-3.5 text-sky-600" aria-hidden /> Ability · how</p>
          <p className="text-xs leading-relaxed text-muted">{ability}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink"><BellRing className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Prompt · when</p>
          <p className="text-xs leading-relaxed text-muted">{prompt}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-muted">{boundary ?? 'Record the requested action, responsible office, evidence, response and next step. A prompt is not proof of completion or approval.'}</p>
        {!here && <Link
          to={actionHref}
          data-tip={`${actionLabel}: the next place to act`}
          className="inline-flex min-h-tap shrink-0 items-center justify-center gap-2 rounded-control bg-action px-3 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
        >
          {actionLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>}
      </div>
    </section>
  );
}
