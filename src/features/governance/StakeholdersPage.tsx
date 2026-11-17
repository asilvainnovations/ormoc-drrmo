// Stakeholder & Cluster Matrix — ADR-043 Slice 1.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading, Notice, PageHeader } from '@/components/ui';
import type { ManualGovernanceStakeholder } from '@/types';
import { GOVERNANCE_CAVEAT, PRIORITY } from './labels';

export function StakeholdersPage() {
  const rows = useLiveQuery(
    () => db.manual_governance_stakeholders.orderBy('institution').toArray(),
    [],
  );
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!rows) return [] as ManualGovernanceStakeholder[];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((s: ManualGovernanceStakeholder) => {
      const hay = [s.institution, s.role_in_validation, s.responsibility, s.relevant_chapters]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  if (rows === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stakeholders"
        subtitle="Institutions and proposed validation roles. Designations are not confirmed until verified against the EOC EO and ICS EO."
      />
      <Notice tone="info">{GOVERNANCE_CAVEAT}</Notice>

      <Badge>{rows.length} institutions</Badge>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search institution, role or chapter…"
        {...tip('Filter the stakeholder matrix')}
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline" to="/governance/reviews">Reviews</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/decisions">Decisions</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/workshop">Workshop</Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No stakeholders match"
          body={rows.length === 0
            ? 'Import seed part 40 after applying the migration.'
            : 'Try clearing the search.'}
        />
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {filtered.map((s: ManualGovernanceStakeholder) => (
            <StakeholderRow key={s.id} item={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StakeholderRow({ item }: { item: ManualGovernanceStakeholder }) {
  const p = PRIORITY[item.criticality];
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.institution}</span>
        <span className={`inline-flex rounded-control px-2 py-0.5 text-xs font-medium ${p.chip}`}>
          {p.label}
        </span>
        {item.designation_status && <Badge>{item.designation_status}</Badge>}
      </div>
      {item.role_in_validation && (
        <p className="mt-1 text-sm text-muted">{item.role_in_validation}</p>
      )}
      {item.responsibility && (
        <p className="mt-0.5 text-sm">{item.responsibility}</p>
      )}
      {item.relevant_chapters && (
        <p className="mt-1 text-xs text-muted" {...tip('Manual chapters this stakeholder reviews')}>
          Chapters: {item.relevant_chapters}
        </p>
      )}
    </li>
  );
}
