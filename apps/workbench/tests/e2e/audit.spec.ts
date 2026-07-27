// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTheme } from './helpers/theme';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('audit screen (light)', async ({ page }) => {
  await page.goto('/audit');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('audit-light.png');
});

test('audit screen (dark)', async ({ page }) => {
  await page.goto('/audit');
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('audit-dark.png');
});

test('audit Verify Chain button shows status indicator', async ({ page }) => {
  await page.goto('/audit');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const verifyBtn = page.locator('button:has-text("Verify Chain")').first();
  await verifyBtn.click();
  await page.waitForResponse((res) => res.url().includes('/api/audit') && res.status() === 200);
  await expect(page).toHaveScreenshot('audit-verified-light.png');
});

test('audit has no critical or serious a11y violations', async ({ page }) => {
  await page.goto('/audit');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const criticalSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect.soft(criticalSerious).toHaveLength(0);
});
