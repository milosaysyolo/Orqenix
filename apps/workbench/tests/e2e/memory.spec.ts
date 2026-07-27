// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTheme } from './helpers/theme';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('memory screen (light)', async ({ page }) => {
  await page.goto('/memory');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('memory-light.png');
});

test('memory screen (dark)', async ({ page }) => {
  await page.goto('/memory');
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('memory-dark.png');
});

test('memory has no critical or serious a11y violations', async ({ page }) => {
  await page.goto('/memory');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const criticalSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect.soft(criticalSerious).toHaveLength(0);
});
