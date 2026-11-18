import { describe, expect, it } from 'vitest';
import { categorySummary, standardCoverage } from './resourceStandard';

const r = (name: string, quantity: number, is_serviceable = true, category: 'vehicle' | 'power' | 'medical' = 'vehicle') => ({ name, quantity, is_serviceable, category });

describe('standardCoverage', () => {
  it('counts nothing when nothing is recorded', () => {
    expect(standardCoverage([]).every((x) => x.units === 0 && x.lines === 0)).toBe(true);
  });
  it('matches by name and separates serviceable units', () => {
    const rows = standardCoverage([r('Generator set 5 kVA', 3), r('Generator 10 kVA', 1, false), r('Rescue boat', 2)]);
    const gen = rows.find((x) => x.item.key === 'generator')!;
    expect(gen).toMatchObject({ units: 4, serviceable: 3, lines: 2 });
    expect(rows.find((x) => x.item.key === 'vehicle')!.units).toBe(2);
  });
  it('an ambulance counts as both a vehicle and an ambulance', () => {
    const rows = standardCoverage([r('Ambulance (BLS)', 2)]);
    expect(rows.find((x) => x.item.key === 'ambulance')!.units).toBe(2);
    expect(rows.find((x) => x.item.key === 'vehicle')!.units).toBe(2);
  });
});

describe('categorySummary', () => {
  it('summarises lines, units and unserviceable items per category', () => {
    const s = categorySummary([r('a', 2), r('b', 3, false), r('c', 1, true, 'power')]);
    expect(s[0]).toEqual({ category: 'vehicle', lines: 2, units: 5, notServiceable: 1 });
    expect(s[1]!.category).toBe('power');
  });
});
