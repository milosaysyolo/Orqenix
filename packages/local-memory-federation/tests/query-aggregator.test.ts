// SPDX-License-Identifier: Apache-2.0
// Tests for QueryAggregator
//
// Verifies INV-12 (parallel query, no short-circuit) compliance.

import { describe, it, expect } from 'vitest';
import { QueryAggregator } from '../src/query-aggregator';
import type { IProjectIndex } from '../src/project-index';
import type {
  CandidatePreview,
  CrossProjectQuery,
  KbKind,
  ProjectId,
} from '../src/types';

class MockIndex implements IProjectIndex {
  constructor(
    private readonly id: ProjectId,
    private readonly name: string,
    private readonly response: CandidatePreview[],
    private readonly delayMs = 0,
    private readonly shouldThrow = false
  ) {}

  getProjectId(): ProjectId {
    return this.id;
  }

  getProjectName(): string {
    return this.name;
  }

  async query(): Promise<{ candidates: CandidatePreview[] }> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    if (this.shouldThrow) {
      throw new Error(`Mock failure for ${this.id}`);
    }
    return { candidates: this.response };
  }

  async fetchFullContent(): Promise<string | null> {
    return null;
  }
}

function makeCandidate(
  sourceId: ProjectId,
  id: string,
  relevance: number,
  kind: KbKind = 'decision'
): CandidatePreview {
  return {
    id,
    source_project_id: sourceId,
    source_project_name: 'mock',
    kind,
    preview: 'preview text',
    relevance,
    created_at: '2026-06-11T12:00:00Z',
    requires_approval: true,
  };
}

const QUERY: CrossProjectQuery = {
  query: 'auth',
  limit: 100,
  skipCache: false,
};

const PA = 'blake3:aaaaaaaa00000000' as ProjectId;
const PB = 'blake3:bbbbbbbb00000000' as ProjectId;
const PC = 'blake3:cccccccc00000000' as ProjectId;

describe('QueryAggregator', () => {
  it('aggregates candidates from multiple projects', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [
        new MockIndex(PA, 'A', [
          makeCandidate(PA, 'a1', 0.9),
          makeCandidate(PA, 'a2', 0.5),
        ]),
        new MockIndex(PB, 'B', [makeCandidate(PB, 'b1', 0.8)]),
      ],
    });

    expect(result.candidates).toHaveLength(3);
    expect(result.projectsQueried).toEqual([PA, PB]);
    expect(result.projectsWithResults).toEqual([PA, PB]);
  });

  it('sorts candidates by relevance descending', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [
        new MockIndex(PA, 'A', [makeCandidate(PA, 'low', 0.3)]),
        new MockIndex(PB, 'B', [makeCandidate(PB, 'high', 0.95)]),
        new MockIndex(PC, 'C', [makeCandidate(PC, 'mid', 0.6)]),
      ],
    });

    expect(result.candidates.map((c) => c.id)).toEqual(['high', 'mid', 'low']);
  });

  it('applies the limit after sorting', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: { ...QUERY, limit: 2 },
      indexes: [
        new MockIndex(PA, 'A', [
          makeCandidate(PA, 'a1', 0.1),
          makeCandidate(PA, 'a2', 0.9),
          makeCandidate(PA, 'a3', 0.5),
        ]),
      ],
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.id).toBe('a2');
    expect(result.candidates[1]?.id).toBe('a3');
  });

  it('runs queries in parallel (not sequentially)', async () => {
    const agg = new QueryAggregator();
    const startMs = Date.now();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [
        new MockIndex(PA, 'A', [makeCandidate(PA, 'a1', 0.5)], 100),
        new MockIndex(PB, 'B', [makeCandidate(PB, 'b1', 0.5)], 100),
        new MockIndex(PC, 'C', [makeCandidate(PC, 'c1', 0.5)], 100),
      ],
    });
    const elapsed = Date.now() - startMs;

    expect(result.candidates).toHaveLength(3);
    // Parallel: should complete in ~100ms, not 300ms (sequential)
    expect(elapsed).toBeLessThan(250);
  });

  it('INV-12 compliance: failure of one project does not short-circuit others', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [
        new MockIndex(PA, 'A', [makeCandidate(PA, 'a1', 0.5)]),
        new MockIndex(PB, 'B', [], 0, true), // throws
        new MockIndex(PC, 'C', [makeCandidate(PC, 'c1', 0.7)]),
      ],
    });

    // Successful projects still contribute
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.id).sort()).toEqual(['a1', 'c1']);
    // All 3 projects are listed as queried (PB included even though it errored)
    expect(result.projectsQueried).toEqual([PA, PB, PC]);
    // Only successful projects appear in projectsWithResults
    expect(result.projectsWithResults).toEqual([PA, PC]);
  });

  it('returns empty result when no indexes provided', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [],
    });

    expect(result.candidates).toEqual([]);
    expect(result.projectsQueried).toEqual([]);
  });

  it('breaks relevance ties by created_at (newest first)', async () => {
    const agg = new QueryAggregator();
    const result = await agg.aggregate({
      query: QUERY,
      indexes: [
        new MockIndex(PA, 'A', [
          {
            ...makeCandidate(PA, 'older', 0.5),
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            ...makeCandidate(PA, 'newer', 0.5),
            created_at: '2026-06-01T00:00:00Z',
          },
        ]),
      ],
    });

    expect(result.candidates.map((c) => c.id)).toEqual(['newer', 'older']);
  });
});
