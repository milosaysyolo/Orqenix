// SPDX-License-Identifier: Apache-2.0
// PHASE 1-2 SMOKE: Memory engine core works — write + read + matrix.
// If this fails post-merge, the foundation is broken.

import { describe, it, expect, afterEach } from 'vitest';
import { MemoryEngine } from '@orqenix/memory-engine';

const PROJECT = 'blake3:phase12test';
const BRANCH = 'blake3:main';

describe('PHASE 1-2 — Memory Engine Core', () => {
  let engine: MemoryEngine;
  afterEach(() => engine?.close());

  it('opens an engine + writes to all 4 KBs', async () => {
    engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    for (const kb of ['chat', 'code', 'decision', 'lesson'] as const) {
      const entry = await engine.write({
        kb, content: `${kb} entry`, branch_id: BRANCH, memory_level: 'branch',
      });
      expect(entry.id).toBeTruthy();
      expect(entry.kb).toBe(kb);
    }
  });

  it('reads back written content (4x4 matrix intact)', async () => {
    engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    const written = await engine.write({
      kb: 'decision', content: 'use Stripe for billing', branch_id: BRANCH, memory_level: 'branch',
    });
    const content = engine.fetchContent('decision', written.id);
    expect(content).toBe('use Stripe for billing');
  });

  it('tier T1-T4 are all writable', async () => {
    engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    for (const tier of ['T1', 'T2', 'T3', 'T4'] as const) {
      const e = await engine.write({ kb: 'chat', content: tier, tier, branch_id: BRANCH, memory_level: 'branch' });
      expect(e.tier).toBe(tier);
    }
  });
});
