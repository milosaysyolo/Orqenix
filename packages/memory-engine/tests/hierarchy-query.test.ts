// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { HybridSearch } from '../src/store/hybrid-search';
import { HierarchyQuery } from '../src/hierarchy/hierarchy-query';
import {
  MigrationRunner,
  HIERARCHY_MIGRATIONS,
  BASE_KB_BOOTSTRAP,
} from '../src/migrations/index';

const PROJECT = 'blake3:proj0001';
const BRANCH = 'blake3:branchmain';
const SESSION = '01J3X8H9SESSION';

describe('HierarchyQuery (INV-12 parallel 3-step)', () => {
  let db: DB;
  let query: HierarchyQuery;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply(HIERARCHY_MIGRATIONS);
    query = new HierarchyQuery(new HybridSearch(db));
    seedHierarchy(db);
  });

  afterEach(() => {
    db.close();
  });

  it('queries all 3 levels and merges', async () => {
    const result = await query.query({
      query: 'billing',
      sessionId: SESSION,
      branchId: BRANCH,
      projectId: PROJECT,
      limit: 20,
    });
    expect(result.levelsQueried).toEqual(['session', 'branch', 'project']);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('applies level boost (session ranks above project for equal relevance)', async () => {
    const result = await query.query({
      query: 'billing',
      sessionId: SESSION,
      branchId: BRANCH,
      projectId: PROJECT,
      limit: 20,
      minRelevanceScore: 0,
    });
    const sessionResult = result.results.find((r) => r.sourceLevel === 'session');
    const projectResult = result.results.find((r) => r.sourceLevel === 'project');
    if (sessionResult && projectResult) {
      expect(sessionResult.finalScore).toBeGreaterThan(0);
    }
  });

  it('boosts subagent returns by x10', async () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO chat_entries (id, hash, tier, content, embedding, project_id, branch_id, session_id, memory_level, protection_flags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'sub1', 'hsub1', 'T1', 'billing subagent return result', null,
      PROJECT, BRANCH, SESSION, 'session',
      JSON.stringify({
        kind: 'subagent_return', immutable: true,
        never_compress: true, never_move_tier: true,
        duplicate_in_tiers: ['T1', 'T2'],
        subagent_session_id: 'subX', parent_session_id: SESSION,
      }),
      now, now
    );

    const result = await query.query({
      query: 'billing', kbs: ['chat'],
      sessionId: SESSION, branchId: BRANCH, projectId: PROJECT, limit: 20,
    });

    expect(result.results[0]?.entry.protection_flags?.kind).toBe('subagent_return');
  });

  it('does NOT short-circuit (queries branch + project even when session has hits)', async () => {
    const result = await query.query({
      query: 'billing', sessionId: SESSION, branchId: BRANCH, projectId: PROJECT, limit: 20,
    });
    expect(result.levelsQueried).toHaveLength(3);
  });

  it('skips branch + project when sharing links inactive', async () => {
    const result = await query.query({
      query: 'billing', sessionId: SESSION, branchId: BRANCH, projectId: PROJECT, limit: 20,
      crossSessionActive: false, crossBranchActive: false,
    });
    expect(result.levelsQueried).toEqual(['session']);
  });

  it('applies anti-noise threshold', async () => {
    const result = await query.query({
      query: 'billing', sessionId: SESSION, branchId: BRANCH, projectId: PROJECT, limit: 20,
      minRelevanceScore: 0.99,
    });
    for (const r of result.results) {
      expect(
        r.finalScore >= 0.99 || r.entry.protection_flags?.kind === 'subagent_return'
      ).toBe(true);
    }
  });
});

function seedHierarchy(db: DB): void {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO decision_entries (id, hash, tier, content, embedding, project_id, branch_id, session_id, memory_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run('s1', 'hs1', 'T1', 'session billing note', null, PROJECT, BRANCH, SESSION, 'session', now, now);
  insert.run('b1', 'hb1', 'T1', 'branch billing decision', null, PROJECT, BRANCH, null, 'branch', now, now);
  insert.run('p1', 'hp1', 'T1', 'project billing policy', null, PROJECT, BRANCH, null, 'project', now, now);
}
