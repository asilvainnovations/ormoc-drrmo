// Stakeholder Action Workspace — ADR-043.
// Connects stakeholder responsibilities to tracker records without conferring approval authority.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading } from '@/components/ui';
import type { ManualGovernanceStakeholder, ManualReviewItem, OutstandingDecision } from '@/types';
import { WorkspaceHead, Pill } from './kit';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS, VALIDATION_STATUS } from './labels';

function norm(value: string | null | undefined) {
  return (value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function chapterNumbers(value: string | null | undefined) {
  return [...(value ?? '').matchAll(/(?:ch(?:apter)?\.?\s*)(\d{1,2})/gi)].map((m) => Number(m[1]));
}
function stakeholderMatchesItem(s: ManualGovernanceStakeholder, item: ManualReviewItem) {
  const institution = norm(s.institution);
  const lead = norm(item.lead_office);
  const responsibility = norm(s.responsibility);
  const title = norm([item.title, item.description, item.required_action].filter(Boolean).join(' '));
  const chapterMatch = chapterNumbers(s.relevant_chapters).includes(Number((item.chapter_ref ?? '').match(/\d+/)?.[0]));
  const leadMatch = !!institution && !!lead && (lead.includes(institution) || institution.includes(lead));
  // Responsibility keyword overlap is a conservative assist, never an authority assignment.
  const terms = responsibility.split(' ').filter((w) => w.length > 5);
  const topicMatch = terms.some((w) => title.includes(w));
  return leadMatch || (chapterMatch && topicMatch);
}
function stakeholderMatchesDecision(s: ManualGovernanceStakeholder, d: OutstandingDecision) {
  const institution = norm(s.institution);
  const owners = norm([d.accountable_owner_office, d.supporting_validators].filter(Boolean).join(' '));
  return !!institution && !!owners && (owners.includes(institution) || norm(d.accountable_owner_office).includes(institution));
}

export function StakeholdersPage() {
  const stakeholders = useLiveQuery(() => db.manual_governance_stakeholders.orderBy('institution').toArray(), []);
  const reviews = useLiveQuery(() => db.manual_review_items.orderBy('source_tracker_id').toArray(), []);
  const decisions = useLiveQuery(() => db.outstanding_decisions.orderBy('source_decision_id').toArray(), []);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!stakeholders) return [];
    const needle = norm(q);
    if (!needle) return stakeholders;
    return stakeholders.filter((s) =>
      norm([s.institution, s.role_in_validation, s.responsibility, s.relevant_chapters].filter(Boolean).join(' ')).includes(needle));
  }, [stakeholders, q]);

  if (!stakeholders || !reviews || !decisions) return <Loading />;

  return (
    <div className="space-y-4">
      <WorkspaceHead eyebrow="Stakeholder action workspace" title="Stakeholders & validation assignments"
        subtitle="Open each institution’s assigned review points, Manual references, required actions and decision dependencies. Proposed cluster designations remain unconfirmed until supported by an approved issuance." />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Stakeholders" value={stakeholders.length} />
        <Metric label="Review points" value={reviews.length} />
        <Metric label="Outstanding decisions" value={decisions.length} />
        <Metric label="Unmapped page / paragraph anchors" value={reviews.filter((r) => !r.section_ref).length} />
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search institution, responsibility, chapter…" {...tip('Filter stakeholders and their linked validation work')} />
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" to="/governance/reviews">Full review register</Link>
        <Link className="text-primary underline" to="/governance/decisions">Outstanding decisions</Link>
        <Link className="text-primary underline" to="/governance/workshop">Workshop agenda</Link>
      </nav>
      {filtered.length === 0 ? <EmptyState title="No stakeholders match" body="Try another institution, role or chapter." /> : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const assigned = reviews.filter((r) => stakeholderMatchesItem(s, r));
            const relatedDecisions = decisions.filter((d) => stakeholderMatchesDecision(s, d));
            const isOpen = expanded === s.id;
            return (
              <section key={s.id} className="overflow-hidden rounded-panel border border-line bg-surface">
                <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="flex min-h-tap w-full flex-wrap items-start justify-between gap-3 p-4 text-left hover:bg-sunken/40">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong>{s.institution}</strong>
                      <Badge>{s.designation_status ?? 'Designation not recorded'}</Badge>
                      <Pill>{PRIORITY[s.criticality].label}</Pill>
                    </span>
                    {s.role_in_validation && <span className="mt-1 block text-sm text-muted">{s.role_in_validation}</span>}
                    {s.responsibility && <span className="mt-1 block text-sm">{s.responsibility}</span>}
                    <span className="mt-2 block text-xs text-muted">Manual coverage: {s.relevant_chapters ?? 'Not specified'}</span>
                  </span>
                  <span className="flex shrink-0 gap-2 text-xs">
                    <Badge>{assigned.length} review points</Badge>
                    <Badge>{relatedDecisions.length} decisions</Badge>
                    <span aria-hidden className="text-muted">{isOpen ? '−' : '+'}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-line p-4">
                    <div>
                      <h3 className="font-semibold">Assigned review and validation points</h3>
                      <p className="mt-1 text-xs text-muted">Suggested links are based on the tracker’s lead office, supporting-validator text, chapter coverage and responsibility wording. Confirm the assignment before treating it as formal.</p>
                      {assigned.length === 0 ? <p className="mt-2 text-sm text-muted">No review point is currently matched. The Secretariat should assign or map the relevant tracker item explicitly.</p> : (
                        <ul className="mt-2 space-y-2">
                          {assigned.map((r) => <ReviewTask key={r.id} item={r} />)}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">Related outstanding decisions</h3>
                      {relatedDecisions.length === 0 ? <p className="mt-2 text-sm text-muted">No decision is currently linked to this institution.</p> : (
                        <ul className="mt-2 space-y-2">
                          {relatedDecisions.map((d) => (
                            <li key={d.id} className="rounded-control border border-line p-3">
                              <div className="flex flex-wrap items-center gap-2"><strong>{d.source_decision_id}</strong><Pill>{PRIORITY[d.priority].label}</Pill></div>
                              <p className="mt-1 text-sm">{d.question}</p>
                              <p className="mt-1 text-xs text-muted">Coverage: {d.manual_coverage ?? 'Not specified'} · Owner: {d.accountable_owner_office}</p>
                              <p className="mt-1 text-xs text-muted">Evidence required: {d.evidence_required ?? 'Not specified'}</p>
                              <Link className="mt-2 inline-block text-sm text-primary underline" to="/governance/decisions">Open decision register</Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="text-xs text-muted">This workspace supports review coordination. It does not itself approve Manual text, confer statutory authority, or finalize a decision. Formal validation and approval must follow the applicable City authority and recorded evidence.</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
    </div>
  );
}

function ReviewTask({ item }: { item: ManualReviewItem }) {
  const chapter = item.chapter_ref ?? 'Chapter not mapped';
  const locator = [chapter, item.section_ref].filter(Boolean).join(' · ');
  return (
    <li className="rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="font-data text-xs">{item.source_tracker_id}</strong>
        <Pill>{PRIORITY[item.priority].label}</Pill>
        <Badge>{REVIEW_STATUS[item.review_status]}</Badge>
        <Badge>{VALIDATION_STATUS[item.validation_status]}</Badge>
      </div>
      <p className="mt-1 font-medium">{item.title}</p>
      {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-[10px] font-bold uppercase text-muted">Manual location</dt><dd>{locator || 'Unmapped — Secretariat to resolve'}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase text-muted">Page / paragraph</dt><dd>Not supplied in Tracker V-2; anchor to controlled paginated version</dd></div>
        <div><dt className="text-[10px] font-bold uppercase text-muted">Required action</dt><dd>{item.required_action ?? 'Confirm action with lead office'}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase text-muted">Closure test / evidence</dt><dd>{item.closure_test ?? 'Record disposition and supporting evidence'}</dd></div>
      </dl>
      {item.source_register && <p className="mt-2 text-xs text-muted">Tracker source: {item.source_register}{item.source_used ? ` · ${item.source_used}` : ''}</p>}
      <Link className="mt-3 inline-block text-sm font-semibold text-primary underline" to={`/governance/reviews?chapter=${encodeURIComponent(item.chapter_ref ?? '')}`}>
        Open review register for {chapter}
      </Link>
    </li>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-control border border-line bg-surface p-3"><div className="text-xl font-bold tabular-nums">{value}</div><div className="text-xs text-muted">{label}</div></div>;
}
