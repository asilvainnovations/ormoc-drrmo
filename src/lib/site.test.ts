import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POLICY, PUBLIC_PATHS, SITE, policyApproved, setPageMeta } from './site';

describe('public site settings', () => {
  it('has contact details and no unconfirmed policy approval by default', () => {
    expect(SITE.supportEmail).toBe('mode-support@asilvainnovations.com');
    expect(SITE.dpoEmail).toMatch(/@/);
    expect(SITE.npcRegistration).toBeNull();
    expect(POLICY.lastReviewed).toBe('8 November 2026');
    expect(policyApproved()).toBe(false);
  });
  it('keeps the sitemap paths in step with vite.config.ts', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    const m = /SEO_PATHS = \[([^\]]+)\]/.exec(cfg);
    const list = m![1]!.match(/'[^']+'/g)!.map((x) => x.slice(1, -1));
    expect(list).toEqual([...PUBLIC_PATHS]);
  });
  it('sets canonical and index for public pages, noindex and no canonical for the workspace', () => {
    setPageMeta({ title: 'About MODE', description: 'd', path: '/about', index: true });
    expect(document.title).toMatch(/^About MODE \| MODE/);
    expect(document.head.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute('href')).toMatch(/\/about$/);
    setPageMeta({ title: 'Workspace', index: false });
    expect(document.head.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('noindex, nofollow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
