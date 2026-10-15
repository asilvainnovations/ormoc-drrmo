import { expect, test, type Page } from '@playwright/test';

// Every visible clickable element explains itself with a tooltip (data-tip), on every main screen.
// Content written by people (manual text in .prose-doc) and the tooltip itself are excluded.
const PAGES = ['/', '/assess', '/protocols', '/eoc', '/eoc/log', '/eoc/sitreps', '/eoc/requests', '/eoc/barangays', '/eoc/aa', '/eoc/aa/pdra/new', '/eoc/aa/funds',
  '/library', '/library/trace', '/library/requirements', '/library/crosswalk', '/settings', '/settings/sync', '/settings/about', '/vault', '/vault/review', '/vault/references'];

async function untipped(page: Page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, summary, select, input:not([type=hidden]), textarea, [role=button], [role=tab], label:has(input)';
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    return [...document.querySelectorAll(sel)]
      .filter((el) => visible(el) && !el.closest('.prose-doc, [role=tooltip], .sr-only'))
      .filter((el) => !el.closest('[data-tip]'))
      .filter((el) => !(el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') && el.closest('label[data-tip]')))
      .filter((el) => !(el.tagName === 'LABEL' && el.querySelector('[data-tip]')))   // a label around a control that has its own tip
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40)}"`);
  });
}

for (const path of PAGES) {
  test(`tooltips on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await untipped(page)).toEqual([]);
  });
}

test('tooltip shows on hover and on keyboard focus, and Escape dismisses it', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'hover and keyboard are desktop interactions; long press is covered below');
  await page.goto('/');
  await page.getByRole('link', { name: 'Run a protocol' }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Pick a CDRRMO procedure and follow it step by step');
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Tab');                        // skip link
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toBeVisible();
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('aria-describedby', /app-tooltip/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('long press shows the tooltip on a phone without opening the link', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Run a protocol' });
  const box = (await link.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const pt = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
  await page.waitForTimeout(700);
  await expect(page.getByRole('tooltip')).toHaveText('Pick a CDRRMO procedure and follow it step by step');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/$/);                     // the press did not navigate
});
