// Stakeholder Action Workspace — ADR-043.
// Assignments are surfaced only when the Validation Tracker explicitly names the institution.
// This page coordinates review; it does not confer statutory, approval or decision authority.
import { BehavioralDesignGuide } from '@/components/BehavioralDesignGuide';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading } from '@/components/ui';
import type { ManualGovernanceStakeholder, ManualReviewItem, OutstandingDecision } from '@/types';
import { WorkspaceHead, Pill } from './kit';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS, VALIDATION_STATUS } from './labels';

function normalize(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Match only explicit office names in the tracker lead/owner/supporting-validator fields.
 * Alias handling covers common abbreviations in the source workbook without using
 * broad topic-keyword inference (which can silently assign work to the wrong office).
 */
const OFFICE_ALIASES: Record<string, string[]> = {
  'sangguniang panlungsod sp secretariat': ['sp', 'sangguniang panlungsod', 'sp secretariat'],
  'office of civil defense region viii ocd viii': ['ocd viii', 'ocd region viii', 'office of civil defense region viii', 'office of civil defense'],
  'ocd region viii': ['ocd region viii', 'ocd viii', 'office of civil defense region viii'],
  'city mayors office': ['mayors office', 'office of the city mayor', 'city mayors office'],
  'city legal office': ['city legal office', 'clo'],
  'city disaster risk reduction and management office cdrrmo': ['cdrrmo', 'city disaster risk reduction and management office'],
  'city planning and development office cpdo': ['cpdo', 'city planning and development office'],
  'city social welfare and development office cswdo': ['cswdo', 'city social welfare and development office'],
  'human resource management office hrmo': ['hrmo', 'human resource management office'],
  'hrmo': ['hrmo', 'human resource management office'],
  'cdrrmo head': ['cdrrmo head', 'cdrrmo', 'city disaster risk reduction and management office'],
  'cpdo': ['cpdo', 'city planning and development office'],
  'bac secretariat': ['bac secretariat', 'bids and awards committee secretariat'],
  'bids and awards committee secretariat': ['bac secretariat', 'bids and awards committee secretariat'],
};

function officeNames(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\s*(?:\/|;|,|\||\+|\n)\s*/).map(normalize).filter(Boolean);
}

function institutionMatches(institution: string, explicitOfficeText: string | null | undefined): boolean {
  const institutionTokens = officeNames(institution);
  const declared = officeNames(explicitOfficeText);
  if (institutionTokens.length === 0 || declared.length === 0) return false;

  const aliases = institutionTokens.flatMap((key) => OFFICE_ALIASES[key] ?? [key]);
  const declaredAliases = declared.flatMap((key) => OFFICE_ALIASES[key] ?? [key]);
  return aliases.some((alias) => declaredAliases.includes(normalize(alias)));
}

function stakeholderMatchesItem(stakeholder: ManualGovernanceStakeholder, item: ManualReviewItem): boolean {
  return institutionMatches(stakeholder.institution, item.lead_office);
}

function stakeholderMatchesDecision(stakeholder: ManualGovernanceStakeholder, decision: OutstandingDecision): boolean {
  return institutionMatches(stakeholder.institution, decision.accountable_owner_office)
    || institutionMatches(stakeholder.institution, decision.supporting_validators);
}

export function StakeholdersPage() {
  const stakeholders = useLiveQuery(() => db.manual_governance_stakeholders.orderBy('institution').toArray(), []);
  const reviews = useLiveQuery(() => db.manual_review_items.orderBy('source_tracker_id').toArray(), []);
  const decisions = useLiveQuery(() => db.outstanding_decisions.orderBy('source_decision_id').toArray(), []);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!stakeholders) return [];
    const needle = normalize(query);
    if (!needle) return stakeholders;
    return stakeholders.filter((stakeholder) => normalize([
      stakeholder.institution,
      stakeholder.role_in_validation,
      stakeholder.responsibility,
      stakeholder.relevant_chapters,
      stakeholder.designation_status,
    ].filter(Boolean).join(' ')).includes(needle));
  }, [stakeholders, query]);

  if (!stakeholders || !reviews || !decisions) return <Loading />;

  const explicitlyAssignedReviewCount = reviews.filter((item) => !!item.lead_office).length;
  const unassignedReviewCount = reviews.length - explicitlyAssignedReviewCount;

  return (
    <div className="space-y-4">
      <BehavioralDesignGuide area="Stakeholder review assignments" motivation="The right institution must review the issue within its mandate; role clarity reduces delays and prevents authority being assumed." ability="Use the explicit lead office, supporting validators, chapter references and designation status to route review requests." prompt="Send a bounded assignment stating who acts, why, the exact Manual provision, evidence or criteria, due date and expected response; follow up and route unresolved authority questions." actionHref="/governance/reviews" actionLabel="Open assigned review items" boundary="Stakeholder matching supports coordination only. Proposed response-cluster leads and unconfirmed designations are not treated as formal appointments." />
      <WorkspaceHead
        eyebrow="Stakeholder action workspace"
        title="Stakeholders & validation assignments"
        subtitle="Review assignments are drawn from the Validation Tracker’s explicit lead-office field. Open a stakeholder to see the review points and decisions that name that institution."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Stakeholders" value={stakeholders.length} />
        <Metric label="Review points" value={reviews.length} />
        <Metric label="Items with a named lead" value={explicitlyAssignedReviewCount} />
        <Metric label="Items needing assignment" value={unassignedReviewCount} />
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search institution, responsibility or chapter…"
        {...tip('Filter the stakeholder register. Assignments are not inferred from topic keywords.')}
      />

      <nav aria-label="Governance workspace" className="flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" to="/governance/reviews">Full review register</Link>
        <Link className="text-primary underline" to="/governance/decisions">Outstanding decisions</Link>
        <Link className="text-primary underline" to="/governance/workshop">Workshop agenda</Link>
      </nav>

      {filtered.length === 0 ? (
        <EmptyState title="No stakeholders match" body="Try another institution, role or chapter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((stakeholder) => {
            const assignedItems = reviews.filter((item) => stakeholderMatchesItem(stakeholder, item));
            const relatedDecisions = decisions.filter((decision) => stakeholderMatchesDecision(stakeholder, decision));
            const isOpen = expanded === stakeholder.id;

            return (
              <section key={stakeholder.id} className="overflow-hidden rounded-panel border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`stakeholder-panel-${stakeholder.id}`}
                  onClick={() => setExpanded(isOpen ? null : stakeholder.id)}
                  className="flex min-h-tap w-full flex-wrap items-start justify-between gap-3 p-4 text-left hover:bg-sunken/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong>{stakeholder.institution}</strong>
                      <Badge>{stakeholder.designation_status ?? 'Designation not recorded'}</Badge>
                      <Pill>{PRIORITY[stakeholder.criticality].label}</Pill>
                    </span>
                    {stakeholder.role_in_validation && <span className="mt-1 block text-sm text-muted">{stakeholder.role_in_validation}</span>}
                    {stakeholder.responsibility && <span className="mt-1 block text-sm">{stakeholder.responsibility}</span>}
                    <span className="mt-2 block text-xs text-muted">Manual coverage: {stakeholder.relevant_chapters ?? 'Not specified'}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2 text-xs">
                    <Badge>{assignedItems.length} named review points</Badge>
                    <Badge>{relatedDecisions.length} decisions</Badge>
                    <span aria-hidden="true" className="text-muted">{isOpen ? '−' : '+'}</span>
                  </span>
                </button>

                {isOpen && (
                  <div id={`stakeholder-panel-${stakeholder.id}`} className="space-y-4 border-t border-line p-4">
                    <section aria-labelledby={`review-heading-${stakeholder.id}`}>
                      <h3 id={`review-heading-${stakeholder.id}`} className="font-semibold">Review and validation points naming this institution</h3>
                      <p className="mt-1 text-xs text-muted">Only explicit lead-office matches are shown. A supporting validator is not silently promoted to lead; the tracker’s lead field remains controlling for this view.</p>
                      {assignedItems.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">No review item explicitly names this institution as lead validator. The Secretariat should update the tracker assignment if this office is intended to lead an item.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {assignedItems.map((item) => <ReviewTask key={item.id} item={item} />)}
                        </ul>
                      )}
                    </section>

                    <section aria-labelledby={`decision-heading-${stakeholder.id}`}>
                      <h3 id={`decision-heading-${stakeholder.id}`} className="font-semibold">Related outstanding decisions</h3>
                      {relatedDecisions.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">No decision currently names this institution as decision owner or supporting validator.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {relatedDecisions.map((decision) => (
                            <li key={decision.id} className="rounded-control border border-line p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="font-data text-xs">{decision.source_decision_id}</strong>
                                <Pill>{PRIORITY[decision.priority].label}</Pill>
                                <Badge>{decision.decision_status.replace(/_/g, ' ')}</Badge>
                              </div>
                              <p className="mt-1 text-sm">{decision.question}</p>
                              <p className="mt-1 text-xs text-muted">Manual coverage: {decision.manual_coverage ?? 'Not specified'}</p>
                              <p className="mt-1 text-xs text-muted">Decision owner: {decision.accountable_owner_office}</p>
                              <p className="mt-1 text-xs text-muted">Supporting validators: {decision.supporting_validators ?? 'Not specified'}</p>
                              <p className="mt-1 text-xs text-muted">Evidence required: {decision.evidence_required ?? 'Not specified'}</p>
                              <Link className="mt-2 inline-block text-sm text-primary underline" to="/governance/decisions">Open decision register</Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <p className="text-xs text-muted">This workspace coordinates review and evidence. A validator recommends a disposition; the Manual owner/editor reconciles proposed changes; the competent office or body decides matters within its authority. A RACI or stakeholder assignment does not create statutory authority or constitute adoption of the Manual.</p>
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
  const location = [chapter, item.section_ref].filter(Boolean).join(' · ');
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
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted">Manual location in MODE record</dt>
          <dd>{location || 'Not mapped in the current MODE record'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted">Lead validator as recorded</dt>
          <dd>{item.lead_office ?? 'Not assigned'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted">Required review action</dt>
          <dd>{item.required_action ?? 'Confirm with the Manual owner/editor'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted">Closure test / evidence</dt>
          <dd>{item.closure_test ?? 'Record disposition and supporting evidence'}</dd>
        </div>
      </dl>
      {(item.source_register || item.source_used) && (
        <p className="mt-2 text-xs text-muted">Tracker source: {[item.source_register, item.source_used].filter(Boolean).join(' · ')}</p>
      )}
      <p className="mt-2 text-xs text-muted">For the provision-level section, SOP, table, form and annex locators, use the linked “Manual Locator Crosswalk” sheet in the corrected Validation Tracker. Printed page numbers are not inferred here.</p>
      <Link
        className="mt-3 inline-block text-sm font-semibold text-primary underline"
        to={`/governance/reviews?chapter=${encodeURIComponent(item.chapter_ref ?? 'No chapter')}`}
      >
        Open review register for {chapter}
      </Link>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
