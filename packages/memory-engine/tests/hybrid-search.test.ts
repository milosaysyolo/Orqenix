// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { HybridSearch, DEFAULT_WEIGHTS } from '../src/store/hybrid-search';
import {
  MigrationRunner,
  HIERARCHY_MIGRATIONS,
  BASE_KB_BOOTSTRAP,
} from '../src/migrations/index';

const PROJECT = 'blake3:proj0001';
const BRANCH = 'blake3:branchmain';

describe('HybridSearch', () => {
  let db: DB;
  let search: HybridSearch;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply(HIERARCHY_MIGRATIONS);
    search = new HybridSearch(db);
    seedEntries(db);
  });

  afterEach(() => {
    db.close();
  });

  it('finds entries by keyword (BM25)', () => {
    const results = search.search({
      query: 'stripe billing',
      kbs: ['decision'],
      branchId: BRANCH,
      memoryLevel: 'branch',
      projectId: PROJECT,
      limit: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.entry.content).toContain('Stripe');
  });

  it('scores higher tier entries with tier boost', () => {
    const results = search.search({
      query: 'billing',
      kbs: ['decision'],
      branchId: BRANCH,
      memoryLevel: 'branch',
      projectId: PROJECT,
      limit: 10,
    });
    const t1Result = results.find((r) => r.entry.tier === 'T1');
    const t4Result = results.find((r) => r.entry.tier === 'T4');
    if (t1Result && t4Result) {
      expect(t1Result.rawScore).toBeGreaterThanOrEqual(t4Result.rawScore);
    }
  });

  it('respects scope filter (branch level only)', () => {
    const results = search.search({
      query: 'billing',
      kbs: ['decision'],
      branchId: BRANCH,
      memoryLevel: 'branch',
      projectId: PROJECT,
      limit: 100,
    });
    for (const r of results) {
      expect(r.entry.memory_level).toBe('branch');
    }
  });

  it('returns empty for non-matching query', () => {
    const results = search.search({
      query: 'quantum teleportation flux capacitor',
      kbs: ['decision'],
      branchId: BRANCH,
      memoryLevel: 'branch',
      projectId: PROJECT,
      limit: 10,
    });
    const highScore = results.filter((r) => r.rawScore > 0.3);
    expect(highScore.length).toBe(0);
  });

  it('computes vector similarity when embeddings present', () => {
    const queryEmbedding = new Float32Array([1, 0, 0]);
    const results = search.search({
      query: 'vector test',
      queryEmbedding,
      kbs: ['code'],
      branchId: BRANCH,
      memoryLevel: 'branch',
      projectId: PROJECT,
      limit: 10,
    });
    const withVector = results.find((r) => r.scores.vector > 0);
    expect(withVector).toBeDefined();
  });

  it('uses Phase 4 default weights (0.5/0.3/0.1/0.1)', () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      vector: 0.5,
      bm25: 0.3,
      trigram: 0.1,
      recency: 0.1,
    });
  });
});

function seedEntries(db: DB): void {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO decision_entries (id, hash, tier, content, embedding, project_id, branch_id, session_id, memory_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run('d1', 'h1', 'T1', 'Use Stripe for billing integration', null, PROJECT, BRANCH, null, 'branch', now, now);
  insert.run('d2', 'h2', 'T4', 'Old billing decision using PayPal', null, PROJECT, BRANCH, null, 'branch', now, now);
  insert.run('d3', 'h3', 'T2', 'Authentication via GitHub OAuth', null, PROJECT, BRANCH, null, 'branch', now, now);
  insert.run('d4', 'h4', 'T1', 'Project-level billing policy', null, PROJECT, BRANCH, null, 'project', now, now);

  const codeEmbed = new Float32Array([1, 0, 0]);
  const embedBuf = Buffer.from(codeEmbed.buffer);
  db.prepare(
    `INSERT INTO code_entries (id, hash, tier, content, embedding, project_id, branch_id, session_id, memory_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('c1', 'hc1', 'T1', 'vector test code', embedBuf, PROJECT, BRANCH, null, 'branch', now, now);
}
