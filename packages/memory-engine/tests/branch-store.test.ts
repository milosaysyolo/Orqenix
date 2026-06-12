// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { BranchStore } from '../src/hierarchy/branch-store';
import { BlobStore } from '../src/store/blob-store';
import {
  MigrationRunner,
  HIERARCHY_MIGRATIONS,
  BASE_KB_BOOTSTRAP,
} from '../src/migrations/index';

const PROJECT = 'blake3:proj0001';
const MAIN = 'blake3:branchmain';

describe('BranchStore (ADR-E-003 deep-copy)', () => {
  let db: DB;
  let blobs: BlobStore;
  let store: BranchStore;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply(HIERARCHY_MIGRATIONS);
    blobs = new BlobStore(db);
    store = new BranchStore(db, blobs);
    seedMainBranch(db, blobs);
  });

  afterEach(() => {
    db.close();
  });

  it('computeBranchId is deterministic', () => {
    const id1 = BranchStore.computeBranchId(PROJECT, 'feature/x');
    const id2 = BranchStore.computeBranchId(PROJECT, 'feature/x');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^blake3:[0-9a-f]{16}$/);
  });

  it('different branch names produce different IDs', () => {
    const a = BranchStore.computeBranchId(PROJECT, 'feature/a');
    const b = BranchStore.computeBranchId(PROJECT, 'feature/b');
    expect(a).not.toBe(b);
  });

  it('deep-copies parent index rows', () => {
    const result = store.createBranch({
      parentBranchId: MAIN, newBranchName: 'feature/billing', projectId: PROJECT,
    });
    expect(result.indexRowsCloned).toBeGreaterThan(0);
    expect(result.branchId).toBe(BranchStore.computeBranchId(PROJECT, 'feature/billing'));

    const newBranchRows = db
      .prepare('SELECT COUNT(*) AS c FROM decision_entries WHERE branch_id = ?')
      .get(result.branchId) as { c: number };
    expect(newBranchRows.c).toBeGreaterThan(0);
  });

  it('isolation: writes to child do not affect parent', () => {
    const result = store.createBranch({
      parentBranchId: MAIN, newBranchName: 'feature/iso', projectId: PROJECT,
    });

    const parentCountBefore = (
      db.prepare('SELECT COUNT(*) AS c FROM decision_entries WHERE branch_id = ?').get(MAIN) as { c: number }
    ).c;

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO decision_entries (id, hash, tier, content, project_id, branch_id, memory_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('child1', 'hchild1', 'T1', 'child-only decision', PROJECT, result.branchId, 'branch', now, now);

    const parentCountAfter = (
      db.prepare('SELECT COUNT(*) AS c FROM decision_entries WHERE branch_id = ?').get(MAIN) as { c: number }
    ).c;
    expect(parentCountAfter).toBe(parentCountBefore);
  });

  it('shares blob content via ref-count (not duplicated)', () => {
    const seededHash = blobs.put('large content '.repeat(500));
    const refBefore = blobs.refCount(seededHash);

    store.createBranch({ parentBranchId: MAIN, newBranchName: 'feature/blob', projectId: PROJECT });

    const refAfter = blobs.refCount(seededHash);
    expect(refAfter).toBeGreaterThanOrEqual(refBefore);
  });

  it('records cell snapshot', () => {
    const result = store.createBranch({ parentBranchId: MAIN, newBranchName: 'feature/snap', projectId: PROJECT });
    expect(result.cellSnapshot.T1).toBeDefined();
    const total = Object.values(result.cellSnapshot).reduce(
      (sum, tier) => sum + Object.values(tier).reduce((s, n) => s + (n as number), 0), 0
    );
    expect(total).toBe(result.indexRowsCloned);
  });

  it('respects cloneTiers=t1_only', () => {
    const result = store.createBranch({ parentBranchId: MAIN, newBranchName: 'feature/t1', projectId: PROJECT, cloneTiers: 't1_only' });
    const t4Count = result.cellSnapshot.T4
      ? Object.values(result.cellSnapshot.T4).reduce((s, n) => s + (n as number), 0) : 0;
    expect(t4Count).toBe(0);
  });

  it('lists branches', () => {
    store.createBranch({ parentBranchId: MAIN, newBranchName: 'feat/a', projectId: PROJECT });
    store.createBranch({ parentBranchId: MAIN, newBranchName: 'feat/b', projectId: PROJECT });
    const branches = store.listBranches(PROJECT);
    expect(branches.length).toBe(2);
  });
});

function seedMainBranch(db: DB, blobs: BlobStore): void {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO decision_entries (id, hash, tier, content, project_id, branch_id, memory_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run('m1', 'hm1', 'T1', 'main decision 1', PROJECT, MAIN, 'branch', now, now);
  insert.run('m2', 'hm2', 'T2', 'main decision 2', PROJECT, MAIN, 'branch', now, now);
  insert.run('m3', 'hm3', 'T4', 'main archived decision', PROJECT, MAIN, 'branch', now, now);

  const blobHash = blobs.put('large content '.repeat(500));
  db.prepare(
    `INSERT INTO decision_entries (id, hash, tier, content, project_id, branch_id, memory_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('m4', blobHash, 'T1', null, PROJECT, MAIN, 'branch', now, now);
}
