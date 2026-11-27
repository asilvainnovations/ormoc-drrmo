// Conversations (1.34.1): every discussion thread this person can read, in one place on the Coordination tab, at any
// alert level. Threads belong to a record (an EOC activation, a protocol or drill run, an assessment item); this lists
// them by latest activity and opens one to read and reply. Who may read and post is decided by the server (ADR-040).
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { relative } from '@/lib/time';
import { tip } from '@/components/Tooltip';
import { ConversationPanel } from '@/components/ConversationPanel';
import { EmptyState, TextLink } from '@/components/ui';
import type { ConversationParentKind } from '@/types';
import { Block } from './kit';

const KIND: Record<ConversationParentKind, string> = {
  eoc_activation: 'EOC activation', protocol_run: 'Protocol or drill', response: 'Assessment item', assessment_cycle: 'Assessment cycle',
};
type Filter = 'all' | 'open' | ConversationParentKind;

export function Conversations() {
  const [filter, setFilter] = useState<Filter>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useLiveQuery(async () => {
    const [threads, msgs, runs, responses] = await Promise.all([
      db.conversation_threads.toArray(), db.conversation_messages.toArray(), db.protocol_runs.toArray(), db.responses.toArray(),
    ]);
    const last = new Map<string, { at: string; body: string; n: number; urgent: number }>();
    for (const m of msgs) {
      const l = last.get(m.thread_id) ?? { at: '', body: '', n: 0, urgent: 0 };
      l.n += 1; if (m.priority === 'urgent') l.urgent += 1;
      if (m.created_at > l.at) { l.at = m.created_at; l.body = m.body; }
      last.set(m.thread_id, l);
    }
    const run = new Map(runs.map((r) => [r.id, r]));
    const resp = new Map(responses.map((r) => [r.id, r]));
    return threads.map((t) => {
      const l = last.get(t.id);
      const to = t.parent_kind === 'protocol_run' ? `/drrm/run/${t.parent_id}`
        : t.parent_kind === 'response' && resp.get(t.parent_id) ? `/assess/${resp.get(t.parent_id)!.cycle_id}/i/${resp.get(t.parent_id)!.indicator_id}`
        : t.parent_kind === 'eoc_activation' ? '/eoc/coordination' : null;
      const label = t.title ?? (t.parent_kind === 'protocol_run' ? run.get(t.parent_id)?.title : null) ?? KIND[t.parent_kind];
      return { t, label, to, at: l?.at || t.created_at || '', preview: l?.body ?? '', n: l?.n ?? 0, urgent: l?.urgent ?? 0 };
    }).sort((a, b) => b.at.localeCompare(a.at));
  }, [], []);
  const shown = useMemo(() => rows.filter((r) => filter === 'all' || (filter === 'open' ? r.t.status === 'open' : r.t.parent_kind === filter)), [rows, filter]);
  const open = rows.find((r) => r.t.id === openId) ?? null;
  const kinds = [...new Set(rows.map((r) => r.t.parent_kind))];

  return (
    <Block title="Conversations">
      <p className="mb-3 text-sm text-muted">Every discussion you can read: EOC activations, protocol and drill runs, and assessment items. Open one to read and reply. Decisions still go in the logbook or the record they belong to.</p>
      <div role="radiogroup" aria-label="Show" className="mb-3 flex flex-wrap gap-2">
        {(['open', 'all', ...kinds] as Filter[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} {...tip(f === 'open' ? 'Threads still open' : f === 'all' ? 'Every thread, open, resolved or locked' : `Only ${KIND[f as ConversationParentKind].toLowerCase()} threads`)}
            className={clsx('min-h-tap rounded-full border px-3 text-sm font-semibold', filter === f ? 'border-action bg-sky-soft text-ink ring-1 ring-action' : 'border-line bg-surface text-muted')}>
            {f === 'open' ? 'Open' : f === 'all' ? 'All' : KIND[f as ConversationParentKind]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <EmptyState title="No conversations here" body="A conversation starts from its record: the EOC activation, a protocol run or an assessment item." /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <ul className="divide-y divide-line rounded-control border border-line">
            {shown.map((r) => (
              <li key={r.t.id}>
                <button type="button" onClick={() => setOpenId(r.t.id)} {...tip(`Open the conversation: ${r.label}`)}
                  className={clsx('block min-h-tap w-full px-3 py-2 text-left hover:bg-sky-soft/40', openId === r.t.id && 'bg-sky-soft')}>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted"><span>{KIND[r.t.parent_kind]}{r.t.status !== 'open' ? ` · ${r.t.status}` : ''}</span><span>{r.at ? relative(r.at) : ''}</span></span>
                  <b className="block truncate text-sm text-ink">{r.label}</b>
                  <span className="block truncate text-xs text-muted">{r.preview || 'No messages yet'}</span>
                  <span className="text-[11px] font-bold text-muted">{r.n} message{r.n === 1 ? '' : 's'}{r.urgent ? <span className="ml-1 text-bad">· {r.urgent} urgent</span> : null}</span>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {open ? <>
              {open.to && <p className="mb-2 text-sm"><TextLink to={open.to} size="sm" tip="Open the record this conversation belongs to">Open the record</TextLink></p>}
              <ConversationPanel key={open.t.id} parentKind={open.t.parent_kind} parentId={open.t.parent_id} label={open.label} title={open.label} />
            </> : <p className="text-sm text-muted">Choose a conversation.</p>}
          </div>
        </div>
      )}
    </Block>
  );
}
