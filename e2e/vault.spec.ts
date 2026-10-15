import { expect, test } from '@playwright/test';

test('vault: add a document for an indicator, see it in Document Review and on the indicator', async ({ page }) => {
  await page.goto('/vault/review');
  await expect(page.getByText(/0 of \d+ Document Review indicators have at least one document/)).toBeVisible();
  await page.getByRole('link', { name: /A4\.6/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Add a document' })).toBeVisible();
  await expect(page.getByLabel('Indicators it can evidence')).toHaveValue('A4.6');
  await page.getByLabel('Title').fill('LDRRMF Investment Plan 2026 with anticipatory action line');
  await page.getByLabel('Type', { exact: true }).selectOption('plan');
  await page.getByLabel(/Law or guideline/).selectOption('JMC 2013-1');
  await page.getByLabel('Indicators it can evidence').fill('A4.6, A3.5, Z9.9');
  await expect(page.getByText('Unknown: Z9.9')).toBeVisible();
  await page.getByLabel('Indicators it can evidence').fill('A4.6, A3.5');
  await page.getByLabel('File').setInputFiles({ name: 'ldrrmfip-2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await page.getByRole('button', { name: 'Add to vault' }).click();
  await expect(page.getByRole('heading', { name: 'LDRRMF Investment Plan 2026 with anticipatory action line' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^A3\.5/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open file' })).toBeVisible();

  await page.goto('/vault/review');
  await expect(page.getByText(/2 of \d+ Document Review indicators have at least one document/)).toBeVisible();
  await page.goto('/vault?ref=JMC%202013-1');
  await expect(page.getByRole('link', { name: /LDRRMF Investment Plan 2026/ })).toBeVisible();
});

test('references: a citation opens a plain-language note', async ({ page }) => {
  await page.goto('/vault/references');
  await expect(page.getByText('Republic Act No. 10121, the Philippine Disaster Risk Reduction and Management Act of 2010')).toBeVisible();
  await page.goto('/library/requirements');
  const term = page.getByRole('button', { name: 'RA 10173' }).first();
  await term.click();
  const note = page.getByRole('dialog', { name: /Data Privacy Act of 2012/ });
  await expect(note).toBeVisible();
  await expect(note).toContainText('The official text governs.');
  await page.keyboard.press('Escape');
  await expect(note).toHaveCount(0);
});

test('the vault is closed to roles outside the list', async ({ page }) => {
  await page.goto('/settings');
  for (const r of ['CDRRMO Head', 'EOC Manager', 'Assessor', 'Validator']) await page.getByLabel(new RegExp(`^${r}`)).uncheck();
  await page.getByLabel(/^Viewer/).check();
  await page.goto('/vault');
  await expect(page.getByText('Not available for your role')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vault' })).toHaveCount(0);
});
