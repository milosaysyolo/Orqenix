// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('GET /api/marketplace returns 200 with items array', async ({ request }) => {
  const res = await request.get('/api/marketplace');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty('items');
  expect(Array.isArray(body.items)).toBe(true);
});

test('POST /api/marketplace with action install adds a plugin', async ({ request }) => {
  const res = await request.post('/api/marketplace', {
    data: { action: 'install', name: '@local/e2e-test-plugin' },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.name).toBe('@local/e2e-test-plugin');
});

test('POST /api/marketplace with action uninstall removes a plugin', async ({ request }) => {
  // Install first
  await request.post('/api/marketplace', {
    data: { action: 'install', name: '@local/e2e-test-uninstall' },
  });

  const res = await request.post('/api/marketplace', {
    data: { action: 'uninstall', name: '@local/e2e-test-uninstall' },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('install and uninstall reflect in item count', async ({ request }) => {
  const before = await request.get('/api/marketplace');
  const beforeBody = await before.json();
  const initialCount = beforeBody.items.length;

  // Install
  await request.post('/api/marketplace', {
    data: { action: 'install', name: '@local/e2e-count-test' },
  });

  const afterInstall = await request.get('/api/marketplace');
  const afterInstallBody = await afterInstall.json();
  expect(afterInstallBody.items.length).toBe(initialCount + 1);

  // Uninstall
  await request.post('/api/marketplace', {
    data: { action: 'uninstall', name: '@local/e2e-count-test' },
  });

  const afterUninstall = await request.get('/api/marketplace');
  const afterUninstallBody = await afterUninstall.json();
  expect(afterUninstallBody.items.length).toBe(initialCount);
});
