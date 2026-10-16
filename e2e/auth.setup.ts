import { expect, test as setup } from '@playwright/test';

// Sign each test account in through the real login form and keep its session for the journeys.
for (const name of ['lead', 'admin', 'viewer', 'duty']) {
  setup(`sign in ${name}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(`${name}@e2e.local`);
    await page.getByLabel('Password').fill('integration-only');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/EOC White level/).first()).toBeVisible();
    await page.context().storageState({ path: `e2e/.auth/${name}.json` });
  });
}
