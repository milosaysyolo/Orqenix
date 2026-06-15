// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , CandidateStore cooldown + review status tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { CandidateStore } from '../src/candidate-store';
import { DEFAULT_THRESHOLDS } from '../src/types';

const testPattern = {
  patternHash: 'abc123',
  suggestedName: 'Test Pattern',
  suggestedDescription: '',
  actionKinds: ['shell_command'],
  avgDurationMs: 1500,
  occurrenceCount: 5,
  successCount: 4,
  successRate: 0.8,
  impactScore: 0.6,
  sampleObservationIds: ['obs1', 'obs2'],
};

const testCtx = { projectId: 'proj_test', branchId: null, sessionId: null };

describe('CandidateStore', () => {
  let db: Database.Database;
  let store: CandidateStore;

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE IF NOT EXISTS instinct_candidates (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, branch_id TEXT, session_id TEXT,
      pattern_hash TEXT NOT NULL, pattern_name TEXT, pattern_description TEXT,
      observation_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0, success_rate REAL DEFAULT 0,
      sample_observation_ids TEXT, detected_at TEXT NOT NULL, impact_score REAL DEFAULT 0,
      status TEXT DEFAULT 'detected', reviewed_at TEXT, reviewed_by TEXT,
      review_decision TEXT, cross_scope INTEGER DEFAULT 0, cross_scope_sources_json TEXT
    )`);
    store = new CandidateStore(db);
  });

  afterAll(() => {
    db.close();
  });

  it('stores a candidate via upsert', () => {
    const result = store.upsert(testPattern, testCtx, DEFAULT_THRESHOLDS);
    expect(['created', 'updated']).toContain(result);
  });

  it('lists candidates by status', () => {
    const candidates = store.list('proj_test', 'detected', 10);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.status).toBe('detected');
  });

  it('sets review status', () => {
    const candidates = store.list('proj_test', 'detected', 1);
    if (candidates.length > 0) {
      store.setReviewStatus(candidates[0]!.id, 'promoted', 'test-user');
      const updated = store.get(candidates[0]!.id);
      expect(updated?.status).toBe('promoted');
    }
  });

  it('get returns null for missing candidate', () => {
    const result = store.get('non-existent-id');
    expect(result).toBeNull();
  });
});
