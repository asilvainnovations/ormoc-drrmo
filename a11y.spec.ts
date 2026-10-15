import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.1 AA automated checks on the main screens (serious and critical issues fail the run).
const PAGES = ['/', '/assess', '/protocols', '/eoc', '/eoc/log', '/eoc/aa', '/eoc/aa/pdra/new', '/eoc/aa/funds', '/library', '/library/trace', '/library/requirements', '/settings', '/settings/sync'];

for (const path of PAGES) {
  test(`axe ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`)).toEqual([]);
  });
}
