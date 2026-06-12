// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { VerificationLoop } from '../src/verification-loop';
import { MockSkillExecutor } from '../src/types';
import { SELF_LEARNING_MIGRATIONS, Observer } from '@orqenix/self-learning-observer';

const PROJECT = 'blake3:proj0001';

function setupDb(): DB {
  const db = new Database(':memory:');
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  return db;
}

function seedObservations(observer: Observer, count: number, success: boolean): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const e = observer.capture({
      projectId: PROJECT,
      sessionId: `s${i}`,
      actorKind: 'agent',
      actorId: 'x',
      actionKind: 'shell_command',
      actionPayload: { command: `cmd ${i}` },
      outcomeKind: success ? 'success' : 'error',
      outcomeDurationMs: 1000,
    });
    if (e) ids.push(e.id);
  }
  return ids;
}

describe('VerificationLoop', () => {
  let db: DB;
  let observer: Observer;

  beforeEach(() => {
    db = setupDb();
    observer = new Observer({ db });
  });

  afterEach(() => db.close());

  it('returns unverified when below minimum samples', async () => {
    const loop = new VerificationLoop({ db, executor: new MockSkillExecutor(1.0), observer });
    const ids = seedObservations(observer, 3, true); // below min 5
    const result = await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    expect(result.newStatus).toBe('unverified');
    expect(result.canDefaultEnable).toBe(false);
  });

  it('progresses to verified when replay + cross-val pass (100% executor)', async () => {
    const loop = new VerificationLoop({ db, executor: new MockSkillExecutor(1.0), observer });
    const ids = seedObservations(observer, 10, true);
    const result = await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    expect(result.newStatus).toBe('verified');
    expect(result.passed).toBe(true);
    expect(result.canDefaultEnable).toBe(true); // Anti-38: only verified can default-enable
  });

  it('stays unverified when replay fails (0% executor)', async () => {
    const loop = new VerificationLoop({ db, executor: new MockSkillExecutor(0.0), observer });
    const ids = seedObservations(observer, 10, true);
    const result = await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    expect(result.newStatus).toBe('unverified');
    expect(result.canDefaultEnable).toBe(false);
  });

  it('records verification runs', async () => {
    const loop = new VerificationLoop({ db, executor: new MockSkillExecutor(1.0), observer });
    const ids = seedObservations(observer, 10, true);
    await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    const history = loop.getHistory('@local/skill');
    expect(history.length).toBeGreaterThanOrEqual(2); // replay + cross_validation
    expect(history.some((r) => r.verification_kind === 'replay')).toBe(true);
    expect(history.some((r) => r.verification_kind === 'cross_validation')).toBe(true);
  });

  it('uses 20% holdout for cross-validation', async () => {
    const loop = new VerificationLoop({ db, executor: new MockSkillExecutor(1.0), observer });
    const ids = seedObservations(observer, 10, true); // 20% holdout = 2
    await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    const history = loop.getHistory('@local/skill');
    const crossVal = history.find((r) => r.verification_kind === 'cross_validation');
    expect(crossVal?.observations_used).toBe(2); // 20% of 10
  });

  it('replay_tested when replay passes but cross-val fails', async () => {
    // Executor that passes ~85% (above 80% threshold for replay, marginal cross-val)
    // Use deterministic split: training large, holdout small
    // We simulate cross-val failure with a custom executor
    let callCount = 0;
    const flakeyExecutor = {
      async replay(input: { expectedOutcome: 'success' | 'error' }) {
        callCount += 1;
        // First 8 calls (replay training) succeed; last 2 (cross-val holdout) fail
        const matched = callCount <= 8;
        return {
          matched,
          actualOutcome: (matched ? input.expectedOutcome : 'error') as 'success' | 'error' | 'partial',
        };
      },
    };
    const loop = new VerificationLoop({ db, executor: flakeyExecutor, observer });
    const ids = seedObservations(observer, 10, true);
    const result = await loop.verify({
      skillName: '@local/skill',
      skillVersion: '0.1.0',
      derivedFromObservations: ids,
      projectId: PROJECT,
    });
    // replay (training=8) passes; cross-val (holdout=2) fails → replay_tested
    expect(result.newStatus).toBe('replay_tested');
    expect(result.canDefaultEnable).toBe(false);
  });
});
