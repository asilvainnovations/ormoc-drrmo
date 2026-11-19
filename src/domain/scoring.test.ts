import { describe, expect, it } from 'vitest';
import { complianceStatus, cycleResults, evidenceCap, gapPriorityScore, maturityBand, priorityBand, scoreBlockReason } from './scoring';
import type { Domain, Indicator, Response } from '@/types';

describe('evidence rule (IAT §5.2)', () => {
  it('caps verbal evidence at 2 and requires approved documents for 3', () => {
    expect(evidenceCap([])).toBe(0);
    expect(evidenceCap([{ strength: 'verbal' }])).toBe(2);
    expect(evidenceCap([{ strength: 'verbal' }, { strength: 'approved_in_use' }])).toBe(3);
    expect(evidenceCap([{ strength: 'tested_improved' }])).toBe(4);
  });
  it('explains why a score is blocked', () => {
    expect(scoreBlockReason(0, 0)).toBeNull();
    expect(scoreBlockReason(2, 2)).toBeNull();
    expect(scoreBlockReason(3, 2)).toMatch(/approved document/);
    expect(scoreBlockReason(4, 3)).toMatch(/test, exercise/);
    expect(scoreBlockReason(1, 0)).toMatch(/Add evidence/);
  });
});

describe('gap priority (IAT §5.4)', () => {
  it('applies 1.5 to Mandatory in Parts A/B and 1.0 to GP and Part C', () => {
    expect(gapPriorityScore(2, 3, 'M', 'A')).toBe(9);
    expect(gapPriorityScore(2, 3, 'GP', 'A')).toBe(6);
    expect(gapPriorityScore(1, 3, 'GP', 'C')).toBe(9);
    expect(gapPriorityScore(null, 3, 'M', 'A')).toBeNull();
  });
  it('bands at 9 and 4', () => {
    expect([9, 8.9, 4, 3.9].map(priorityBand)).toEqual(['High', 'Medium', 'Medium', 'Low']);
  });
  it('bands maturity at 0.5, 1.5, 2.5, 3.5', () => {
    expect([0.49, 0.5, 1.49, 1.5, 2.49, 2.5, 3.49, 3.5].map(maturityBand)).toEqual(
      ['Absent', 'Initial', 'Initial', 'Developing', 'Developing', 'Compliant', 'Compliant', 'Advanced']);
  });
  it('bands the unrounded index: 2.495 is Developing although it shows as 2.50 (1.13.0)', () => {
    // 200 equal-weight items: 101 at 2 and 99 at 3 give exactly 499 / 200 = 2.495.
    const domains = [{ code: 'A1', part: 'A', name: 'A1', scope: '', functional_area: '', platform_module: '', sort: 1 }] as Domain[];
    const indicators = Array.from({ length: 200 }, (_, n) => ({ id: `A1.${n + 1}`, domain: 'A1', type: 'GP', weight: 1 })) as Indicator[];
    const responses = indicators.map((i, n) => ({ id: String(n), cycle_id: 'c', indicator_id: i.id, score: n < 101 ? 2 : 3, is_na: false })) as Response[];
    const r = cycleResults(indicators, domains, responses).domains.A1!;
    expect(r.maturityIndex).toBe(2.5);
    expect(r.band).toBe('Developing');
  });
  it('reports compliance status', () => {
    expect(complianceStatus({ score: 3, is_na: false }, 'M', 'A')).toBe('Compliant');
    expect(complianceStatus({ score: 2, is_na: false }, 'M', 'B')).toBe('Non-compliant');
    expect(complianceStatus({ score: 3, is_na: false }, 'GP', 'C')).toBe('Meets GP');
    expect(complianceStatus({ score: null, is_na: true }, 'M', 'A')).toBe('N/A');
    expect(complianceStatus(undefined, 'M', 'A')).toBe('Not scored');
  });
  it('counts N/A, unscored and Mandatory scored/met apart, without changing any score (1.27.0, ADR-044 item 4)', () => {
    const domains = [{ code: 'A1', part: 'A', name: 'A1', scope: '', functional_area: '', platform_module: '', sort: 1 },
      { code: 'C1', part: 'C', name: 'C1', scope: '', functional_area: '', platform_module: '', sort: 2 }] as Domain[];
    const ind = (id: string, domain: string, type: 'M' | 'GP') => ({ id, domain, type, weight: 1 }) as Indicator;
    const indicators = [ind('A1.1', 'A1', 'M'), ind('A1.2', 'A1', 'M'), ind('A1.3', 'A1', 'M'), ind('A1.4', 'A1', 'GP'), ind('C1.1', 'C1', 'GP')];
    const r = (indicator_id: string, score: number | null, is_na = false) => ({ id: indicator_id, cycle_id: 'c', indicator_id, score, is_na }) as Response;
    const res = cycleResults(indicators, domains, [r('A1.1', 3), r('A1.2', 1), r('A1.3', null, true), r('C1.1', 2)]);
    expect(res.imi).toMatchObject({ indicators: 4, scored: 2, notApplicable: 1, unscored: 1, mandatoryScored: 2, mandatoryMet: 1, mandatoryCompliance: 0.5, maturityIndex: 2 });
    expect(res.interface).toMatchObject({ indicators: 1, scored: 1, notApplicable: 0, unscored: 0, mandatoryScored: 0 });
    expect(res.domains.A1).toMatchObject({ notApplicable: 1, unscored: 1 });
  });
});
