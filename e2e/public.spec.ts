import { expect, test } from '@playwright/test';

// 1.10: public pages open without an account, are indexable, and never load City records.
test.describe('public pages, signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('home, about, FAQ, support and the four policies open with their own title and canonical URL', async ({ page }) => {
    const pages: [string, RegExp][] = [['/', /^Home \| MODE/], ['/about', /^About MODE/], ['/faq', /^Frequently Asked/], ['/support', /^Support/],
      ['/policies/privacy', /^Privacy Policy/], ['/policies/terms', /^Terms of Use/], ['/policies/accessibility', /^Accessibility Statement/], ['/policies/cookies', /^Cookies and Device Storage/]];
    for (const [path, title] of pages) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path === '/' ? '/' : path}$`));
    }
  });

  test('policies say they are drafts until the City approves them, and give the City as controller', async ({ page }) => {
    await page.goto('/policies/privacy');
    await expect(page.getByText('Draft, not yet approved.')).toBeVisible();
    await expect(page.getByText(/City Government of Ormoc, through the City Disaster Risk Reduction/).first()).toBeVisible();
    await expect(page.getByText(/Tokyo, Japan \(ap-northeast-1\)/)).toBeVisible();
  });

  test('the workspace is not indexed and still asks for an account', async ({ page }) => {
    await page.goto('/today');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('robots.txt allows the public pages and blocks the workspace', async ({ request }) => {
    const r = await request.get('/robots.txt');
    expect(r.ok()).toBe(true);
    const t = await r.text();
    expect(t).toContain('Allow: /policies/privacy');
    expect(t).toContain('Disallow: /today');
  });

  test('an unknown address shows "Page not found", and an unknown policy opens the privacy policy', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.goto('/policies/nothing');
    await expect(page).toHaveURL(/\/policies\/privacy$/);
  });

  test('the accessibility settings change text size and are remembered', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: /Accessibility/ }).click();
    await page.getByRole('button', { name: 'Larger text' }).click();
    await expect(page.getByText('Text size: 105%')).toBeVisible();
    await page.reload();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--a11y-scale').trim())).toBe('1.05');
  });
});

test('a signed-in person sees "Open workspace" on the public home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open workspace' })).toBeVisible();
  await page.getByRole('link', { name: 'Open workspace' }).click();
  await expect(page).toHaveURL(/\/today$/);
});
