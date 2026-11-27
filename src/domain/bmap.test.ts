import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ManualReviewItem, OutstandingDecision } from '@/types';
import {
  OFFICE_PATTERNS, coordinationSummary, decisionNextAction, decisionPrompt, followUp, itemNextAction, itemStage,
  itemsForDocument, itemsForProcedure, officesIn, promptGaps, reviewItemPrompt, sopKeys,
} from './bmap';

const item = (p: Partial<ManualReviewItem> = {}): ManualReviewItem => ({
  id: 'i1', version: 1, source_tracker_id: 'VR-046', title: 'M&E matrix owner', description: 'Confirm the owner.', chapter_ref: 'Ch. 7',
  section_ref: '§3.2', source_register: null, source_used: null, required_action: 'Confirm', priority: 'important', priority_raw: null,
  review_status: 'open', validation_status: 'not_started', lead_office: 'CPDO', lead_position: null, workshop_slot: null,
  closure_test: 'x', disposition: null, closed_at: null, closed_by: null, notes: null, lead_office_codes: ['CPDO'],
  task: 'Review §3.2.', evidence_expected: 'Signed memo', ...p,
} as ManualReviewItem);
const decision = (p: Partial<OutstandingDecision> = {}): OutstandingDecision => ({
  id: 'd1', version: 1, source_decision_id: 'OD-01', question: 'Amend the ordinance?', domain: 'Legal', priority: 'critical_urgent',
  priority_raw: null, accountable_owner_office: 'City Legal Office', accountable_owner_position: null,
  decision_authority_office: 'Sangguniang Panlungsod', decision_authority_position: null, authority_status: 'confirmed',
  supporting_validators: null, manual_coverage: null, evidence_required: 'Draft ordinance', decision_status: 'for_decision',
  target_date: '2026-12-01', target_workshop: '1 Dec 2026', decision_reference: null, decision_date: null, disposition: null,
  decided_by: null, owner_office_codes: ['CLO'], ...p,
} as OutstandingDecision);
const cpdo = { id: 'u-cpdo', officeCode: 'CPDO', roles: ['lead_office_focal'] };
const validator = { id: 'u-val', officeCode: 'CDRRMO', roles: ['validator'] };

describe('routing', () => {
  it('reads office codes out of tracker wording', () => {
    expect(officesIn('City Budget Office / BAC Secretariat')).toEqual(['BAC', 'CBO']);
    expect(officesIn('CPDO / City Secretary / DILG CLGOO')).toEqual(['CPDO', 'DILG-VIII', 'SEC']);
    expect(officesIn('Mayor / CLO / CDRRMO / OCD VIII')).toEqual(['CDRRMO', 'CLO', 'CMO', 'OCD-VIII']);
    expect(officesIn('SP Secretariat')).toEqual(['SP']);
    expect(officesIn('Spanish')).toEqual([]);
  });
  it('keeps the same list as app.office_codes_in() in the migration', () => {
    const sql = readFileSync('supabase/migrations/20261128004100_bmap_validation.sql', 'utf8');
    const block = sql.slice(sql.indexOf('create or replace function app.office_codes_in'), sql.indexOf(') as m(code, re)'));
    const inSql = [...block.matchAll(/\('([A-Z-]+)', '([^']+)'\)/g)].map((m) => [m[1], m[2].replace(/\\\\/g, '\\')]);
    expect(inSql).toEqual(OFFICE_PATTERNS.map(([c, p]) => [c, p]));
  });
});

describe('prompt', () => {
  it('names a missing date as a gap instead of inventing one', () => {
    expect(promptGaps(reviewItemPrompt(item()))).toEqual(['when']);
    expect(promptGaps(reviewItemPrompt(item({ due_date: '2026-12-02' })))).toEqual([]);
  });
  it('says the competent authority decides before an authority item closes', () => {
    expect(reviewItemPrompt(item({ needs_authority: true })).next).toContain('competent authority');
    expect(decisionPrompt(decision()).how).toContain('Decided by Sangguniang Panlungsod');
  });
  it('flags a decision with no decision authority', () => {
    expect(promptGaps(decisionPrompt(decision({ decision_authority_office: null })))).toContain('next');
  });
});

describe('stage and next action', () => {
  it('moves through the behaviours, not through logins', () => {
    expect(itemStage(item())).toBe('unassigned');
    expect(itemStage(item({ assigned_at: 'x', due_date: '2026-12-02' }))).toBe('assigned');
    expect(itemStage(item({ recommendation: 'Accept' }))).toBe('recommended');
    expect(itemStage(item({ recommendation: 'Accept', evidence_ref: 'memo' }))).toBe('evidenced');
    expect(itemStage(item({ recommendation: 'Accept', evidence_ref: 'memo', evidence_verified_at: 'x', needs_authority: true }))).toBe('awaiting_authority');
    expect(itemStage(item({ review_status: 'closed', disposition: 'deferred' }))).toBe('deferred');
  });
  it('gives the lead office its own action and the CDRRMO the coordination action', () => {
    const assigned = item({ assigned_at: 'x', due_date: '2026-12-02' });
    expect(itemNextAction(assigned, cpdo)).toBe('acknowledge');
    expect(itemNextAction(item(), validator)).toBe('assign');
    expect(itemNextAction(item({ lead_office_codes: ['CLO'] }), cpdo)).toBeNull();
    const evidenced = item({ due_date: '2026-12-02', recommendation: 'Accept', evidence_ref: 'memo', recommended_by: 'u-val' });
    expect(itemNextAction(evidenced, validator)).toBeNull(); // four eyes: not their own evidence
    expect(itemNextAction({ ...evidenced, recommended_by: 'u-cpdo' }, validator)).toBe('verify');
  });
  it('routes a decision with the owner’s response to the CDRRMO Head', () => {
    const d = decision({ owner_response: 'Amend', evidence_ref: 'draft' });
    expect(decisionNextAction(d, { id: 'h', officeCode: 'CDRRMO', roles: ['cdrrmo_head'] })).toBe('record_decision');
    expect(decisionNextAction(d, validator)).toBeNull();
  });
});

describe('follow-up', () => {
  it('reminds, then marks overdue, then escalates', () => {
    expect(followUp('assigned', '2026-12-05', true, '2026-11-28').state).toBe('on_track');
    expect(followUp('assigned', '2026-11-30', true, '2026-11-28').state).toBe('due_soon');
    expect(followUp('assigned', '2026-11-27', true, '2026-11-28').state).toBe('overdue');
    expect(followUp('assigned', '2026-11-20', true, '2026-11-28').state).toBe('escalated');
    expect(followUp('assigned', null, true).state).toBe('no_date');
    expect(followUp('assigned', '2026-12-05', false).state).toBe('blocked');
    expect(followUp('closed', '2026-11-01', true).state).toBe('done');
  });
  it('counts the funnel cumulatively', () => {
    const s = coordinationSummary([item(), item({ id: 'i2', recommendation: 'A', evidence_ref: 'e' })], [decision()], '2026-11-28');
    expect(s.funnel.find((f) => f.stage === 'recommended')?.n).toBe(1);
    expect(s.funnel.find((f) => f.stage === 'assigned')?.n).toBe(2);
    expect(s.gaps.when).toBe(2);
  });
});

describe('links to the Manual', () => {
  it('reads SOP keys and expands ranges', () => {
    expect(sopKeys('SOP 4-01–4-03; Annex 4-A')).toEqual(['SOP 4-01', 'SOP 4-02', 'SOP 4-03']);
    expect(sopKeys('GOV-05; SOP 4-03; SOP 6-05')).toEqual(['GOV-05', 'SOP 4-03', 'SOP 6-05']);
  });
  it('matches items to chapters, annexes and procedures', () => {
    const a = item({ chapter_ref: 'Ch. 4', sop_ref: 'SOP 4-01–4-09; Annex 4-A' });
    const b = item({ id: 'i2', chapter_ref: 'Ch. 1', section_ref: '§4.5; Annex 1-I' });
    expect(itemsForDocument([a, b], { code: 'Chapter 4', chapter_no: 4 })).toEqual([a]);
    expect(itemsForDocument([a, b], { code: 'Annex 1-I', chapter_no: null })).toEqual([b]);
    expect(itemsForProcedure([a, b], { code: 'PR-EVACUATION', title: 'SOP 4-06 Evacuation coordination' })).toEqual([a]);
    expect(itemsForProcedure([a, b], { code: 'PR-AAR', title: 'After-action review' })).toEqual([]);
  });
});
