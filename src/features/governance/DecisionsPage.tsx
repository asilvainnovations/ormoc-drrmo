// Outstanding Decisions Register — ADR-043 Slice 1.
import { BehavioralDesignGuide } from '@/components/BehavioralDesignGuide';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading, Section } from '@/components/ui';
import type { DecisionStatus, GovernancePriority, OutstandingDecision } from '@/types';
import { WorkspaceHead, Pill } from './kit';
import { PromptCard } from '@/components/PromptCard';
import { FOLLOW_UP_LABEL, NEXT_LABEL, decisionFollowUp, decisionNextAction, decisionPrompt, mandateByOffice, type Viewer } from '@/domain/bmap';
import { DecisionActions, FOLLOW_TONE } from './ActionPanel';
import { useViewer } from './actions';
import { AUTHORITY_STATUS, DECISION_STATUS, GOVERNANCE_CAVEAT, PRIORITY } from './labels';

export function DecisionsPage() {
  const items = useLiveQuery(() => db.outstanding_decisions.orderBy('source_decision_id').toArray(), []);
  const viewer = useViewer();
  const stakeholders = useLiveQuery(() => db.manual_governance_stakeholders.toArray(), [], []);
  const mandates = useMemo(() => mandateByOffice(stakeholders), [stakeholders]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<DecisionStatus | 'all'>('all');
  const [priority, setPriority] = useState<GovernancePriority | 'all'>('all');

  const filtered = useMemo(() => {
    if (!items) return [] as OutstandingDecision[];
    const needle = q.trim().toLowerCase();
    return items.filter((d: OutstandingDecision) => {
      if (status !== 'all' && d.decision_status !== status) return false;
      if (priority !== 'all' && d.priority !== priority) return false;
      if (!needle) return true;
      const hay = [d.source_decision_id, d.question, d.domain, d.accountable_owner_office, d.manual_coverage]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, status, priority]);

  if (items === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <BehavioralDesignGuide area="Institutional decision log" motivation="Outstanding decisions require a clear accountable owner and a separate, verified decision authority to prevent recommendations being mistaken for approvals." ability="Review the question, supporting validators, Manual coverage, evidence requirement and authority status before routing the matter." prompt="When evidence and recommendations are ready, route the item to the competent decision authority, record the signed decision reference and date, and update the disposition." actionHref="/governance/reviews" actionLabel="Review linked validation items" boundary="The accountable owner coordinates the decision; the legally competent authority decides. Never mark a decision complete without its formal reference and evidence." />
      <WorkspaceHead eyebrow="Decision log" title="Outstanding Decisions" subtitle="One accountable owner per decision. Decision authority is recorded separately. Source IDs OD-01…OD-18." />

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{items.length} decisions</Badge>
        <Badge tone="warn">{items.filter((d: OutstandingDecision) => d.decision_status === 'for_decision').length} for decision</Badge>
        <Badge tone="bad">
          {items.filter((d: OutstandingDecision) => d.priority === 'critical_urgent' && d.decision_status !== 'decided').length} critical open
        </Badge>
      </div>

      <Section title="Filter">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search OD-ID, question, owner…"
            {...tip('Filter decisions by text')}
          />
          <select
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm sm:w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as DecisionStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {(Object.keys(DECISION_STATUS) as DecisionStatus[]).map((s) => (
              <option key={s} value={s}>{DECISION_STATUS[s]}</option>
            ))}
          </select>
          <select
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm sm:w-44"
            value={priority}
            onChange={(e) => setPriority(e.target.value as GovernancePriority | 'all')}
          >
            <option value="all">All priorities</option>
            {(Object.keys(PRIORITY) as GovernancePriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY[p].label}</option>
            ))}
          </select>
        </div>
      </Section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline" to="/governance/reviews">Reviews</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/workshop">Workshop</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/stakeholders">Stakeholders</Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No decisions match"
          body={items.length === 0
            ? 'Import seed part 40 after applying the migration.'
            : 'Try clearing the search or filters.'}
        />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {filtered.map((d: OutstandingDecision) => (
            <DecisionRow key={d.id} item={d} viewer={viewer} mandates={mandates} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
    </div>
  );
}

function DecisionRow({ item, viewer, mandates }: { item: OutstandingDecision; viewer: Viewer; mandates: Map<string, string> }) {
  const p = PRIORITY[item.priority];
  const f = decisionFollowUp(item);
  const next = decisionNextAction(item, viewer);
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{item.source_decision_id}</span>
        <span className={`inline-flex rounded-control px-2 py-0.5 text-xs font-medium ${p.chip}`}>{p.label}</span>
        <Badge>{DECISION_STATUS[item.decision_status]}</Badge>
        <Badge tone={item.authority_status === 'confirmed' ? 'ok' : 'warn'}>
          {AUTHORITY_STATUS[item.authority_status]}
        </Badge>
        <Pill tone={FOLLOW_TONE[f.state]}>{FOLLOW_UP_LABEL[f.state]}{item.target_date ? ` · ${item.target_date}` : ''}</Pill>
        {next && <Pill tone="blue">Your step: {NEXT_LABEL[next]}</Pill>}
      </div>
      <p className="mt-1 font-medium leading-snug">{item.question}</p>
      <p className="mt-0.5 text-sm text-muted">
        Owner: {item.accountable_owner_office}
        {item.domain ? ` · ${item.domain}` : ''}
        {item.manual_coverage ? ` · ${item.manual_coverage}` : ''}
      </p>
      {item.evidence_required && (
        <p className="mt-1 text-xs text-muted" {...tip('Evidence required before decision')}>
          Evidence: {item.evidence_required}
        </p>
      )}
      {item.target_workshop && (
        <p className="text-xs text-muted">Target workshop: {item.target_workshop}</p>
      )}
      <details className="mt-2 rounded-control border border-line bg-sunken/30 p-3" open={!!next}>
        <summary className="min-h-tap cursor-pointer text-xs font-bold text-ink" {...tip('Who acts, by when, and what they return')}>Action prompt and response</summary>
        <div className="mt-3 space-y-3">
          <PromptCard prompt={decisionPrompt(item, mandates)} />
          <DecisionActions key={`${item.id}-${item.version}`} decision={item} viewer={viewer} />
        </div>
      </details>
    </li>
  );
}
