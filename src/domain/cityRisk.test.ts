import { describe, expect, it } from 'vitest';
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';
import { bandIndex, bandsOf, buildRegister, cellOf, explain, ratingOf } from './cityRisk';

// The 25 cells of 13_QRE_Risk_Matrix (DDRiVE workbook, 9 Nov 2026).
const SEV: [number, number][] = [[0, 10], [11, 25], [26, 50], [51, 75], [76, 100]];
const LIK: [number, number][] = [[0, 2], [2.1, 4], [4.1, 6], [6.1, 8], [8.1, 10]];
const CODES = ['VL1', 'VL2', 'L3', 'L4', 'M5', 'VL2', 'L3', 'L4', 'M5', 'M6', 'L3', 'L4', 'M5', 'M6', 'H7', 'L4', 'M5', 'M6', 'H7', 'H8', 'M5', 'M6', 'H7', 'H8', 'VH9'];
const matrix: DdriveRiskMatrixRow[] = SEV.flatMap((s, si) => LIK.map((l, li) => ({
  ranking: si * 5 + li + 1, severity_min: s[0], severity_max: s[1], likelihood_min: l[0], likelihood_max: l[1], band: CODES[si * 5 + li]!, label: '',
})));
const risk = (hazard_event: string, likelihood: number, response: string, severity: number, ranking: number, band: string): DdriveCityRisk => ({
  hazard_event, hazard_family: 'H2', exposure_infrastructure: '9-Extremely likely', exposure_productive: '9-Extremely likely',
  exposure_essential: '9-Extremely likely', exposure_human: '9-Extremely likely', vulnerability_rating: 90,
  response_measures: response, likelihood, severity, evidence_anchor: null, validation_status: 'Desk score', ranking, band, label: '',
});

describe('QRE city risk (14_QRE_Scoring)', () => {
  it('reads the bands and cells of the matrix', () => {
    const b = bandsOf(matrix);
    expect(b.likelihood).toHaveLength(5);
    expect(b.severity).toHaveLength(5);
    expect(bandIndex(b.likelihood, 9)).toBe(4);
    expect(bandIndex(b.severity, 50)).toBe(2);
    expect(cellOf(matrix, 4, 2)?.band).toBe('H7');
    expect(cellOf(matrix, 4, 4)?.band).toBe('VH9');
  });
  it('explains flood as H7 and checks severity = (likelihood − response) × 10', () => {
    const e = explain(risk('Riverine & flash flood', 9, '4-Some measures in place', 50, 15, 'H7'), matrix);
    expect(e.computedSeverity).toBe(50);
    expect(e.consistent).toBe(true);
    expect(e.cls).toBe('H');
    expect(e.steps.join(' ')).toContain('(9 − 4) × 10 = 50');
    expect(e.steps.join(' ')).toContain('cell 15 of 25, H7');
  });
  it('flags a stored severity that does not follow the method', () => {
    expect(explain(risk('X', 6, '4-Some measures in place', 30, 13, 'M5'), matrix).consistent).toBe(false);
  });
  it('reads the rating number from the QRE label', () => {
    expect(ratingOf('1-Extremely few measures in place')).toBe(1);
    expect(ratingOf('Some measures')).toBeNull();
  });
  it('links the register to plans, the Plan damages and barangays, highest rank first', () => {
    const reg = buildRegister(
      [risk('Tsunami', 2, '1-Extremely few measures in place', 10, 1, 'VL1'), risk('Riverine & flash flood', 9, '4-Some measures in place', 50, 15, 'H7')],
      matrix,
      [{ id: 'p', version: 1, code: 'CP-FLOOD-LUNOP', title: 'Flood', hazard_code: 'flood', hazard_codes: ['flood', 'tropical_cyclone'], scenario: null, warning_time: null, activation_triggers: null, status: 'adopted', adopted_ref: null, adopted_on: null, valid_until: null, vault_document_id: null }],
      [{ psgc: '1', name: 'Alegria', population_2024: 1557 } as never, { psgc: '2', name: 'Bagong', population_2024: 860 } as never],
      [{ psgc: '1', tsunami: 'Within tsunami-inundation zone, 1 to <3 m' } as never, { psgc: '2', tsunami: 'Outside mapped inundation extent' } as never],
      [{ psgc: '1', susceptibility_class: 'High' } as never],
      [{ hazard: 'Flood', billion: 222.4 }, { hazard: 'Tsunami', billion: 59 }],
    );
    expect(reg.map((r) => r.risk.band)).toEqual(['H7', 'VL1']);
    expect(reg[0]?.plans.map((p) => p.code)).toEqual(['CP-FLOOD-LUNOP']);
    expect(reg[0]?.damagesBn).toBe(222.4);
    expect(reg[0]?.barangays).toMatchObject({ flagged: 1, notAssessed: 1, population: 1557 });
    expect(reg[1]?.barangays).toMatchObject({ flagged: 1, notAssessed: 0, names: ['Alegria'] });
  });
});
