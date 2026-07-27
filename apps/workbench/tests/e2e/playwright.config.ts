// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:27420',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm --filter @orqenix/workbench dev',
    port: 27420,
    reuseExistingServer: true,
  },
  timeout: 30000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
});
