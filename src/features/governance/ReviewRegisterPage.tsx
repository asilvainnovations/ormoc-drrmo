// Review Register — ADR-043 Slice 1. Reads from Dexie; authority transitions are online-only.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading, Notice, PageHeader, Section } from '@/components/ui';
import type { GovernancePriority, ManualReviewItem, ReviewStatus } from '@/types';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS } from './labels';

const STATUS_FILTERS: Array<ReviewStatus | 'all'> = [
  'all', 'open', 'in_review', 'pending_evidence', 'pending_decision', 'closed', 'deferred',
];
const PRIORITY_FILTERS: Array<GovernancePriority | 'all'> = [
  'all', 'critical_urgent', 'important', 'standard',
];

export function ReviewRegisterPage() {
  const items = useLiveQuery(() => db.manual_review_items.orderBy('source_tracker_id').toArray(), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ReviewStatus | 'all'>('all');
  const [priority, setPriority] = useState<GovernancePriority | 'all'>('all');

  const filtered = useMemo(() => {
    if (!items) return [] as ManualReviewItem[];
    const needle = q.trim().toLowerCase();
    return items.filter((r: ManualReviewItem) => {
      if (status !== 'all' && r.review_status !== status) return false;
      if (priority !== 'all' && r.priority !== priority) return false;
      if (!needle) return true;
      const hay = [r.source_tracker_id, r.title, r.chapter_ref, r.lead_office, r.closure_test]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, status, priority]);

  const counts = useMemo(() => {
    if (!items) return null;
    return {
      total: items.length,
      open: items.filter((r: ManualReviewItem) => r.review_status !== 'closed' && r.review_status !== 'deferred').length,
      critical: items.filter((r: ManualReviewItem) => r.priority === 'critical_urgent' && r.review_status !== 'closed').length,
    };
  }, [items]);

  if (items === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Review Register"
        subtitle="Manual review items from the Validation Tracker. Close only with disposition and evidence. Stable source IDs VR-001…VR-069."
      />

      <Notice tone="info">{GOVERNANCE_CAVEAT}</Notice>

      {counts && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge>{counts.total} items</Badge>
          <Badge tone="warn">{counts.open} open</Badge>
          <Badge tone="bad">{counts.critical} critical open</Badge>
        </div>
      )}

      <Section title="Filter">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="sr-only">Search</span>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search VR-ID, title, chapter…"
              {...tip('Filter the register by text')}
            />
          </label>
          <label className="sm:w-44">
            <span className="mb-1 block text-xs text-muted">Status</span>
            <select
              className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReviewStatus | 'all')}
              {...tip('Filter by review status')}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : REVIEW_STATUS[s]}</option>
              ))}
            </select>
          </label>
          <label className="sm:w-44">
            <span className="mb-1 block text-xs text-muted">Priority</span>
            <select
              className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as GovernancePriority | 'all')}
              {...tip('Filter by priority')}
            >
              {PRIORITY_FILTERS.map((p) => (
                <option key={p} value={p}>{p === 'all' ? 'All priorities' : PRIORITY[p].label}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline" to="/governance/decisions" {...tip('Outstanding decisions register')}>Decisions</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/workshop" {...tip('Workshop agenda')}>Workshop</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/stakeholders" {...tip('Stakeholder matrix')}>Stakeholders</Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No review items match"
          body={items.length === 0
            ? 'The Validation Tracker has not been imported yet. Apply seed part 40 after the migration.'
            : 'Try clearing the search or filters.'}
        />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {filtered.map((r: ManualReviewItem) => (
            <ReviewRow key={r.id} item={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({ item }: { item: ManualReviewItem }) {
  const p = PRIORITY[item.priority];
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">{item.source_tracker_id}</span>
          <span className={`inline-flex rounded-control px-2 py-0.5 text-xs font-medium ${p.chip}`} {...tip(p.tip)}>
            {p.label}
          </span>
          <Badge>{REVIEW_STATUS[item.review_status]}</Badge>
        </div>
        <p className="mt-1 font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 text-sm text-muted">
          {[item.chapter_ref, item.lead_office].filter(Boolean).join(' · ')}
        </p>
        {item.closure_test && (
          <p className="mt-1 text-xs text-muted" {...tip('Closure test / evidence required')}>
            Closure: {item.closure_test}
          </p>
        )}
      </div>
      <div className="mt-2 shrink-0 sm:mt-0">
        <span className="text-xs text-muted">{item.workshop_slot ?? '—'}</span>
      </div>
    </li>
  );
}
