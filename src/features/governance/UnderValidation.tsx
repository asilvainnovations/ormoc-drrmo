// "Under validation" (1.34.0, B = MAP): where people read the Manual or run a procedure, show the validation items that
// concern it, their stage and who is due to act. Reading a provision is not validating it; this says what is still open.
import { Link } from 'react-router-dom';
import { tip } from '@/components/Tooltip';
import { STAGE_LABEL, itemFollowUp, itemStage } from '@/domain/bmap';
import type { ManualReviewItem } from '@/types';
import { FOLLOW_TONE } from './ActionPanel';
import { Pill } from './kit';

export function UnderValidation({ items, what, heading }: { items: ManualReviewItem[]; what: string; heading?: string }) {
  const open = items.filter((i) => itemStage(i) !== 'closed' && itemStage(i) !== 'deferred');
  if (items.length === 0) return null;
  return (
    <section aria-label="Under validation" className="mb-4 rounded-panel border border-warn/40 bg-warn/5 p-4">
      <h2 className="text-sm font-extrabold text-ink">{heading ? `${heading}: ${items.length} item${items.length === 1 ? '' : 's'}` : open.length ? `${open.length} validation item${open.length === 1 ? '' : 's'} open on this ${what}` : `Validation items on this ${what} are closed`}</h2>
      <p className="mb-2 text-xs text-muted">{heading ? 'Superseding or withdrawing this document affects these items; tell the CDRRMO first.' : 'Treat the text as a draft where an item is open. The lead office recommends; the CDRRMO records the disposition.'}</p>
      <ul className="divide-y divide-line">
        {items.slice(0, 10).map((i) => {
          const f = itemFollowUp(i);
          return (
            <li key={i.id}>
              <Link to={`/governance/reviews?item=${i.source_tracker_id}`} className="flex min-h-tap flex-wrap items-center gap-2 py-1.5 text-sm hover:bg-sky-soft/40" {...tip(`Open ${i.source_tracker_id} in the validation register`)}>
                <span className="font-data text-xs text-muted">{i.source_tracker_id}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{i.title}</span>
                <span className="text-xs text-muted">{i.lead_office ?? 'No lead'}</span>
                <Pill tone={itemStage(i) === 'closed' ? 'green' : 'blue'}>{STAGE_LABEL[itemStage(i)]}</Pill>
                <Pill tone={FOLLOW_TONE[f.state]}>{f.reason}</Pill>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
