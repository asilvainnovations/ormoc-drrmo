// B = MAP for validation (1.34.0). Behaviour = Motivation + Ability + Prompt (Fogg; Manual Introduction, Table I.4).
//
// MODE is judged by whether the right office takes the right action with evidence and proper authority, not by logins.
// This module turns a Validation Tracker record into:
//   - a prompt with the seven elements the Manual requires (who, why, what, how, when, expected response, what next),
//     and the elements still missing, which are CDRRMO coordination tasks, never values to invent;
//   - the stage the behaviour has reached (assigned → acknowledged → recommended → evidenced → verified → closed);
//   - the follow-up state (on track, due soon, overdue, escalated, blocked) and the next action for the viewer.
// The database is authoritative for who may act (migration 20261128004100); this mirrors it for display.
import type { ManualGovernanceStakeholder, ManualReviewItem, OutstandingDecision } from '@/types';

// ------------------------------------------------------------------ routing
/** Mirrors app.office_codes_in() in migration 20261128004100. bmap.test.ts compares the two lists. */
export const OFFICE_PATTERNS: readonly [code: string, pattern: string][] = [
  ['CDRRMO', '(cdrrmo|cdrrmc|disaster risk reduction and management office|assessment team|custodian)'],
  ['CLO', '(city legal|\\mclo\\M)'],
  ['CMO', '(mayor)'],
  ['SP', '(sangguniang panlungsod|\\msp\\M|sp secretariat)'],
  ['CBO', '(budget office|city budget|\\mbudget\\M)'],
  ['BAC', '(\\mbac\\M|bids and awards)'],
  ['CACCO', '(accounting|accountant)'],
  ['TREAS', '(treasur)'],
  ['HRMO', '(\\mhrmo\\M|human resource)'],
  ['ICT', '(\\mict\\M)'],
  ['DPO', '(\\mdpo\\M|data protection)'],
  ['CSWDO', '(cswdo|social welfare)'],
  ['CPDO', '(cpdo|planning and development office)'],
  ['CHO', '(\\mcho\\M|city health)'],
  ['CEO', '(city engineer|building official)'],
  ['GSO', '(\\mgso\\M|general services)'],
  ['CAO', '(city agriculture)'],
  ['CVO', '(veterinar)'],
  ['CENRO', '(\\mcenro\\M|environment and natural resources office)'],
  ['PNP', '(\\mpnp\\M|police)'],
  ['BFP', '(\\mbfp\\M|fire protection)'],
  ['DEPED-SDO', '(deped|schools division)'],
  ['OCD-VIII', '(\\mocd\\M|office of civil defense|rdrrmc)'],
  ['DILG-VIII', '(dilg|lgoo)'],
  ['SEC', '(city secretary)'],
  ['PIO', '(public information)'],
  ['UTILITIES', '(leyeco|ngcp|telecom|water district)'],
  ['HOSPITALS', '(hospital)'],
];
// Postgres \m and \M are word starts and ends; JavaScript has only \b.
const COMPILED = OFFICE_PATTERNS.map(([code, p]) => [code, new RegExp(p.replace(/\\m|\\M/g, '\\b'), 'i')] as const);

/** Office codes named in free tracker text ("City Budget Office / BAC Secretariat" → BAC, CBO). */
export function officesIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set(COMPILED.filter(([, re]) => re.test(text)).map(([c]) => c))].sort();
}

export const COORDINATOR_ROLES = ['admin', 'cdrrmo_head', 'assessor', 'validator', 'author'] as const;
export const VERIFIER_ROLES = ['admin', 'cdrrmo_head', 'validator'] as const;

export interface Viewer { id: string | null; officeCode: string | null; roles: readonly string[] }
export const isCoordinator = (v: Viewer) => v.roles.some((r) => (COORDINATOR_ROLES as readonly string[]).includes(r));
export const isVerifier = (v: Viewer) => v.roles.some((r) => (VERIFIER_ROLES as readonly string[]).includes(r));
const itemCodes = (i: ManualReviewItem) => i.lead_office_codes?.length ? i.lead_office_codes : officesIn(i.lead_office);
const decisionCodes = (d: OutstandingDecision) => d.owner_office_codes?.length ? d.owner_office_codes : officesIn(d.accountable_owner_office);
/** The viewer's own office leads this (it is their task, not one they coordinate). */
export const ledByMyOffice = (codes: string[], v: Viewer) => !!v.officeCode && codes.includes(v.officeCode);
export const itemIsMine = (i: ManualReviewItem, v: Viewer) => ledByMyOffice(itemCodes(i), v);
export const decisionIsMine = (d: OutstandingDecision, v: Viewer) => ledByMyOffice(decisionCodes(d), v);
export const canAnswerItem = (i: ManualReviewItem, v: Viewer) => isCoordinator(v) || itemIsMine(i, v);
export const canAnswerDecision = (d: OutstandingDecision, v: Viewer) => isCoordinator(v) || decisionIsMine(d, v);

// ------------------------------------------------------------------ prompt
export const PROMPT_ELEMENTS = ['who', 'why', 'what', 'how', 'when', 'response', 'next'] as const;
export type PromptElement = (typeof PROMPT_ELEMENTS)[number];
export const PROMPT_LABEL: Record<PromptElement, string> = {
  who: 'Who acts', why: 'Why it matters', what: 'What exactly', how: 'How, and against what',
  when: 'When it is due', response: 'Response expected', next: 'What happens next',
};
/** What the CDRRMO does when an element is missing (the gap is a coordination task, not a blank to guess). */
export const GAP_ACTION: Record<PromptElement, string> = {
  who: 'Assign one lead office.', why: 'Add the mandate or the risk this protects.', what: 'Give the exact section or record.',
  how: 'State the evidence expected and the closure criterion.', when: 'Set the response date.',
  response: 'Say what the lead should return.', next: 'Name who disposes or decides next.',
};
export type Prompt = { behaviour: string } & Record<PromptElement, string | null>;
export const promptGaps = (p: Prompt): PromptElement[] => PROMPT_ELEMENTS.filter((k) => !p[k] || !p[k]!.trim());

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const join = (parts: (string | null | undefined)[], sep = ' · ') => clean(parts.filter((x) => x && x.trim()).join(sep));
const PRIORITY_WHY: Record<ManualReviewItem['priority'], string> = {
  critical_urgent: 'Critical and urgent: legal authority, life safety or a decision the workshop must take.',
  important: 'Important: the chapter cannot be validated while this is open.',
  standard: 'Standard review within the workshop window.',
};

/** Stakeholder responsibility per office code, from the Stakeholder & Cluster Matrix (Motivation: the mandate). */
export function mandateByOffice(stakeholders: ManualGovernanceStakeholder[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of stakeholders) for (const c of s.office_codes?.length ? s.office_codes : officesIn(s.institution)) {
    if (s.responsibility && !m.has(c)) m.set(c, s.responsibility);
  }
  return m;
}

export function reviewItemPrompt(i: ManualReviewItem, mandates: Map<string, string> = new Map()): Prompt {
  const codes = itemCodes(i);
  const mandate = codes.map((c) => mandates.get(c)).find(Boolean);
  const authority = i.needs_authority ? ' The competent authority decides, then the item can close.' : ' The item can then close.';
  return {
    behaviour: 'Review the provision, recommend a disposition and give the evidence.',
    who: join([i.lead_office, i.lead_position, i.supporting_offices ? `with ${i.supporting_offices}` : null]),
    why: join([mandate ? `Mandate: ${mandate}` : null, i.description, PRIORITY_WHY[i.priority]], ' '),
    what: join([i.chapter_version ?? i.chapter_ref, i.section_ref, i.sop_ref, i.artefact_ref,
      i.printed_pages ? `printed p. ${i.printed_pages}` : null]),
    how: join([i.task ?? i.required_action, i.evidence_expected ? `Evidence: ${i.evidence_expected}` : null], ' '),
    when: i.due_date ? `By ${i.due_date}` : null,
    response: 'A recommended disposition (accept, revise, reject, defer) and the evidence reference: a document, a Vault entry or signed minutes.',
    next: clean(`A validator other than the recommender checks the evidence; the Manual editor records the disposition.${authority}`),
  };
}

export function decisionPrompt(d: OutstandingDecision, mandates: Map<string, string> = new Map()): Prompt {
  const mandate = decisionCodes(d).map((c) => mandates.get(c)).find(Boolean);
  const authority = d.decision_authority_office
    ? `${d.decision_authority_office}${d.authority_status === 'to_be_confirmed' ? ' (authority to be confirmed)' : ''}`
    : null;
  return {
    behaviour: 'Prepare and obtain the decision within the competent authority.',
    who: join([d.accountable_owner_office, d.accountable_owner_position, d.supporting_validators ? `with ${d.supporting_validators}` : null]),
    why: join([mandate ? `Mandate: ${mandate}` : null, d.domain, PRIORITY_WHY[d.priority]], ' '),
    what: join([d.question, d.manual_coverage ? `Manual: ${d.manual_coverage}` : null], ' '),
    how: join([d.evidence_required ? `Evidence: ${d.evidence_required}` : null, authority ? `Decided by ${authority}.` : null], ' '),
    when: d.target_date ? `By ${d.target_date}${d.target_workshop ? ` (workshop ${d.target_workshop})` : ''}` : null,
    response: 'The owner’s recommendation with its evidence; then the decision with its reference (EO, resolution, memo or minutes) and date.',
    next: authority ? `The CDRRMO Head records the ${authority} decision and the disposition; linked items can then close.` : null,
  };
}

// ------------------------------------------------------------------ behaviour stage (outcomes, not logins)
export type Stage = 'unassigned' | 'assigned' | 'acknowledged' | 'recommended' | 'evidenced' | 'verified' | 'awaiting_authority' | 'closed' | 'deferred';
export const STAGE_LABEL: Record<Stage, string> = {
  unassigned: 'Not assigned', assigned: 'Assigned', acknowledged: 'Acknowledged', recommended: 'Recommended',
  evidenced: 'Evidence given', verified: 'Evidence verified', awaiting_authority: 'Awaiting decision', closed: 'Closed', deferred: 'Deferred',
};
/** The funnel the CDRRMO watches, in order. */
export const FUNNEL: Stage[] = ['assigned', 'acknowledged', 'recommended', 'evidenced', 'verified', 'closed'];

export function itemStage(i: ManualReviewItem): Stage {
  if (i.review_status === 'deferred' || (i.review_status === 'closed' && (i.disposition === 'deferred' || i.disposition === 'superseded'))) return 'deferred';
  if (i.review_status === 'closed') return 'closed';
  const evidence = !!(i.evidence_ref || i.evidence_vault_id);
  if (i.recommendation && evidence && i.evidence_verified_at) return i.needs_authority && !i.authority_ref ? 'awaiting_authority' : 'verified';
  if (i.recommendation && evidence) return 'evidenced';
  if (i.recommendation) return 'recommended';
  if (i.acknowledged_at) return 'acknowledged';
  if (i.assigned_at || i.due_date) return 'assigned';
  return 'unassigned';
}

/** How far along the funnel a stage is (closed and deferred count as done). */
export const stageRank = (s: Stage) => (s === 'deferred' ? FUNNEL.length : s === 'awaiting_authority' ? FUNNEL.indexOf('verified') + 1 : FUNNEL.indexOf(s) + 1);

export function decisionStage(d: OutstandingDecision): Stage {
  if (d.decision_status === 'decided') return 'closed';
  if (d.decision_status === 'deferred' || d.decision_status === 'withdrawn') return 'deferred';
  if (d.owner_response) return d.evidence_ref ? 'awaiting_authority' : 'recommended';
  if (d.acknowledged_at) return 'acknowledged';
  if (d.assigned_at || d.target_date) return 'assigned';
  return 'unassigned';
}

// ------------------------------------------------------------------ follow-up (reminders and escalation)
/** Days before the due date when a reminder starts; days overdue before the CDRRMO Head is told. Defaults, not law. */
export const REMIND_DAYS = 2;
export const ESCALATE_DAYS = 3;
export type FollowUp = 'done' | 'blocked' | 'escalated' | 'overdue' | 'due_soon' | 'on_track' | 'no_date';
export const FOLLOW_UP_LABEL: Record<FollowUp, string> = {
  done: 'Done', blocked: 'Blocked', escalated: 'Escalated', overdue: 'Overdue', due_soon: 'Due soon', on_track: 'On track', no_date: 'No date',
};

/** Today in Manila as YYYY-MM-DD. */
export const manilaToday = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function followUp(stage: Stage, due: string | null | undefined, hasLead: boolean, today = manilaToday()): { state: FollowUp; days: number | null; reason: string } {
  if (stage === 'closed' || stage === 'deferred') return { state: 'done', days: null, reason: 'Closed with a disposition.' };
  if (!hasLead) return { state: 'blocked', days: null, reason: 'No lead office: the CDRRMO assigns one.' };
  if (stage === 'awaiting_authority') return { state: 'blocked', days: null, reason: 'Waiting on the competent authority’s decision.' };
  if (!due) return { state: 'no_date', days: null, reason: 'No response date: the CDRRMO sets one.' };
  const left = daysBetween(today, due);
  if (left < -ESCALATE_DAYS) return { state: 'escalated', days: -left, reason: `${-left} days overdue: raise with the CDRRMO Head.` };
  if (left < 0) return { state: 'overdue', days: -left, reason: `${-left} day${left === -1 ? '' : 's'} overdue: follow up with the lead office.` };
  if (left <= REMIND_DAYS) return { state: 'due_soon', days: left, reason: left === 0 ? 'Due today.' : `Due in ${left} day${left === 1 ? '' : 's'}.` };
  return { state: 'on_track', days: left, reason: `Due in ${left} days.` };
}
export const itemFollowUp = (i: ManualReviewItem, today?: string) => followUp(itemStage(i), i.due_date, itemCodes(i).length > 0, today);
export const decisionFollowUp = (d: OutstandingDecision, today?: string) => followUp(decisionStage(d), d.target_date, decisionCodes(d).length > 0, today);

// ------------------------------------------------------------------ next action for this viewer
export type NextAction = 'acknowledge' | 'respond' | 'add_evidence' | 'assign' | 'verify' | 'close' | 'record_decision' | null;
export const NEXT_LABEL: Record<Exclude<NextAction, null>, string> = {
  acknowledge: 'Acknowledge', respond: 'Record recommendation', add_evidence: 'Add evidence', assign: 'Assign and set date',
  verify: 'Verify evidence', close: 'Record disposition and close', record_decision: 'Record the decision',
};

export function itemNextAction(i: ManualReviewItem, v: Viewer): NextAction {
  const s = itemStage(i);
  if (s === 'closed' || s === 'deferred') return null;
  const mine = itemIsMine(i, v);
  if (mine) {
    if (s === 'assigned') return 'acknowledge';
    if (s === 'acknowledged' || s === 'unassigned') return 'respond';
    if (s === 'recommended') return 'add_evidence';
  }
  if (!isCoordinator(v)) return null;
  if (s === 'unassigned' || !i.due_date) return 'assign';
  if (s === 'evidenced' && isVerifier(v) && i.recommended_by !== v.id) return 'verify';
  if (s === 'verified' && isVerifier(v)) return 'close';
  return null;
}

export function decisionNextAction(d: OutstandingDecision, v: Viewer): NextAction {
  const s = decisionStage(d);
  if (s === 'closed' || s === 'deferred') return null;
  if (decisionIsMine(d, v)) {
    if (s === 'assigned') return 'acknowledge';
    if (s === 'acknowledged' || s === 'unassigned') return 'respond';
  }
  if (!isCoordinator(v)) return null;
  if (s === 'unassigned' || !d.target_date) return 'assign';
  if (s === 'awaiting_authority' && v.roles.some((r) => r === 'cdrrmo_head' || r === 'admin')) return 'record_decision';
  return null;
}

// ------------------------------------------------------------------ coordination summary
export interface Coordination {
  funnel: { stage: Stage; n: number }[];
  follow: Record<FollowUp, number>;
  total: number;
  gaps: Record<PromptElement, number>;
}
export function coordinationSummary(items: ManualReviewItem[], decisions: OutstandingDecision[], today = manilaToday()): Coordination {
  const stages = [...items.map(itemStage), ...decisions.map(decisionStage)];
  const follow = Object.fromEntries((Object.keys(FOLLOW_UP_LABEL) as FollowUp[]).map((k) => [k, 0])) as Record<FollowUp, number>;
  for (const i of items) follow[itemFollowUp(i, today).state] += 1;
  for (const d of decisions) follow[decisionFollowUp(d, today).state] += 1;
  const gaps = Object.fromEntries(PROMPT_ELEMENTS.map((k) => [k, 0])) as Record<PromptElement, number>;
  for (const p of [...items.filter((i) => itemStage(i) !== 'closed' && itemStage(i) !== 'deferred').map((i) => reviewItemPrompt(i)),
    ...decisions.filter((d) => decisionStage(d) !== 'closed' && decisionStage(d) !== 'deferred').map((d) => decisionPrompt(d))]) {
    for (const g of promptGaps(p)) gaps[g] += 1;
  }
  return {
    funnel: FUNNEL.map((stage) => ({ stage, n: stages.filter((s) => stageRank(s) >= stageRank(stage)).length })),
    follow, total: stages.length, gaps,
  };
}

/** Who did what and when, from the server stamps (the audit trail holds every change in full). */
export function itemHistory(i: ManualReviewItem): { at: string; what: string }[] {
  const h: { at: string | null | undefined; what: string }[] = [
    { at: i.assigned_at, what: `Assigned${i.due_date ? `, due ${i.due_date}` : ''}` },
    { at: i.acknowledged_at, what: 'Acknowledged by the lead office' },
    { at: i.recommended_at, what: 'Recommendation recorded' },
    { at: i.evidence_verified_at, what: 'Evidence verified' },
    { at: i.closed_at, what: `Closed${i.disposition ? ` (${i.disposition})` : ''}` },
  ];
  return h.filter((x): x is { at: string; what: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at));
}

// ------------------------------------------------------------------ links to the Library, Protocols and Vault
/** SOP keys named in text: "GOV-03", "HR-05", "SOP 4-01"; a range "SOP 4-01–4-09" expands to each SOP. */
export function sopKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(GOV|HR)-(\d{2})\b/g)) out.add(`${m[1]}-${m[2]}`);
  for (const m of text.matchAll(/\bSOP\s+(\d+)-(\d{2})(?:\s*[–-]\s*(?:\1-)?(\d{2}))?/g)) {
    const [from, to] = [Number(m[2]), Number(m[3] ?? m[2])];
    for (let n = from; n <= Math.min(to, from + 20); n += 1) out.add(`SOP ${m[1]}-${String(n).padStart(2, '0')}`);
  }
  return [...out].sort();
}
/** "Ch. 4", "Chapter 4", "Ch. 4 v1.3" → 4. */
export const chapterNo = (ref: string | null | undefined) => {
  const m = ref?.match(/\bCh(?:apter|\.)?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};
/** Review items about a Library document: the same chapter, or an annex named in the item's locator. */
export function itemsForDocument(items: ManualReviewItem[], doc: { code: string; chapter_no?: number | null }): ManualReviewItem[] {
  const annex = /^Annex\s/i.test(doc.code) ? doc.code.toLowerCase() : null;
  return items.filter((i) => annex
    ? [i.section_ref, i.artefact_ref, i.sop_ref].some((t) => t?.toLowerCase().includes(annex))
    : doc.chapter_no != null && chapterNo(i.chapter_ref) === doc.chapter_no);
}
/** Review items about a procedure (matched by SOP key in the template title or code). */
export function itemsForProcedure(items: ManualReviewItem[], template: { code: string; title: string }): ManualReviewItem[] {
  const keys = new Set([...sopKeys(template.title), ...sopKeys(template.code)]);
  return keys.size ? items.filter((i) => sopKeys(i.sop_ref).some((k) => keys.has(k))) : [];
}
