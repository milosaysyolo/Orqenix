// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('GET /api/sessions returns 200 with sessions array', async ({ request }) => {
  const res = await request.get('/api/sessions');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty('sessions');
  expect(Array.isArray(body.sessions)).toBe(true);
});

test('POST /api/sessions with action start creates a session', async ({ request }) => {
  const res = await request.post('/api/sessions', {
    data: { action: 'start', agentName: 'test-runner', agentPlatform: 'playwright' },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty('ok');
  expect(body.ok).toBe(true);
  expect(body).toHaveProperty('session');
  expect(body.session).toHaveProperty('session_id');
});

test('POST /api/sessions with action pause pauses a session', async ({ request }) => {
  const create = await request.post('/api/sessions', {
    data: { action: 'start', agentName: 'test-runner', agentPlatform: 'playwright' },
  });
  const { session } = await create.json();

  const res = await request.post('/api/sessions', {
      data: { action: 'pause', id: session.session_id },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('POST /api/sessions with action abort deletes a session', async ({ request }) => {
  const create = await request.post('/api/sessions', {
    data: { action: 'start', agentName: 'test-runner', agentPlatform: 'playwright' },
  });
  const { session } = await create.json();

  const res = await request.post('/api/sessions', {
      data: { action: 'abort', id: session.session_id },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('full session lifecycle via action dispatch', async ({ request }) => {
  // Create
  const create = await request.post('/api/sessions', {
    data: { action: 'start', agentName: 'lifecycle-test', agentPlatform: 'playwright' },
  });
  expect(create.ok()).toBe(true);
  const { session } = await create.json();
  expect(session.session_id).toBeTruthy();

  // Read — confirm in list
  const list = await request.get('/api/sessions');
  expect(list.ok()).toBe(true);
  const listBody = await list.json();
  expect(listBody.sessions.some((s: Record<string, unknown>) => s.session_id === session.session_id)).toBe(true);

  // Pause
  const pause = await request.post('/api/sessions', {
      data: { action: 'pause', id: session.session_id },
  });
  expect(pause.ok()).toBe(true);

  // Abort (delete)
  const abort = await request.post('/api/sessions', {
      data: { action: 'abort', id: session.session_id },
  });
  expect(abort.ok()).toBe(true);
});
