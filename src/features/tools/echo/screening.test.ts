import { describe, expect, it } from 'vitest';
import { HAZARD_MAPS } from '@/features/eoc/map/hazardMaps';
import { densify, severity, summariseRoute } from './screening';

const flood = HAZARD_MAPS.find((m) => m.code === 'flood')!;
const tsunami = HAZARD_MAPS.find((m) => m.code === 'tsunami')!;

describe('ECHO screening', () => {
  it('reads severity from the legend wording', () => {
    expect(severity(flood, 'Very high')).toBe('high');
    expect(severity(flood, 'Moderate')).toBe('moderate');
    expect(severity(flood, 'Low')).toBe('low');
    expect(severity(flood, 'Not mapped here')).toBe('none');
    expect(severity(flood, 'Not readable here: check the sheet')).toBe('unknown');
    expect(severity(tsunami, '1 to under 2 m')).toBe('high');
  });
  it('samples a route about every 50 m', () => {
    const pts = densify([[124.60, 11.00], [124.61, 11.00]]); // about 1.09 km
    expect(pts.length).toBeGreaterThan(20);
    expect(pts[0]).toEqual([124.60, 11.00]);
    expect(pts[pts.length - 1]).toEqual([124.61, 11.00]);
    expect(densify([[124.6, 11], [124.9, 11.2]], 10, 100).length).toBeLessThanOrEqual(101);
  });
  it('counts high readings and where the first one is', () => {
    const s = densify([[124.60, 11.00], [124.601, 11.00]], 50);
    const r = summariseRoute(s, s.map((_, i) => [{ map: flood, value: i === s.length - 1 ? 'High' : 'Low' }]));
    expect(r[0]!.high).toBe(1);
    expect(r[0]!.firstHighAt).toBeGreaterThan(100);
  });
});
