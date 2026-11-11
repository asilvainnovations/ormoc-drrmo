import { describe, expect, it } from 'vitest';
import { aaCap, advanceDeclaration, disbursementProblem, fundStatus, nextDeadline, pdraDecisionProblem, pdraLeadNote, trancheOf } from './aa';
import type { AaDisbursement, AaFundYear, Declaration } from '@/types';

const H = 3_600_000;
const base = new Date('2026-10-20T00:00:00Z');
const at = (h: number) => new Date(base.getTime() + h * H).toISOString();
const decl = (over: Partial<Declaration> = {}): Declaration => ({
  id: 'd', version: 1, pdra_id: null, hazard_code: 'tropical_cyclone', scope_barangays: [], expected_impact_at: at(100), origin: 'city_request', status: 'draft',
  requested_at: null, rdrrmc_due_at: null, rdrrmc_responded_at: null, rdrrmc_reference: null, eo_number: null, declared_at: null, lifted_at: null,
  lifting_ground: null, lifting_basis: null, report_due_at: null, report_submitted_at: null, report_reference: null, costs_minimized_note: null, ...over,
});

describe('PDRA decision (RA 12287 Sec. 6)', () => {
  const p = { impact_class: 'severe' as const, decision: 'request_declaration' as const, conducted_at: at(0), decision_basis: 'basis' };
  it('needs severe impact', () => expect(pdraDecisionProblem({ ...p, impact_class: 'moderate', expected_impact_at: at(96) })).toMatch(/severe/));
  it('needs a lead time of three (3) days', () => expect(pdraDecisionProblem({ ...p, expected_impact_at: at(48) })).toMatch(/Only 2 days .*three \(3\) days \(RA 12287 Sec\. 6\(b\)\)/));
  it('accepts severe with 3 days', () => expect(pdraDecisionProblem({ ...p, expected_impact_at: at(72) })).toBeNull());
  it('does not round 2.998 days up to three (the server compares the exact value)', () =>
    expect(pdraDecisionProblem({ ...p, expected_impact_at: at(71.96) })).toMatch(/Only 2.9 days/));
  it('flags, without refusing, a PDRA beyond the five-day extension', () => {
    expect(pdraLeadNote(100)).toBeNull();
    expect(pdraLeadNote(121)).toMatch(/five \(5\) days/);
    expect(pdraDecisionProblem({ ...p, expected_impact_at: at(200) })).toBeNull();
  });
  it('ignores other decisions', () => expect(pdraDecisionProblem({ ...p, decision: 'local_early_action', expected_impact_at: at(6) })).toBeNull());
});

describe('declaration steps', () => {
  it('sets the 24-hour RDRRMC clock', () => {
    const patch = advanceDeclaration(decl({ pdra_id: 'p' }), 'requested', {}, base);
    expect(patch.rdrrmc_due_at).toBe(at(24));
  });
  it('a City request needs its PDRA and three days left when it is sent (as the server checks)', () => {
    expect(() => advanceDeclaration(decl(), 'requested', {}, base)).toThrow(/PDRA/);
    expect(() => advanceDeclaration(decl({ pdra_id: 'p', expected_impact_at: at(71.96) }), 'requested', {}, base)).toThrow(/Only 2.9 days/);
    expect(advanceDeclaration(decl({ pdra_id: 'p', expected_impact_at: at(72) }), 'requested', {}, base).status).toBe('requested');
  });
  it('blocks a city declaration without recommendation', () => {
    expect(() => advanceDeclaration(decl(), 'declared', { eo_number: 'EO 1' }, base)).toThrow(/RDRRMC recommendation/);
  });
  it('allows adopting a provincial declaration', () => {
    expect(advanceDeclaration(decl({ origin: 'adopted_provincial' }), 'declared', {}, base).status).toBe('declared');
  });
  it('requires references and EO number', () => {
    expect(() => advanceDeclaration(decl({ status: 'requested' }), 'recommended', {}, base)).toThrow(/reference/);
    expect(() => advanceDeclaration(decl({ status: 'recommended' }), 'declared', {}, base)).toThrow(/Executive Order/);
  });
  it('checks the three-day minimum again when the Mayor declares (IRR Rule II Sec. 3)', () => {
    const rec = decl({ status: 'recommended', expected_impact_at: at(60) });
    expect(() => advanceDeclaration(rec, 'declared', { eo_number: 'EO 1' }, base)).toThrow(/shall not go below .*three \(3\) days/);
    expect(advanceDeclaration(decl({ status: 'recommended', expected_impact_at: at(80) }), 'declared', { eo_number: 'EO 1' }, base).status).toBe('declared');
    // An adopted provincial declaration is adopted as issued (IRR Rule III Sec. 3).
    expect(advanceDeclaration(decl({ origin: 'adopted_provincial', expected_impact_at: at(10) }), 'declared', {}, base).status).toBe('declared');
  });
  it('impacts not met: needs the RDRRMC recommendation and lifting issuance; 45 days from now', () => {
    expect(() => advanceDeclaration(decl({ status: 'declared' }), 'lifted', { lifting_ground: 'impacts_not_met' }, base)).toThrow(/RDRRMC recommendation/);
    const patch = advanceDeclaration(decl({ status: 'declared' }), 'lifted', { lifting_ground: 'impacts_not_met', lifting_reference: 'RDRRMC VIII Memo 1; EO 2' }, base);
    expect(patch.report_due_at).toBe(at(45 * 24));
  });
  it('hazard occurred: lifted automatically at the occurrence time (RA 12287 Sec. 7); 45 days from it', () => {
    const dd = decl({ status: 'declared', declared_at: at(-48) });
    expect(() => advanceDeclaration(dd, 'lifted', { lifting_ground: 'hazard_occurred', lifting_basis: 'SitRep 4' }, base)).toThrow(/when the hazard occurred/);
    expect(() => advanceDeclaration(dd, 'lifted', { lifting_ground: 'hazard_occurred', hazard_occurred_at: at(-10) }, base)).toThrow(/evidence of occurrence/);
    expect(() => advanceDeclaration(dd, 'lifted', { lifting_ground: 'hazard_occurred', hazard_occurred_at: at(-50), lifting_basis: 'x' }, base)).toThrow(/between the declaration and now/);
    const patch = advanceDeclaration(dd, 'lifted', { lifting_ground: 'hazard_occurred', hazard_occurred_at: at(-10), lifting_basis: 'PAGASA TCB #12; SitRep 4' }, base);
    expect(patch.lifted_at).toBe(at(-10));
    expect(patch.report_due_at).toBe(at(-10 + 45 * 24));
  });
  it('rejects illegal transitions', () => expect(() => advanceDeclaration(decl({ status: 'lifted' }), 'declared', {}, base)).toThrow());
});

describe('AA funds (IRR Rule V)', () => {
  const year: AaFundYear = { fiscal_year: 2026, ldrrmf_total: 10_000_000, aa_allocation: 700_000, appropriation_ref: null, version: 1 };
  const d = decl({ status: 'declared' });
  const disb = (amount: number, tranche: AaDisbursement['tranche'], source: AaDisbursement['source'] = 'ldrrmf_aa'): AaDisbursement =>
    ({ id: String(amount), version: 1, declaration_id: 'd', fiscal_year: 2026, source, amount, purpose: 'x', intervention_at: at(0), lead_hours: 0, tranche, obligation_ref: null });
  it('caps AA at 10% of the 70%', () => expect(aaCap(10_000_000)).toBe(700_000));
  it('classifies tranches at a lead time of three (3) days, for hydromet and geological hazards only', () => {
    expect(trancheOf(at(100), at(27)).tranche).toBe('beyond_threshold');
    expect(trancheOf(at(100), at(28)).tranche).toBe('within_threshold');
    expect(trancheOf(at(100), at(27), undefined, 'geological').tranche).toBe('beyond_threshold');
    expect(trancheOf(at(100), at(27), undefined, 'climatic').tranche).toBeNull();
  });
  it('drought is not graduated but stays within the year\'s allocation', () => {
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 600_000, intervention_at: at(0), fiscal_year: 2026 }, d, year, [], undefined, 'climatic')).toBeNull();
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 800_000, intervention_at: at(0), fiscal_year: 2026 }, d, year, [], undefined, 'climatic')).toMatch(/allocation/);
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 200_000, intervention_at: at(50), fiscal_year: 2026 }, d, year, [disb(600_000, null)], undefined, 'hydromet')).toMatch(/allocation/);
  });
  it('limits beyond-3-day spending to 30%', () => {
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 210_000, intervention_at: at(0), fiscal_year: 2026 }, d, year, [])).toBeNull();
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 1, intervention_at: at(0), fiscal_year: 2026 }, d, year, [disb(210_000, 'beyond_threshold')])).toMatch(/limit/);
  });
  it('limits within-3-day spending to 70%', () => {
    expect(disbursementProblem({ source: 'ldrrmf_aa', amount: 490_001, intervention_at: at(50), fiscal_year: 2026 }, d, year, [])).toMatch(/limit/);
  });
  it('exempts other sources', () => {
    expect(disbursementProblem({ source: 'donation', amount: 9_000_000, intervention_at: at(0), fiscal_year: 2026 }, d, undefined, [])).toBeNull();
  });
  it('refuses funds outside a declaration and after impact', () => {
    expect(disbursementProblem({ source: 'donation', amount: 1, intervention_at: at(0), fiscal_year: 2026 }, decl({ status: 'lifted' }), year, [])).toMatch(/in force/);
    expect(disbursementProblem({ source: 'donation', amount: 1, intervention_at: at(101), fiscal_year: 2026 }, d, year, [])).toMatch(/after the expected impact/);
  });
  it('summarises fund status', () => {
    const st = fundStatus(year, [disb(100, 'beyond_threshold'), disb(50, 'within_threshold'), disb(70, null), disb(999, null, 'oda')]);
    expect([st.beyondUsed, st.withinUsed, st.ungraduatedUsed, st.otherUsed, st.beyondLimit, st.withinLimit]).toEqual([100, 50, 70, 999, 210_000, 490_000]);
  });
  it('picks the deadline that matters', () => {
    expect(nextDeadline(decl({ status: 'requested', rdrrmc_due_at: at(24) }), base)?.label).toMatch(/RDRRMC/);
    expect(nextDeadline(decl({ status: 'lifted', report_due_at: at(-1) }), base)?.overdue).toBe(true);
  });
});
