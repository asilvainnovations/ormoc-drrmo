import { describe, expect, it } from 'vitest';
import { matchesSection } from './LibraryPage';
import type { MooDocument } from '@/types';

const doc = (o: Partial<MooDocument>) => ({ id: 'x', manual: 'MOO', code: 'MOO Ch.3', title: 'Risk Information and Planning', aliases: ['EOC Ch.2'], area_no: 4, ...o }) as MooDocument;

describe('matchesSection', () => {
  it('matches code, title words, old codes and area numbers, case-insensitively', () => {
    expect(matchesSection(doc({}), '')).toBe(true);
    expect(matchesSection(doc({}), 'moo ch.3')).toBe(true);
    expect(matchesSection(doc({}), 'risk planning')).toBe(true);
    expect(matchesSection(doc({}), 'EOC Ch.2')).toBe(true);
    expect(matchesSection(doc({}), 'area 4')).toBe(true);
    expect(matchesSection(doc({}), 'area 14')).toBe(false);
    expect(matchesSection(doc({}), 'logbook')).toBe(false);
  });
});
