import { defineConfig, devices } from '@playwright/test';

export const BASIC = 'http://localhost:4321/gen-bin/';
export const EMPTY = 'http://localhost:4322/gen-bin/';
export const LARGE = 'http://localhost:4323/gen-bin/';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '*.spec.ts',
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: { baseURL: BASIC, ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Builds all three marketplaces one after another, then serves them; ready once the last one answers.
  webServer: {
    command: 'node test/e2e/serve.mjs',
    url: LARGE,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
