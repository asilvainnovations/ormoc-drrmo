// "Where this is done in MODE" (1.21.0, ADR-036): the seeded map from an IAT indicator to the
// screen, Tool, protocol or workflow where its Recommended Action is done, plus the workbook
// flags to settle at the validation workshop. Navigation and evidence only — never a score.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Flag, Monitor, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import type { IatIndicatorLink } from '@/types';

function linkTo(l: IatIndicatorLink): { to: string; label: string } {
  if (l.target_kind === 'protocol') return { to: '/drrm/protocols', label: l.target };
  if (l.target_kind === 'workflow') return { to: '/drrm', label: l.target };
  return { to: l.target, label: l.label };
}

export function useModeLinks(indicatorIds: string[]) {
  return useLiveQuery(async () => {
    const links = (await db.iat_indicator_links.where('indicator_id').anyOf(indicatorIds).toArray())
      .sort((a, b) => a.sort - b.sort);
    const flags = await db.iat_workshop_flags.where('indicator_id').anyOf(indicatorIds).toArray();
    return { links, flags };
  }, [indicatorIds.join(',')]);
}

/** Flag chips for indicators that carry a workshop flag (B2.6, B3.1, B1.2, B2.1-B2.4). */
export function WorkshopFlagChips({ flags }: { flags: { indicator_id: string; flag: string }[] }) {
  if (flags.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.indicator_id} {...tip(`${f.indicator_id}: ${f.flag}`)}
          className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 font-data text-[0.8125rem] font-semibold leading-5 tracking-wide text-warn">
          <Flag className="h-3 w-3" aria-hidden /> {f.flag}
        </span>
      ))}
    </span>
  );
}

/** The links and workshop flags, wrapped in a Section that disappears when the indicator has neither. */
export function ModeLinksSection({ indicatorIds, className }: { indicatorIds: string[]; className?: string }) {
  const data = useModeLinks(indicatorIds);
  if (!data || (data.links.length === 0 && data.flags.length === 0)) return null;
  return (
    <Section title="Where this is done in MODE" className={className}>
      <ModeLinks indicatorIds={indicatorIds} />
    </Section>
  );
}

/** The "Where this is done in MODE" list for one or more indicators. */
export function ModeLinks({ indicatorIds, title = 'Where this is done in MODE' }: { indicatorIds: string[]; title?: string }) {
  const data = useModeLinks(indicatorIds);
  if (!data) return null;
  const { links, flags } = data;
  if (links.length === 0 && flags.length === 0) return null;
  const ToolIcon = ({ kind }: { kind: IatIndicatorLink['target_kind'] }) =>
    kind === 'screen' ? <Monitor className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : <Wrench className="h-4 w-4 shrink-0 text-muted" aria-hidden />;
  return (
    <div>
      {flags.length > 0 && (
        <div className="mb-3 rounded-control border border-warn bg-warn-soft/40 p-3">
          <p className="mb-1.5 text-sm font-semibold text-warn">Settle at the validation workshop</p>
          <ul className="space-y-1 text-sm">
            {flags.map((f) => <li key={f.indicator_id}><Badge tone="warn">{f.indicator_id}</Badge> {f.flag}</li>)}
          </ul>
        </div>
      )}
      {links.length > 0 && (
        <>
          <p className="text-sm font-semibold">{title}</p>
          <ul className="mt-1.5 space-y-1.5">
            {links.map((l) => {
              const { to, label } = linkTo(l);
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <ToolIcon kind={l.target_kind} />
                  <Link to={to} {...tip(`${l.target_kind === 'protocol' || l.target_kind === 'workflow' ? `Open the ${l.target_kind} register (${l.target})` : `Open ${l.target}`}`)}
                    className="inline-flex min-w-0 items-center gap-1 rounded-sm font-semibold text-info underline decoration-info/40 underline-offset-2 hover:decoration-info">
                    <span className="truncate">{label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Link>
                  {indicatorIds.length > 1 && <Badge tone="neutral">{l.indicator_id}</Badge>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
