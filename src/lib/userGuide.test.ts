import { describe, expect, it } from 'vitest';
import { USER_GUIDE_LABEL, USER_GUIDE_TIP, USER_GUIDE_URL } from './userGuide';

describe('User Guide configuration', () => {
  it('points to the local HTML file in the public directory', () => {
    // Verifies it resolves to the HTML file, not the raw Markdown
    expect(USER_GUIDE_URL).toMatch(/\/mode-user-guide\.html$/);
  });

  it('has the correct label and a descriptive tooltip', () => {
    expect(USER_GUIDE_LABEL).toBe('MODE User Guide');
    expect(USER_GUIDE_TIP.length).toBeGreaterThan(20);
    // Verifies the tooltip mentions offline capability (Design System Principle 5: Say why)
    expect(USER_GUIDE_TIP.toLowerCase()).toContain('offline'); 
  });
});
