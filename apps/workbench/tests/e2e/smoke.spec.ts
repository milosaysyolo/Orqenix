// SPDX-License-Identifier: Apache-2.0
// Smoke test — empty state dashboard, no seed data dependency.
import { test, expect } from '@playwright/test';

test('dashboard loads with correct title (empty state)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/dashboard/i);
});

test('dashboard empty state matches baseline (light)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('smoke-dashboard-empty-light.png');
});
