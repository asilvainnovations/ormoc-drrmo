import { describe, expect, it } from 'vitest';
import { PILLAR_CLASS, PILLAR_KEYS, pillarOfArea } from './pillars';
import { THEMATIC } from '@/features/protocols/labels';

describe('DRRM pillar mapping (1.17, ADR-031)', () => {
  it('assigns every functional area 1-10 to a pillar', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(pillarOfArea(n)).toBeTruthy();
  });
  it('maps areas to the documented pillars', () => {
    expect(pillarOfArea(2)).toBe('prevention');
    expect(pillarOfArea(9)).toBe('prevention');
    expect(pillarOfArea(1)).toBe('preparedness');
    expect(pillarOfArea(3)).toBe('preparedness');
    for (const n of [4, 5, 6, 7, 8]) expect(pillarOfArea(n)).toBe('response');
    expect(pillarOfArea(10)).toBe('recovery');
  });
  it('returns null for unknown or missing areas', () => {
    expect(pillarOfArea(0)).toBeNull();
    expect(pillarOfArea(null)).toBeNull();
    expect(pillarOfArea(undefined)).toBeNull();
  });
  it('never uses the reserved EOC alert colours', () => {
    for (const c of Object.values(PILLAR_CLASS)) {
      const all = Object.values(c).join(' ');
      expect(all).not.toContain('lvl-');
    }
  });
  it('covers exactly the four thematic areas', () => {
    expect(PILLAR_KEYS.map((k) => k.key).sort()).toEqual(THEMATIC.map((t) => t.key).sort());
  });
});
