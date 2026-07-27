// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTheme } from './helpers/theme';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('agents orchestrator (light)', async ({ page }) => {
  await page.goto('/agents/orchestrator');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('agents-orchestrator-light.png');
});

test('agents orchestrator (dark)', async ({ page }) => {
  await page.goto('/agents/orchestrator');
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('agents-orchestrator-dark.png');
});

test('agents orchestrator has no critical or serious a11y violations', async ({ page }) => {
  await page.goto('/agents/orchestrator');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const criticalSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect.soft(criticalSerious).toHaveLength(0);
});
