// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('GET /api/dashboard returns 200 with expected shape', async ({ request }) => {
  const res = await request.get('/api/dashboard');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  expect(body).toHaveProperty('projectId');
  expect(typeof body.projectId).toBe('string');

  expect(body).toHaveProperty('matrix');
  expect(typeof body.matrix).toBe('object');

  expect(body).toHaveProperty('totalEntries');
  expect(typeof body.totalEntries).toBe('number');

  expect(body).toHaveProperty('sessions');
  expect(body.sessions).toHaveProperty('active');
  expect(typeof body.sessions.active).toBe('number');
  expect(body.sessions).toHaveProperty('total');
  expect(typeof body.sessions.total).toBe('number');

  expect(body).toHaveProperty('auditValid');
  expect(typeof body.auditValid).toBe('boolean');
});

test('GET /api/dashboard engineStatus indicates system state', async ({ request }) => {
  const res = await request.get('/api/dashboard');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  expect(body).toHaveProperty('engineStatus');
  expect(['real', 'demo']).toContain(body.engineStatus);
});
