// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { seedWorkbenchData } from './helpers/seed';

test.beforeAll(async () => { await seedWorkbenchData(); });

test('GET /api/audit returns 200 with expected shape', async ({ request }) => {
  const res = await request.get('/api/audit');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  expect(body).toHaveProperty('entries');
  expect(Array.isArray(body.entries)).toBe(true);

  expect(body).toHaveProperty('verification');
  expect(body.verification).toHaveProperty('valid');
  expect(typeof body.verification.valid).toBe('boolean');
  expect(body.verification).toHaveProperty('entriesVerified');
  expect(typeof body.verification.entriesVerified).toBe('number');
});

test('each audit entry has ts, hash, and valid properties', async ({ request }) => {
  const res = await request.get('/api/audit');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  for (const entry of body.entries) {
    expect(entry).toHaveProperty('ts');
    expect(typeof entry.ts).toBe('string');
    expect(entry).toHaveProperty('hash');
    expect(typeof entry.hash).toBe('string');
    expect(entry).toHaveProperty('valid');
    expect(typeof entry.valid).toBe('boolean');
  }
});

test('verification.entriesVerified matches entries.length', async ({ request }) => {
  const res = await request.get('/api/audit');
  expect(res.ok()).toBe(true);

  const body = await res.json();
  expect(body.verification.entriesVerified).toBe(body.entries.length);
});
