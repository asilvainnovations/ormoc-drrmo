import { describe, expect, it } from 'vitest';
import {
  CSWD_DISTRICTS,
  CSWD_OFFICIAL_BARANGAY_COUNT,
  getCSWDDistrict,
  getCSWDDistrictAssignmentCount,
  normalizeBarangayName,
} from './cswdDistricts';

describe('Ormoc CSWD district assignments', () => {
  it('contains all 85 official barangay assignments in six districts', () => {
    expect(CSWD_DISTRICTS.map((district) => district.barangays.length)).toEqual([
      17, 18, 6, 14, 18, 12,
    ]);
    expect(getCSWDDistrictAssignmentCount()).toBe(CSWD_OFFICIAL_BARANGAY_COUNT);
  });

  it('has no duplicate official barangay names across districts', () => {
    const names = CSWD_DISTRICTS.flatMap((district) =>
      district.barangays.map(normalizeBarangayName),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(85);
  });

  it('assigns Alta Vista to District 5 and keeps District 6 at 12 barangays', () => {
    expect(getCSWDDistrict('Alta Vista')?.code).toBe('District 5');
    const district6 = CSWD_DISTRICTS.find(
      (district) => district.code === 'District 6',
    );

    // Array.find may return undefined; optional chaining keeps this test
    // compatible with strict TypeScript and noUncheckedIndexedAccess.
    expect(district6?.barangays).not.toContain('Alta Vista');
    expect(district6?.barangays).toHaveLength(12);
  });

  it('matches common imported barangay-name variants', () => {
    expect(getCSWDDistrict('Magaswi')?.code).toBe('District 1');
    expect(getCSWDDistrict('Santo Niño')?.code).toBe('District 1');
    expect(getCSWDDistrict('Rufina M. Tan')?.code).toBe('District 2');
    expect(getCSWDDistrict('Borok')?.code).toBe('District 4');
    expect(getCSWDDistrict('Hibunawon')?.code).toBe('District 5');
    expect(getCSWDDistrict('Cogon Combado')?.code).toBe('District 6');
  });

  it('does not guess a district for an unknown barangay', () => {
    expect(getCSWDDistrict('Unknown Barangay')).toBeNull();
  });
});
