import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${test.info().project.name}-${name}.png`, fullPage: true });
const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
});

test('assessment: evidence gate, scoring, dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('EOC White')).toBeVisible();
  await shot(page, '01-today');
  await page.goto('/assess');
  await page.getByRole('button', { name: 'Start the baseline' }).click();
  await page.getByRole('button', { name: 'Create cycle' }).click();
  await expect(page.getByRole('heading', { name: /Institutional assessment \d{4}/ })).toBeVisible();
  await shot(page, '02-cycle-empty');
  await page.getByRole('link', { name: /^A1 / }).first().click();
  await page.getByRole('link', { name: /A1\.1/ }).click();
  // Without evidence, scores above 0 are disabled.
  await expect(page.getByLabel(/^3 Compliant/)).toBeDisabled();
  await page.getByRole('button', { name: 'Add evidence' }).click();
  await page.getByLabel('Title').fill('EO creating the CDRRMO');
  await page.getByRole('button', { name: 'Add evidence' }).last().click();
  await expect(page.getByText('Supports up to 3', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^4 Advanced/)).toBeDisabled();
  await page.getByLabel(/^3 Compliant/).check();
  await page.getByLabel('Gap or remarks').fill('EO in force; functions mirror RA 10121 Sec. 12(c).');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('A1.1 saved')).toBeVisible();
  await shot(page, '03-indicator');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('A1.1 validated')).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByText('1 of 140 answered')).toBeVisible();
  await shot(page, '04-dashboard');
});

test('protocol run with required notes', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Duty officer').check();
  await page.goto('/protocols');
  await shot(page, '05-protocols');
  await page.getByRole('button', { name: /Warning dissemination/ }).click();
  await page.getByRole('button', { name: 'Start protocol' }).click();
  await expect(page.getByRole('heading', { name: 'Warning dissemination' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).first().click();
  await expect(page.getByText(/needs a note/)).toBeVisible();
  await page.getByLabel('Note').first().fill('PAGASA TCB #2 logged 06:10');
  await page.getByRole('button', { name: 'Done' }).first().click();
  await expect(page.getByText(/^Done /).first()).toBeVisible();
  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByText(/still open/)).toBeVisible();
  await shot(page, '06-run');
});

test('EOC level, logbook, anticipatory action and funds', async ({ page }) => {
  await page.goto('/eoc');
  await page.getByRole('button', { name: 'Change level' }).click();
  await page.getByLabel(/^Blue/).check();
  await page.getByLabel('Reason').fill('PAGASA TCWS 1 raised over Leyte');
  await page.getByRole('button', { name: 'Change level' }).last().click();
  await expect(page.getByText('EOC level is now Blue')).toBeVisible();
  await expect(page.getByText(/EOC Blue/).first()).toBeVisible();
  await page.getByLabel('New logbook entry').fill('Advisory sent to riverine barangays by SMS and radio');
  await page.getByRole('button', { name: 'Add to logbook' }).click();
  await shot(page, '07-eoc-blue');

  await page.goto('/eoc/aa/pdra/new');
  await page.getByLabel('Forecast source').fill('PAGASA Severe Weather Bulletin #2');
  // 48 hours: a declaration is not available.
  const in48 = await page.evaluate(() => { const d = new Date(Date.now() + 48 * 3600e3 + 8 * 3600e3); return d.toISOString().slice(0, 16); });
  await page.getByLabel('Expected impact').fill(in48);
  await expect(page.getByLabel(/Request a State of Imminent Disaster/)).toBeDisabled();
  const in100 = await page.evaluate(() => { const d = new Date(Date.now() + 100 * 3600e3 + 8 * 3600e3); return d.toISOString().slice(0, 16); });
  await page.getByLabel('Expected impact').fill(in100);
  await page.getByLabel(/Request a State of Imminent Disaster/).check();
  await page.getByLabel('Basis for the request').fill('Severe winds and storm surge for coastal and riverine barangays');
  await shot(page, '08-pdra');
  await page.getByRole('button', { name: 'Record PDRA' }).click();
  await expect(page.getByRole('heading', { name: /State of Imminent Disaster/ })).toBeVisible();
  await page.getByRole('button', { name: 'Record request sent' }).click();
  await expect(page.getByText('RDRRMC recommendation due').first()).toBeVisible();
  await page.getByLabel('Recommendation reference').fill('RDRRMC VIII Res. 2026-15');
  await page.getByRole('button', { name: 'Recommended', exact: true }).click();
  await page.getByLabel('Executive Order number').fill('EO No. 2026-031');
  await page.getByRole('button', { name: 'Record declaration' }).click();
  await expect(page.getByText(/anticipatory actions loaded/)).toBeVisible();
  await expect(page.getByText('State of Imminent Disaster in force')).toBeVisible();
  await shot(page, '09-declaration');

  await page.goto('/eoc/aa/funds');
  await page.getByRole('button', { name: 'Set allocation' }).click();
  await page.getByLabel(/Total LDRRMF/).fill('10000000');
  await page.getByLabel(/Set aside for anticipatory action/).fill('800000');
  await expect(page.getByText('Above the cap of ₱700,000.00.')).toBeVisible();
  await page.getByLabel(/Set aside for anticipatory action/).fill('700000');
  await page.getByRole('button', { name: 'Save allocation' }).click();
  await expect(page.getByText('₱0.00 of ₱210,000.00')).toBeVisible();
  await shot(page, '10-funds');
});

test('library and traceability', async ({ page }) => {
  await page.goto('/library');
  await shot(page, '11-library');
  await page.getByRole('link', { name: /EOC Ch\.2 Concept of Operations/ }).click();
  await expect(page.getByText('Requirements this section must meet')).toBeVisible();
  await shot(page, '12-document');
  await page.goto('/library/trace');
  await page.getByLabel('Theme').selectOption('RA 12287 / anticipatory action');
  await expect(page.getByText(/22 indicator\(s\)/)).toBeVisible();
  await shot(page, '13-trace');
});

test.afterAll(() => {
  const real = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
  expect(real, real.join('\n')).toEqual([]);
});

test('dark mode keeps status text readable', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('/settings');
  await page.getByLabel('Duty officer').check();
  await page.goto('/protocols');
  await page.getByRole('button', { name: /Duty shift handover/ }).click();
  await page.getByRole('button', { name: 'Start protocol' }).click();
  await page.getByRole('button', { name: 'Done' }).first().click();
  const badge = page.locator('span.bg-ok').first();
  await expect(badge).toBeVisible();
  // computed contrast of the checkmark on the done circle
  const [fg, bg] = await badge.evaluate((el) => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
  const lum = (c: string) => { const [r, g, b] = c.match(/\d+/g)!.slice(0, 3).map((v) => { const x = Number(v) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  expect((a! + 0.05) / (b! + 0.05)).toBeGreaterThan(4.5);
  await page.screenshot({ path: `test-results/shots/dark-run.png`, fullPage: false });
  await ctx.close();
});
