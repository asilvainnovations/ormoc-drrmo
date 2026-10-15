import { expect, test } from '@playwright/test';

test('opens and works with no connection after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();                                   // let the service worker take control
  await expect(page.getByText(/EOC White level/).first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/EOC White level/).first()).toBeVisible();
  await page.goto('/eoc/log');                            // client-side route served from cache
  await page.getByRole('button', { name: 'New entry' }).click();
  await page.getByLabel('Entry', { exact: true }).fill('Power out at the EOC; generator running');
  await page.getByRole('button', { name: 'Log entry' }).click();
  await expect(page.getByText('Power out at the EOC; generator running')).toBeVisible();
  await page.goto('/library');                            // lazy-loaded module from precache
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});
