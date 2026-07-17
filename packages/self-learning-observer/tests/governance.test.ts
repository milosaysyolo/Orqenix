// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { Observer } from '../src/observer';
import { DEFAULT_GOVERNANCE } from '../src/governance';
import type { SelfLearningGovernance } from '../src/governance';
import { SELF_LEARNING_MIGRATIONS } from '../src/migrations/530-observer';

const PROJECT = 'blake3:proj0001';
const SESSION = '01J3X8H9SESSION0000000000';

function setupDb(): DB {
  const db = new Database(':memory:');
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  return db;
}

function makeTightGovernance(overrides?: Partial<SelfLearningGovernance>): SelfLearningGovernance {
  return { ...DEFAULT_GOVERNANCE, maxIterationsPerSession: 2, cooldownMs: 50, ...overrides };
}

describe('SelfLearningGovernance — DEFAULT_GOVERNANCE', () => {
  it('exports default values that match documented contract', () => {
    expect(DEFAULT_GOVERNANCE.maxIterationsPerSession).toBe(5);
    expect(DEFAULT_GOVERNANCE.convergenceWindow).toBe(3);
    expect(DEFAULT_GOVERNANCE.cooldownMs).toBe(60_000);
    expect(DEFAULT_GOVERNANCE.generationCap).toBe(3);
  });
});

describe('Observer — governance integration', () => {
  let db: DB;
  let observer: Observer;

  beforeEach(() => {
    db = setupDb();
    observer = new Observer({ db, governance: makeTightGovernance() });
  });

  afterEach(() => db.close());

  it('canIterate returns true initially', () => {
    expect(observer.canIterate()).toBe(true);
  });

  it('canIterate returns false after maxIterationsPerSession reached', async () => {
    const gov = observer.governance;
    for (let i = 0; i < gov.maxIterationsPerSession; i++) {
      expect(observer.canIterate()).toBe(true);
      observer.recordIteration();
      // Wait for cooldown between iterations
      await new Promise((r) => setTimeout(r, gov.cooldownMs + 10));
    }
    expect(observer.canIterate()).toBe(false);
  });

  it('getLoopStatus reports correct state', () => {
    const status = observer.getLoopStatus();
    expect(status.iterationCount).toBe(0);
    expect(status.maxIterationsPerSession).toBe(2);
    expect(status.canIterate).toBe(true);
    expect(status.remainingIterations).toBe(2);
  });

  it('canIterate respects cooldown', async () => {
    observer.recordIteration();
    // Immediately after record, cannot iterate (cooldown 50ms)
    expect(observer.canIterate()).toBe(false);

    // Wait for cooldown to elapse
    await new Promise((r) => setTimeout(r, 60));
    expect(observer.canIterate()).toBe(true);
  });

  it('resetIterations clears counter', async () => {
    observer.recordIteration();
    await new Promise((r) => setTimeout(r, 60));
    observer.recordIteration();
    expect(observer.getLoopStatus().remainingIterations).toBe(0);

    observer.resetIterations();
    expect(observer.getLoopStatus().remainingIterations).toBe(2);
  });

  it('capture still works with governance set', () => {
    const event = observer.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: 'agent',
      actorId: 'x',
      actionKind: 'tool_call',
      actionPayload: {},
    });
    expect(event).not.toBeNull();
    expect(observer.count(PROJECT)).toBe(1);
  });

  it('observer without governance uses DEFAULT_GOVERNANCE', () => {
    const obs = new Observer({ db });
    expect(obs.governance).toEqual(DEFAULT_GOVERNANCE);
  });

  it('capture with default governance allows many iterations', () => {
    const obs = new Observer({ db });
    for (let i = 0; i < DEFAULT_GOVERNANCE.maxIterationsPerSession; i++) {
      obs.recordIteration();
    }
    // After max, next should be blocked
    expect(obs.canIterate()).toBe(false);
  });
});
