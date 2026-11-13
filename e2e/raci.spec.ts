import { expect, test } from '@playwright/test';

// RACI board (1.19, ADR-033): search, colour-coded duties, deep links, and the CDRRMO Head's
// online edits. Runs against the seeded Annex 1-F data (seed part 37_raci.sql).

test.describe('as a viewer', () => {
  test.use({ storageState: 'e2e/.auth/viewer.json' });

  test('raci: search shows the colour-coded board; a viewer cannot edit', async ({ page }) => {
    await page.goto('/raci');
    await expect(page.getByRole('heading', { name: 'RACI board' })).toBeVisible();
    // The six seeded matrices render with their activities.
    await expect(page.getByText('6.4 · State of Imminent Disaster RACI')).toBeVisible();
    await expect(page.getByText('DOC · Manual document review and approval')).toBeVisible();

    // Search by protocol code finds the activity and its duty chips.
    await page.getByLabel('Search the RACI board').fill('PR-PDRA');
    await expect(page.getByRole('heading', { name: 'Convene PDRA' })).toBeVisible();
    await expect(page.getByText('R · Responsible').first()).toBeVisible();
    await expect(page.getByText('A · Accountable').first()).toBeVisible();
    // The deep link back to the DRRM module is there.
    await expect(page.getByRole('link', { name: 'PR-PDRA' })).toBeVisible();

    // A viewer sees no edit affordances.
    await expect(page.getByRole('button', { name: 'Add' })).toHaveCount(0);

    // A warning shows on an activity that has no single Accountable (faithful to Annex 1-F).
    await page.getByLabel('Search the RACI board').fill('Review local recommendation');
    await expect(page.getByText('No Accountable')).toBeVisible();
  });
});

test.describe('as the CDRRMO Head', () => {
  test.use({ storageState: 'e2e/.auth/lead.json' });

  test('raci: the Head adds, edits and removes an assignment online', async ({ page }) => {
    await page.goto('/today');
    await expect(page.getByText('RACI board').first()).toBeVisible();

    await page.goto('/raci?q=Routine%20risk%20monitoring');
    await expect(page.getByRole('heading', { name: 'Routine risk monitoring' })).toBeVisible();

    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Add assignment' })).toBeVisible();
    await page.getByLabel('Who holds the duty').fill('PAGASA');
    await page.getByLabel(/C – Consulted/).check();
    await page.getByLabel('Scope note').fill('forecast advice');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Assignment added.')).toBeVisible();
    await expect(page.getByRole('button', { name: /PAGASA/ })).toBeVisible();

    await page.getByRole('button', { name: /PAGASA/ }).click();
    await expect(page.getByRole('dialog', { name: 'Edit assignment' })).toBeVisible();
    await page.getByLabel('Scope note').fill('forecast and flood advice');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Assignment updated.')).toBeVisible();
    await expect(page.getByText('(forecast and flood advice)')).toBeVisible();

    await page.getByRole('button', { name: /PAGASA/ }).click();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Assignment removed.')).toBeVisible();
    await expect(page.getByRole('button', { name: /PAGASA/ })).toHaveCount(0);
  });
});
