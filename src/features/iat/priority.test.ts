import { describe, expect, it } from 'vitest';
import { PRIORITY_INDICATORS, priorityOf } from './priority';

describe('Pareto priority set (1.17, ADR-031)', () => {
  it('has 23 unique indicators (6 + 11 + 6 across the tiers)', () => {
    expect(PRIORITY_INDICATORS).toHaveLength(23);
    expect(new Set(PRIORITY_INDICATORS.map((p) => p.id)).size).toBe(23);
  });
  it('has all three tiers', () => {
    for (const tier of [1, 2, 3]) expect(PRIORITY_INDICATORS.some((p) => p.tier === tier)).toBe(true);
  });
  it('keeps the documented tier-1 order', () => {
    expect(PRIORITY_INDICATORS.filter((p) => p.tier === 1).map((p) => p.id))
      .toEqual(['A1.1', 'A1.2', 'A2.2', 'A2.3', 'A4.1', 'A4.2']);
  });
  it('looks up tiers and returns null for unknown ids', () => {
    expect(priorityOf('B1.1')).toBe(2);
    expect(priorityOf('A1.8')).toBe(3);
    expect(priorityOf('ZZ9.9')).toBeNull();
  });
});
