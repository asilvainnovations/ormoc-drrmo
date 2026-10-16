import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build, connected to a local database with every
// migration and RLS policy (scripts/e2e_test.sh starts it). Accounts sign in once in auth.setup.ts.
const chromium = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const lead = 'e2e/.auth/lead.json';
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,                      // one shared database: run journeys in order
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', launchOptions: chromium ? { executablePath: chromium } : {} },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { browserName: 'chromium' } },
    { name: 'phone', dependencies: ['setup'], use: { ...devices['Pixel 7'], browserName: 'chromium', storageState: lead } },
    { name: 'desktop', dependencies: ['setup'], use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium', storageState: lead } },
  ],
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
});
