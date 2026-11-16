import { describe, expect, it } from 'vitest';
import { USER_GUIDE_LABEL, USER_GUIDE_TIP, USER_GUIDE_URL } from './userGuide';

describe('User Guide link', () => {
  it('is an HTTPS link to MODE-User-Guide.md, with a label and a tooltip', () => {
    const u = new URL(USER_GUIDE_URL);
    expect(u.protocol).toBe('https:');
    expect(u.pathname.endsWith('/MODE-User-Guide.md')).toBe(true);
    expect(USER_GUIDE_LABEL).toBe('Explore the User Guide');
    expect(USER_GUIDE_TIP.length).toBeGreaterThan(10);
  });
});
