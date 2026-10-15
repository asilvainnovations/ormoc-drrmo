import { describe, expect, it } from 'vitest';
import { checkBarangayList, ORMOC_BARANGAY_COUNT } from './barangays';

const current = [
  ...['South', 'East', 'West', 'North'].map((n, i) => ({ psgc: `08037380${90 + i}`, name: `Barangay ${n}` })),
  ...Array.from({ length: ORMOC_BARANGAY_COUNT - 4 }, (_, i) => ({ psgc: `0803738${String(200 + i).padStart(3, '0')}`, name: `Rural ${i}` })),
];

describe('Ormoc barangay list check', () => {
  it('accepts a current list of 85 with South, East, West and North', () => {
    expect(checkBarangayList(current)).toEqual([]);
  });
  it('flags the pre-2022 list of 110 with numbered Poblacion barangays', () => {
    const old = [...Array.from({ length: 29 }, (_, i) => ({ psgc: `083738${String(i + 1).padStart(3, '0')}`, name: `Barangay ${i + 1} (Pob.)` })),
      ...Array.from({ length: 81 }, (_, i) => ({ psgc: `083738${String(300 + i)}`, name: `Rural ${i}` }))];
    const w = checkBarangayList(old);
    expect(w[0]).toMatch(/85 barangays .* has 110/);
    expect(w[1]).toMatch(/29 numbered Poblacion barangays .*South, East, West and North/);
  });
  it('flags repeated codes', () => {
    expect(checkBarangayList([...current.slice(0, 84), current[0]!]).join(' ')).toMatch(/Repeated PSGC code/);
  });
});
