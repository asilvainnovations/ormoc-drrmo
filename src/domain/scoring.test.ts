import { describe, expect, it } from 'vitest';
import { complianceStatus, evidenceCap, gapPriorityScore, maturityBand, priorityBand, scoreBlockReason } from './scoring';

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
  it('reports compliance status', () => {
    expect(complianceStatus({ score: 3, is_na: false }, 'M', 'A')).toBe('Compliant');
    expect(complianceStatus({ score: 2, is_na: false }, 'M', 'B')).toBe('Non-compliant');
    expect(complianceStatus({ score: 3, is_na: false }, 'GP', 'C')).toBe('Meets GP');
    expect(complianceStatus({ score: null, is_na: true }, 'M', 'A')).toBe('N/A');
    expect(complianceStatus(undefined, 'M', 'A')).toBe('Not scored');
  });
});
