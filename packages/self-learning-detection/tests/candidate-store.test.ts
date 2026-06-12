// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , CandidateStore cooldown + review status tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { CandidateStore } from '../src/candidate-store';

describe('CandidateStore', () => {
  let db: Database.Database;
  let store: CandidateStore;

  beforeAll(() => {
    db = new Database(':memory:');
    store = new CandidateStore(db);
  });

  afterAll(() => {
    db.close();
  });

  it('stores a candidate', () => {
    const id = store.add({
      projectId: 'proj_test',
      patternHash: 'abc123',
      patternName: 'Test Pattern',
      observationCount: 5,
      successRate: 0.8,
      impactScore: 0.6,
      sampleObservationIds: JSON.stringify(['obs1', 'obs2']),
    });
    expect(id).toBeTruthy();
  });

  it('lists candidates by status', () => {
    const candidates = store.list('proj_test', 'detected', 10);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].status).toBe('detected');
  });

  it('sets review status', () => {
    const candidates = store.list('proj_test', 'detected', 1);
    if (candidates.length > 0) {
      store.setReviewStatus(candidates[0].id, 'promoted', 'test-user');
      const updated = store.get(candidates[0].id);
      expect(updated?.status).toBe('promoted');
    }
  });

  it('handles cooldown', () => {
    const cooldown = store.getCooldown('proj_test', 'abc123');
    expect(typeof cooldown).toBe('number');
  });

  it('get returns null for missing candidate', () => {
    const result = store.get('non-existent-id');
    expect(result).toBeNull();
  });
});
