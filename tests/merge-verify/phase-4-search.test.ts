// SPDX-License-Identifier: Apache-2.0
// PHASE 4 SMOKE: hybrid search (vector + BM25 + trigram + recency) + weights.

import { describe, it, expect } from 'vitest';
import { HybridSearch, DEFAULT_WEIGHTS } from '@orqenix/memory-engine';
import { MemoryEngine } from '@orqenix/memory-engine';

const PROJECT = 'blake3:phase4test';
const BRANCH = 'blake3:main';

describe('PHASE 4 — Hybrid Search', () => {
  it('Phase 4 weights are intact (0.5/0.3/0.1/0.1)', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ vector: 0.5, bm25: 0.3, trigram: 0.1, recency: 0.1 });
  });

  it('keyword search finds relevant entries', async () => {
    const engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    try {
      await engine.write({ kb: 'decision', content: 'use Stripe for billing integration', branch_id: BRANCH, memory_level: 'branch' });
      await engine.write({ kb: 'decision', content: 'use GitHub OAuth for login', branch_id: BRANCH, memory_level: 'branch' });
      const result = await engine.query({ query: 'billing', kbs: ['decision'], branchId: BRANCH, limit: 10 });
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.entry.content).toContain('Stripe');
    } finally {
      engine.close();
    }
  });
});
