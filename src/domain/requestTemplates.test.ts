import { describe, expect, it } from 'vitest';
import { neededByIso, REQUEST_GROUPS } from './requestTemplates';

describe('request templates', () => {
  const now = new Date('2026-11-18T06:22:00Z'); // 14:22 Manila
  it('offsets in hours', () => {
    expect(neededByIso('2h', now)).toBe('2026-11-18T08:22:00.000Z');
    expect(neededByIso('now', now)).toBe(now.toISOString());
  });
  it('today is 6 PM Manila, never in the past', () => {
    expect(neededByIso('today', now)).toBe('2026-11-18T10:00:00.000Z');
    expect(neededByIso('today', new Date('2026-11-18T13:00:00Z'))).toBe('2026-11-18T13:00:00.000Z');
  });
  it('tomorrow is 6 PM Manila the next day', () => { expect(neededByIso('tomorrow', now)).toBe('2026-11-19T10:00:00.000Z'); });
  it('every item has a unit', () => { expect(REQUEST_GROUPS.flatMap((g) => g.items).every((i) => i.unit && i.label)).toBe(true); });
});
