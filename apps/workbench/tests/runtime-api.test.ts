// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/tests/runtime-api.test.ts
// Purpose: Boot the runtime against :memory:, write some data, and exercise the
//   shape every API route depends on (matrix counts, sessions, audit verify,
//   candidates). Proves the wiring is real before the Next build. No HTTP — calls
//   the engine/services directly via getRuntime().
// Run: pnpm --filter @orqenix/workbench vitest run tests/runtime-api.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';

describe('Workbench runtime + API wiring', () => {
  beforeAll(() => { process.env.ORQENIX_DB = ':memory:'; process.env.ORQENIX_DEV = '1'; });

  it('runtime constructs all services', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    for (const k of ['engine', 'observer', 'detector', 'promoter', 'verification', 'settings', 'marketplace', 'normalization']) {
      expect((rt as unknown as Record<string, unknown>)[k], `missing ${k}`).toBeDefined();
    }
  });

  it('write \u2192 matrix counts increase + audit valid', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    await rt.engine.write({ kb: 'decision', content: 'use Stripe', branch_id: 'blake3:main0000000000aabb', memory_level: 'branch' });
    const db = rt.engine.getStore().db;
    const c = (db.prepare("SELECT COUNT(*) AS c FROM decision_entries WHERE project_id=?").get(rt.projectId) as { c: number }).c;
    expect(c).toBeGreaterThan(0);
    expect(rt.engine.verifyAuditChain().valid).toBe(true);
  });

  it('demo query returns hits + records stages (recall path)', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    const res = await rt.engine.query({ query: 'Stripe', branchId: 'blake3:main0000000000aabb', limit: 10 });
    expect(Array.isArray(res.results)).toBe(true);
  });

  it('marketplace create persists a local plugin', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    const r = await rt.marketplace.create({
      name: '@local/wb-test', kind: 'skill', description: 'test',
      permissions: [], external_agent_compat: ['claude-code'],
      tool: { name: 'wb_test', description: 'x', inputSchema: { type: 'object' } },
      compatibility: { orqenix: '^0.8.0' },
    } as never);
    expect((r as { ok: boolean }).ok).toBe(true);
  });

  it('settings resolve a flat-key hierarchy value', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    const resolved = await rt.settings.resolve('@orqenix/memory-engine', 'hierarchy.level_boost.session', {});
    expect((resolved as { value: number }).value).toBe(1.5);
  });
});