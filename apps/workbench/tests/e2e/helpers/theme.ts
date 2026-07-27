// SPDX-License-Identifier: Apache-2.0
import type { Page } from '@playwright/test';

/**
 * Toggle the workbench theme via class manipulation (matching next-themes
 * attribute="class" mode). Waits 300ms for CSS transitions to settle.
 */
export async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(300);
}
