import { describe, expect, it } from 'vitest';
import { indexDelta, iatSnapshot, trackerSnapshot } from './dashboard';
import type { Domain, Indicator, ManualReviewItem, OutstandingDecision, Response, WorkshopSession } from '@/types';

const dom = (code: string, part: 'A' | 'B' | 'C', sort: number): Domain => ({ code, part, name: code, scope: '', functional_area: '', platform_module: '', sort });
const ind = (id: string, domain: string, type: 'M' | 'GP', weight: 1 | 2 | 3): Indicator => ({ id, domain, statement: id, reference: '', type, weight, means_of_verification: null, methods: null, moo_chapter: null, lead_office: null, tags: [], version_status: '', sort: 0 } as Indicator);
const resp = (indicator_id: string, score: number | null, is_na = false): Response => ({ id: indicator_id, version: 1, cycle_id: 'c', indicator_id, score, is_na, na_justification: null, gap_remarks: null, recommended_action: null, status: 'draft' });

const domains = [dom('A1', 'A', 1), dom('B1', 'B', 2), dom('C1', 'C', 3)];
const indicators = [ind('A1.1', 'A1', 'M', 3), ind('A1.2', 'A1', 'M', 2), ind('A1.3', 'A1', 'GP', 1), ind('B1.1', 'B1', 'M', 3), ind('C1.1', 'C1', 'GP', 3)];

describe('dashboard IAT snapshot', () => {
  it('shows no index, not 0, before anything is scored', () => {
    const s = iatSnapshot(indicators, domains, []);
    expect(s.imi).toBeNull();
    expect(s.mandatoryMet).toBe(0);
    expect(s.mandatoryTotal).toBe(3);               // Part C is never Mandatory-counted
    expect(s.domains.every((d) => d.index === null)).toBe(true);
  });
  it('counts Mandatory items met against all Mandatory items, and keeps Part C out of the IMI', () => {
    const s = iatSnapshot(indicators, domains, [resp('A1.1', 3), resp('A1.2', 2), resp('B1.1', 4), resp('C1.1', 0)]);
    expect(s.mandatoryMet).toBe(2);                 // A1.1 and B1.1
    expect(s.mandatoryTotal).toBe(3);
    // IMI = (3*3 + 2*2 + 3*4) / (3 + 2 + 3) = 25/8
    expect(s.imi).toBeCloseTo(3.13, 2);
    expect(s.interfaceIndex).toBe(0);
    expect(s.scored).toBe(3);
  });
  it('ignores N/A answers', () => {
    const s = iatSnapshot(indicators, domains, [resp('A1.1', null, true)]);
    expect(s.imi).toBeNull();
    expect(s.mandatoryMet).toBe(0);
  });
});

describe('index delta', () => {
  it('is null when either side is not scored', () => {
    expect(indexDelta(null, 2)).toBeNull();
    expect(indexDelta(2, null)).toBeNull();
    expect(indexDelta(2.5, 2.13)).toBe(0.37);
  });
});

const item = (over: Partial<ManualReviewItem>): ManualReviewItem => ({ id: 'x', version: 1, source_tracker_id: 'VR', title: 't', description: null, chapter_ref: null, section_ref: null, source_register: null, source_used: null, required_action: null, priority: 'standard', priority_raw: null, review_status: 'open', validation_status: 'not_started', lead_office: null, lead_position: null, workshop_slot: null, closure_test: null, disposition: null, closed_at: null, closed_by: null, notes: null, ...over });
const dec = (over: Partial<OutstandingDecision>): OutstandingDecision => ({ id: 'd', version: 1, source_decision_id: 'OD', question: 'q', domain: null, priority: 'standard', priority_raw: null, accountable_owner_office: 'o', accountable_owner_position: null, decision_authority_office: null, decision_authority_position: null, authority_status: 'confirmed', supporting_validators: null, manual_coverage: null, evidence_required: null, decision_status: 'for_decision', target_date: null, target_workshop: null, decision_reference: null, decision_date: null, disposition: null, decided_by: null, ...over });
const ses = (over: Partial<WorkshopSession>): WorkshopSession => ({ id: 's', version: 1, source_session_key: 'WS', session_number: 1, title: 'S1', purpose: null, manual_coverage: null, key_questions: null, expected_output: null, lead_office: null, scheduled_date: null, scheduled_date_raw: null, status: 'planned', outcome_summary: null, ...over });

describe('dashboard tracker snapshot', () => {
  it('counts open, closed and critical items without touching IAT figures', () => {
    const t = trackerSnapshot([
      item({ id: '1', priority: 'critical_urgent' }), item({ id: '2', review_status: 'closed', priority: 'critical_urgent' }),
      item({ id: '3', review_status: 'pending_decision' }), item({ id: '4', review_status: 'deferred' }),
    ], [], []);
    expect(t.items).toMatchObject({ total: 4, open: 2, closed: 1, deferred: 1, criticalOpen: 1, awaitingDecision: 1 });
  });
  it('counts decisions waiting and those whose authority is not confirmed', () => {
    const t = trackerSnapshot([], [
      dec({ id: '1', priority: 'critical_urgent', authority_status: 'to_be_confirmed' }), dec({ id: '2', decision_status: 'decided' }), dec({ id: '3', decision_status: 'withdrawn' }),
    ], []);
    expect(t.decisions).toMatchObject({ total: 3, forDecision: 1, decided: 1, criticalForDecision: 1, authorityToConfirm: 1 });
  });
  it('picks the next planned session by date, then number', () => {
    const t = trackerSnapshot([], [], [
      ses({ id: 'a', session_number: 2, title: 'Later', scheduled_date: '2026-12-03' }), ses({ id: 'b', session_number: 1, title: 'First', scheduled_date: '2026-12-01' }),
      ses({ id: 'c', session_number: 0, title: 'Done', status: 'completed', scheduled_date: '2026-11-01' }),
    ]);
    expect(t.sessions.next?.title).toBe('First');
    expect(t.sessions.completed).toBe(1);
  });
});
