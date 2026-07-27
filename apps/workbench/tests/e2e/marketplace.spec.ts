// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTheme } from './helpers/theme';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('marketplace plugin list (light)', async ({ page }) => {
  await page.goto('/marketplace');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('marketplace-list-light.png');
});

test('marketplace plugin detail (light)', async ({ page }) => {
  await page.goto('/marketplace');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const pluginCard = page.locator('a, button, [role="button"]').filter({ hasText: /plugin|@local/i }).first();
  await pluginCard.click();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('marketplace-detail-light.png');
});

test('marketplace plugin detail (dark)', async ({ page }) => {
  await page.goto('/marketplace');
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  const pluginCard = page.locator('a, button, [role="button"]').filter({ hasText: /plugin|@local/i }).first();
  await pluginCard.click();
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('marketplace-detail-dark.png');
});

test('marketplace has no critical or serious a11y violations', async ({ page }) => {
  await page.goto('/marketplace');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const criticalSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect.soft(criticalSerious).toHaveLength(0);
});
