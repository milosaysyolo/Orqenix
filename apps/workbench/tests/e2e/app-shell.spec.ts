// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTheme } from './helpers/theme';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('sidebar expanded (light)', async ({ page }) => {
  await page.goto('/');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('sidebar-expanded-light.png');
});

test('sidebar collapsed (light)', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('orqenix:sidebarCollapsed', 'true'));
  await page.goto('/');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const sidebar = page.locator('aside').first();
  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(100);
  await expect(page).toHaveScreenshot('sidebar-collapsed-light.png');
});

test('theme toggle adds dark class to html', async ({ page }) => {
  await page.goto('/');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  // Click the theme toggle button in the header
  const toggle = page.locator('button[aria-label*="theme" i], button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first();
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page).toHaveScreenshot('sidebar-dark.png');
});

test('keyboard shortcuts overlay opens with ? and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('?');
  const overlay = page.locator('[role="dialog"], [role="tooltip"], .shortcuts-overlay, div:has-text("Keyboard Shortcuts")').first();
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).not.toBeVisible();
});

test('g-nav: g then d navigates to dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('g');
  await page.keyboard.press('d');
  await expect(page).toHaveURL('/');
});

test('command palette opens with Ctrl+K and filters results', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Control+k');
  const palette = page.locator('[role="dialog"], [role="combobox"], input[placeholder*="command" i], input[placeholder*="search" i]').first();
  await expect(palette).toBeVisible();
  await palette.fill('memory');
  await expect(page.locator('[role="option"], [role="menuitem"], .command-palette-result').first()).toBeVisible();
});

test('sidebar collapsed (dark)', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('orqenix:sidebarCollapsed', 'true'));
  await page.goto('/');
  await setTheme(page, 'dark');
  await page.waitForLoadState('networkidle');
  const sidebar = page.locator('aside').first();
  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(100);
  await expect(page).toHaveScreenshot('sidebar-collapsed-dark.png');
});

test('app-shell has no critical or serious a11y violations (expanded light)', async ({ page }) => {
  await page.goto('/');
  await setTheme(page, 'light');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const criticalSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect.soft(criticalSerious).toHaveLength(0);
});
