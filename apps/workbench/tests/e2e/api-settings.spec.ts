// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('GET /api/settings returns 200 with groups array', async ({ request }) => {
  const res = await request.get('/api/settings');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  expect(body).toHaveProperty('groups');
  expect(Array.isArray(body.groups)).toBe(true);
});

test('each settings group has moduleId, phase, and settings array', async ({ request }) => {
  const res = await request.get('/api/settings');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  for (const group of body.groups) {
    expect(group).toHaveProperty('moduleId');
    expect(typeof group.moduleId).toBe('string');
    expect(group).toHaveProperty('phase');
    expect(typeof group.phase).toBe('number');
    expect(group).toHaveProperty('settings');
    expect(Array.isArray(group.settings)).toBe(true);
  }
});

test('POST /api/settings with action update modifies a setting', async ({ request }) => {
  const list = await request.get('/api/settings');
  const listBody = await list.json();
  expect(listBody.groups.length).toBeGreaterThan(0);
  expect(listBody.groups[0].settings.length).toBeGreaterThan(0);

  const group = listBody.groups[0];
  const firstKey = group.settings[0].key;

  const res = await request.post('/api/settings', {
    data: { action: 'update', moduleId: group.moduleId, key: firstKey, value: '__e2e_test_value__' },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.moduleId).toBe(group.moduleId);
  expect(body.key).toBe(firstKey);
});
