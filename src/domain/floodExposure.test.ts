import { describe, expect, it } from 'vitest';
import { ORMOC_FLOOD_EXPOSURE, getBarangayFloodExposure } from './floodExposure';

describe('Ormoc barangay flood exposure reference data', () => {
  it('contains the eight reference barangays with stable current PSGC identifiers', () => {
    expect(ORMOC_FLOOD_EXPOSURE).toHaveLength(8);
    expect(new Set(ORMOC_FLOOD_EXPOSURE.map((r) => r.psgc)).size).toBe(8);
  });
  it('preserves the published source denominators and exposed counts', () => {
    expect(getBarangayFloodExposure('0803738057')).toMatchObject({ denominator: 4374, pronePopulation: 4226, exposurePercent: 96.616 });
    expect(getBarangayFloodExposure('0803738060')).toMatchObject({ denominator: 8210, pronePopulation: 8210, exposurePercent: 100 });
  });
  it('keeps the Lao source age-sex matrix complete and un-reclassified', () => {
    const lao = getBarangayFloodExposure('0803738057')!;
    expect(lao.ageSex).toHaveLength(17);
    expect(lao.ageSex.reduce((n, r) => n + (r.maleNotProne ?? 0) + (r.maleProne ?? 0) + (r.femaleNotProne ?? 0) + (r.femaleProne ?? 0), 0)).toBe(4374);
  });
  it('does not manufacture Linao age-sex detail from another barangay', () => {
    const linao = getBarangayFloodExposure('0803738060')!;
    expect(linao.ageSex).toHaveLength(0);
    expect(linao.ageSexStatus).toBe('source-record-pending');
  });
  it('does not allow flood class counts to silently be treated as hazard area', () => {
    for (const row of ORMOC_FLOOD_EXPOSURE) {
      expect(row.classes.reduce((n, c) => n + c.population, 0)).toBe(row.denominator);
      expect(row.classes.filter((c) => c.name !== 'Not prone').reduce((n, c) => n + c.population, 0)).toBe(row.pronePopulation);
    }
  });
});
