// Validation overview (1.24.0): the first screen of the workspace. Counts come from the tracker tables on this device.
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Loading } from '@/components/ui';
import { trackerSnapshot } from '@/domain/dashboard';
import { BarRow, Metric, Panel, Pill, WorkspaceHead } from './kit';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS } from './labels';
import type { GovernancePriority, ReviewStatus } from '@/types';

const STEPS = [
  ['01', 'Review the draft', 'Read the chapter and identify the exact issue.'],
  ['02', 'Validate evidence', 'Check laws, certified issuances, records and data.'],
  ['03', 'Deliberate', 'Record the validator’s finding and any dissent.'],
  ['04', 'Decide or endorse', 'Refer policy or authority questions to the proper body.'],
  ['05', 'Close and control', 'Log evidence, owner, date and the approved revision.'],
] as const;

export function OverviewPage() {
  const d = useLiveQuery(async () => {
    const [items, decisions, sessions] = [await db.manual_review_items.toArray(), await db.outstanding_decisions.toArray(), await db.workshop_sessions.toArray()];
    return { items, snap: trackerSnapshot(items, decisions, sessions) };
  }, []);
  if (!d) return <Loading />;
  const { items, snap } = d;
  const open = items.filter((i) => i.review_status !== 'closed' && i.review_status !== 'deferred');
  const byPriority = (['critical_urgent', 'important', 'standard'] as GovernancePriority[]).map((p) => ({ p, n: open.filter((i) => i.priority === p).length }));
  const byStatus = (['open', 'in_review', 'pending_evidence', 'pending_decision', 'closed', 'deferred'] as ReviewStatus[]).map((s) => ({ s, n: items.filter((i) => i.review_status === s).length }));
  const chapters = [...items.reduce((m, i) => m.set(i.chapter_ref ?? 'No chapter', (m.get(i.chapter_ref ?? 'No chapter') ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <WorkspaceHead eyebrow="Operational snapshot" title="Validation overview" subtitle="Track what needs evidence, who needs to decide, and what is ready to close."
        aside={<Pill>{snap.items.total} register items</Pill>} />
      {snap.items.total === 0 ? <Panel title="Nothing loaded yet">The Validation Tracker arrives with the next reference-data sync.</Panel> : <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Open items" value={snap.items.open} hint={`of ${snap.items.total} in the register`} />
          <Metric label="Critical, open" value={snap.items.criticalOpen} tone={snap.items.criticalOpen ? 'bad' : undefined} hint="Legal authority, life-safety, workshop decisions" />
          <Metric label="Decisions waiting" value={snap.decisions.forDecision} tone={snap.decisions.criticalForDecision ? 'warn' : undefined} hint={`${snap.decisions.authorityToConfirm} with authority to confirm`} />
          <Metric label="Items closed" value={snap.items.closed} tone="ok" hint="With disposition and evidence" />
          <Metric label="Sessions done" value={`${snap.sessions.completed}/${snap.sessions.total}`} hint={snap.sessions.next ? `Next: ${snap.sessions.next.title}` : undefined} />
        </div>
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Panel title="Validation load">
            {byPriority.map(({ p, n }) => <BarRow key={p} label={PRIORITY[p].label} value={n} max={Math.max(1, open.length)} tone={p === 'critical_urgent' ? 'red' : p === 'important' ? 'orange' : 'grey'} />)}
            <hr className="my-5 border-line" />
            <h3 className="mb-1 text-sm font-extrabold text-ink">Status summary</h3>
            {byStatus.map(({ s, n }) => <BarRow key={s} label={REVIEW_STATUS[s]} value={n} max={Math.max(1, items.length)} tone={s === 'closed' ? 'green' : 'grey'} />)}
          </Panel>
          <Panel title="Register items by chapter">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {chapters.map(([c, n]) => (
                <Link key={c} to={`/governance/reviews?chapter=${encodeURIComponent(c)}`} className="rounded-control bg-sunken/70 p-3 text-xs hover:bg-sky-soft">
                  <b className="block font-display text-2xl text-ink">{n}</b>{c}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
        <Panel title="Validation and decision pathway">
          <ol className="grid gap-3 md:grid-cols-5">
            {STEPS.map(([n, t, body]) => (
              <li key={n} className="border-t-[3px] border-sky pt-3">
                <b className="text-xs text-sky">{n}</b><strong className="my-1 block text-sm text-ink">{t}</strong><p className="text-xs leading-snug text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <p className="mt-4 text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
      </>}
    </div>
  );
}
