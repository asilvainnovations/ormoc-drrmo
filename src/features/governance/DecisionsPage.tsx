// Outstanding Decisions Register — ADR-043 Slice 1.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading, Section } from '@/components/ui';
import type { DecisionStatus, GovernancePriority, OutstandingDecision } from '@/types';
import { WorkspaceHead } from './kit';
import { AUTHORITY_STATUS, DECISION_STATUS, GOVERNANCE_CAVEAT, PRIORITY } from './labels';

export function DecisionsPage() {
  const items = useLiveQuery(() => db.outstanding_decisions.orderBy('source_decision_id').toArray(), []);
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
            <DecisionRow key={d.id} item={d} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
    </div>
  );
}

function DecisionRow({ item }: { item: OutstandingDecision }) {
  const p = PRIORITY[item.priority];
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{item.source_decision_id}</span>
        <span className={`inline-flex rounded-control px-2 py-0.5 text-xs font-medium ${p.chip}`}>{p.label}</span>
        <Badge>{DECISION_STATUS[item.decision_status]}</Badge>
        <Badge tone={item.authority_status === 'confirmed' ? 'ok' : 'warn'}>
          {AUTHORITY_STATUS[item.authority_status]}
        </Badge>
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
    </li>
  );
}
