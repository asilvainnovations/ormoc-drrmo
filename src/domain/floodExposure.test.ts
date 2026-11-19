import { describe, expect, it } from 'vitest';
import { ORMOC_FLOOD_EXPOSURE, getBarangayFloodExposure } from './floodExposure';

describe('Ormoc barangay flood exposure reference data', () => {
  it('holds one record per assessed barangay, keyed by the current PSGC (85-barangay configuration)', () => {
    expect(ORMOC_FLOOD_EXPOSURE).toHaveLength(26);
    expect(new Set(ORMOC_FLOOD_EXPOSURE.map((r) => r.psgc)).size).toBe(26);
    for (const r of ORMOC_FLOOD_EXPOSURE) expect(r.psgc).toMatch(/^0803738\d{3}$/);
  });
  it('preserves the published source denominators and exposed counts', () => {
    expect(getBarangayFloodExposure('0803738057')).toMatchObject({ denominator: 4374, pronePopulation: 4226, exposurePercent: 96.616 });
    expect(getBarangayFloodExposure('0803738060')).toMatchObject({ denominator: 8210, pronePopulation: 8210, exposurePercent: 100 });
  });
  it('adds the 20 Nov 2026 reports with their 2020 CPH denominators (1.30.0)', () => {
    expect(getBarangayFloodExposure('0803738004')).toMatchObject({ name: 'Bantigue', denominator: 3134, pronePopulation: 1762, exposurePercent: 56.222 });
    expect(getBarangayFloodExposure('0803738110')).toMatchObject({ name: 'Bayog', denominator: 1477, pronePopulation: 1477, exposurePercent: 100 });
    expect(getBarangayFloodExposure('0803738082')).toMatchObject({ name: 'San Isidro', denominator: 6210, pronePopulation: 4779, exposurePercent: 76.957 });
    expect(getBarangayFloodExposure('0803738082')!.notes).toMatch(/4,782 prone against the report's 4,779/);
  });
  it('rolls Barangay West up from all seven former districts once District 22 is in', () => {
    const west = getBarangayFloodExposure('0803738117')!;
    expect(west).toMatchObject({ name: 'Barangay West', denominator: 2863, pronePopulation: 2863 });
    expect(west.source).toMatch(/14, 19, 20, 21, 22, 24, 26/);
    expect(getBarangayFloodExposure('0803738116')).toBeUndefined();   // Barangay South: District 1 has no report yet
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
      expect(row.classes.reduce((n, c) => n + c.population, 0), row.name).toBe(row.denominator);
      expect(row.classes.filter((c) => c.name !== 'Not prone').reduce((n, c) => n + c.population, 0), row.name).toBe(row.pronePopulation);
    }
  });
});
