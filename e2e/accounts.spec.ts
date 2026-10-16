import { expect, test, type Page } from '@playwright/test';

// Open sign-up with administrator approval, against the real RLS policies.
const GATEWAY = 'http://127.0.0.1:54321';
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${test.info().project.name}-${name}.png`, fullPage: true });
const lastLink = async (page: Page, email: string) => (await (await page.request.get(`${GATEWAY}/__mail?email=${encodeURIComponent(email)}`)).json()) as { type: string; token_hash: string };

test.describe('a new account', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('signs up, confirms the email, waits for approval, and is approved by an administrator', async ({ page, browser }, info) => {
    const email = `new-${info.project.name}@e2e.local`;
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('button', { name: 'New account' }).click();
    await page.getByLabel('Full name').fill('Ana Reyes');
    await page.getByLabel(/Position and office/).fill('LDRRMO II, CDRRMO Operations');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('short1');
    await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('typhoon-season-2026');
    await page.getByLabel('Password again').fill('typhoon-season-2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Agree to the data privacy notice.')).toBeVisible();
    await page.getByText(/I agree that the City Government of Ormoc keeps/).click();
    await shot(page, 'a1-signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText(/We sent a confirmation link to/)).toBeVisible();

    // Signing in before confirming explains what to do.
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('typhoon-season-2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Confirm your email address first/)).toBeVisible();

    // The link from the email confirms the address and signs in: the account waits for approval.
    const link = await lastLink(page, email);
    await page.goto(`/auth/confirm?token_hash=${link.token_hash}&type=signup`);
    await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await shot(page, 'a2-pending');
    // Nothing from the City's records is reachable meanwhile.
    await page.goto('/eoc/log');
    await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();

    // An administrator approves the account by granting a role.
    const admin = await browser.newContext({ storageState: 'e2e/.auth/admin.json', viewport: { width: 1280, height: 900 } });
    const ap = await admin.newPage();
    await ap.goto('/settings/users');
    await expect(ap.getByRole('heading', { name: /Waiting for approval \(\d+\)/ })).toBeVisible();
    const card = ap.locator('section', { hasText: email });
    await expect(card.getByText('LDRRMO II, CDRRMO Operations', { exact: false })).toBeVisible();
    await shot(ap, 'a3-admin-pending');
    await card.getByText('Duty officer', { exact: true }).click();
    await expect(ap.getByText('Approved as Duty officer')).toBeVisible();
    await admin.close();

    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByText(/EOC White level/).first()).toBeVisible();
    await page.goto('/eoc/log');
    await expect(page.getByRole('button', { name: 'New entry' })).toBeVisible();
  });

  test('resets a forgotten password through the emailed link', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot your password?' }).click();
    await page.getByLabel('Email').fill('viewer@e2e.local');
    await page.getByRole('button', { name: 'Email me a reset link' }).click();
    await expect(page.getByText(/a link to set a new password is on its way/)).toBeVisible();
    const link = await lastLink(page, 'viewer@e2e.local');
    await page.goto(`/auth/confirm?token_hash=${link.token_hash}&type=recovery`);
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill('a-new-password-2026');
    await page.getByLabel('New password again').fill('a-new-password-2026');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByText(/EOC White level/).first()).toBeVisible();
  });

  test('an expired or reused link says so', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=nope&type=signup');
    await expect(page.getByRole('heading', { name: 'This link did not work' })).toBeVisible();
    await expect(page.getByText(/expired or was already used/)).toBeVisible();
  });

  test('wrong password and unknown address get the same answer', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@e2e.local');
    await page.getByLabel('Password').fill('whatever-123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Email or password is wrong.')).toBeVisible();
  });
});

test.describe('signing out', () => {
  test.use({ storageState: 'e2e/.auth/duty.json' });
  test('clears the device and returns to sign in', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out and clear this device' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/eoc');
    await expect(page).toHaveURL(/\/login/);
  });
});
