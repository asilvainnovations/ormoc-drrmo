import { describe, expect, it } from 'vitest';
import { CATEGORY, THEMATIC, thematicOf } from './labels';
import type { ProtocolCategory } from '@/types';

describe('DRRM thematic areas (1.14)', () => {
  it('places every category in exactly one of the four areas', () => {
    expect(THEMATIC.map((t) => t.key)).toEqual(['prevention', 'preparedness', 'response', 'recovery']);
    for (const c of Object.keys(CATEGORY) as ProtocolCategory[]) {
      expect(THEMATIC.filter((t) => t.categories.includes(c)).length, c).toBe(1);
    }
    expect(thematicOf('recovery')).toBe('recovery');
    expect(thematicOf('reporting')).toBe('response');
    expect(thematicOf('risk_information')).toBe('prevention');
  });
});
