// Validation overview (1.24.0): the first screen of the workspace. Counts come from the tracker tables on this device.
import { BehavioralDesignGuide } from '@/components/BehavioralDesignGuide';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Loading } from '@/components/ui';
import { Ring } from '@/features/eoc/kit';
import { trackerSnapshot } from '@/domain/dashboard';
import { BarRow, Metric, Panel, Pill, WorkspaceHead } from './kit';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS } from './labels';
import type { GovernancePriority, ManualReviewItem, OutstandingDecision, ReviewStatus } from '@/types';
import { tip } from '@/components/Tooltip';
import { NEXT_LABEL, decisionFollowUp, decisionNextAction, isCoordinator, itemFollowUp, itemNextAction, type Viewer } from '@/domain/bmap';
import { FOLLOW_TONE } from './ActionPanel';
import { useViewer } from './actions';

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
    return { items, decisions, snap: trackerSnapshot(items, decisions, sessions) };
  }, []);
  const viewer = useViewer();
  if (!d) return <Loading />;
  const { items, snap } = d;
  // viewer comes from the hook below (hooks must run before the early return)
  const open = items.filter((i) => i.review_status !== 'closed' && i.review_status !== 'deferred');
  const byPriority = (['critical_urgent', 'important', 'standard'] as GovernancePriority[]).map((p) => ({ p, n: open.filter((i) => i.priority === p).length }));
  const byStatus = (['open', 'in_review', 'pending_evidence', 'pending_decision', 'closed', 'deferred'] as ReviewStatus[]).map((s) => ({ s, n: items.filter((i) => i.review_status === s).length }));
  const natural = (x: string, y: string) => x.localeCompare(y, undefined, { numeric: true });
  const chapters = [...items.reduce((m, i) => {
    const k = i.chapter_ref ?? 'No chapter'; const c = m.get(k) ?? { total: 0, closed: 0, working: 0 };
    c.total += 1;
    if (i.review_status === 'closed') c.closed += 1; else if (i.review_status !== 'open' && i.review_status !== 'deferred') c.working += 1;
    return m.set(k, c);
  }, new Map<string, { total: number; closed: number; working: number }>())].sort((x, y) => natural(x[0], y[0]));
  const pct = snap.items.total ? Math.round((100 * snap.items.closed) / snap.items.total) : 0;
  return (
    <div>
      <BehavioralDesignGuide area="Manual governance overview" motivation="A shared view of validation, decisions and unresolved dependencies helps the CDRRMO coordinate institutional action rather than count platform activity." ability="Use the consolidated tracker, decision log, workshop agenda and stakeholder matrix as linked sources of work." prompt="Prioritise critical and urgent issues, assign one lead validator, clarify the requested response and due date, then monitor evidence and closure criteria." actionHref="/governance/reviews" actionLabel="Open priority review queue" boundary="The tracker is a controlled validation baseline, not an approved City policy instrument. Proposed office assignments must be confirmed." />
      <WorkspaceHead eyebrow="Ormoc CDRRMO and EOC" title="Validation workspace" subtitle="Track what needs evidence, who needs to decide, and what is ready to close."
        aside={<Pill>{snap.items.total} register items</Pill>} />
      {snap.items.total === 0 ? <Panel title="Nothing loaded yet">The Validation Tracker arrives with the next reference-data sync.</Panel> : <>
        <YourTasks items={items} decisions={d.decisions} viewer={viewer} />
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
          <Panel title="Progress">
            <div className="flex items-center gap-4">
              <Ring value={snap.items.closed} max={snap.items.total || 1} size={104}>{pct}%</Ring>
              <div><p className="font-display text-3xl font-extrabold">{snap.items.closed} of {snap.items.total}</p><p className="text-sm text-muted">items closed with disposition and evidence</p></div>
            </div>
            <p className="mt-5 text-sm text-muted">
              {snap.items.awaitingDecision} wait on a decision · {snap.items.awaitingEvidence} wait on evidence · {snap.items.deferred} deferred
            </p>
          </Panel>
        </div>
        <Panel title="By chapter" note="Closed, in progress and not started items in each chapter. Select a chapter to open its items." className="mb-4">
          <ul className="space-y-2">
            {chapters.map(([c, v]) => (
              <li key={c}>
                <Link to={`/governance/reviews?chapter=${encodeURIComponent(c)}`} className="grid items-center gap-3 rounded-control p-1 text-xs font-bold text-ink hover:bg-sky-soft/60" style={{ gridTemplateColumns: '9rem 1fr 4.5rem' }}>
                  <span className="truncate">{c}</span>
                  <span className="flex h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${c}: ${v.closed} closed, ${v.working} in progress, ${v.total - v.closed - v.working} not started`}>
                    <span className="bg-ok" style={{ width: `${(100 * v.closed) / v.total}%` }} />
                    <span className="bg-warn" style={{ width: `${(100 * v.working) / v.total}%` }} />
                  </span>
                  <span className="text-right font-data">{v.closed}/{v.total}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-4 text-[11px] font-semibold text-muted"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-ok" />Closed</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-warn" />In progress</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sunken" />Not started</span></p>
        </Panel>
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

/** The prompt, where the person works: what this office (or coordinator) is asked to do now, soonest first. */
function YourTasks({ items, decisions, viewer }: { items: ManualReviewItem[]; decisions: OutstandingDecision[]; viewer: Viewer }) {
  const rows = [
    ...items.map((i) => ({ id: i.source_tracker_id, title: i.title, next: itemNextAction(i, viewer), f: itemFollowUp(i), to: `/governance/reviews?item=${i.source_tracker_id}` })),
    ...decisions.map((x) => ({ id: x.source_decision_id, title: x.question, next: decisionNextAction(x, viewer), f: decisionFollowUp(x), to: '/governance/decisions' })),
  ].filter((r) => r.next).sort((a, b) => (a.f.days ?? 99) - (b.f.days ?? 99));
  if (!viewer.officeCode && !isCoordinator(viewer)) {
    return <Panel title="Your tasks" className="mb-4">Your account has no office yet, so no validation task can reach you. Ask the administrator to set your office in Settings → Users.</Panel>;
  }
  return (
    <Panel title={`Your tasks${viewer.officeCode ? ` · ${viewer.officeCode}` : ''}`} note={isCoordinator(viewer) ? <>Coordination steps waiting on you. The full picture is in <Link to="/governance/follow-through" className="font-bold text-sky underline" {...tip('Open the coordination view')}>Follow-Through</Link>.</> : 'Steps your office is asked to take, soonest first.'} className="mb-4">
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing is waiting on you.</p> : (
        <ul className="divide-y divide-line">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id}><Link to={r.to} className="flex min-h-tap flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-sky-soft/40 sm:flex-nowrap" {...tip(`Open ${r.id}`)}>
              <span className="w-14 shrink-0 font-data text-xs text-muted">{r.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.title}</span>
              <span className="flex w-full min-w-0 flex-wrap gap-1 pl-[4.25rem] sm:w-auto sm:shrink-0 sm:flex-nowrap sm:pl-0">
                <Pill tone="blue">{NEXT_LABEL[r.next!]}</Pill>
                <Pill tone={FOLLOW_TONE[r.f.state]}>{r.f.reason}</Pill>
              </span>
            </Link></li>
          ))}
          {rows.length > 8 && <li className="py-2 text-xs text-muted"><Link to="/governance/reviews?scope=act" className="font-bold text-sky underline" {...tip('See every item waiting on you')}>{rows.length - 8} more</Link></li>}
        </ul>
      )}
    </Panel>
  );
}
