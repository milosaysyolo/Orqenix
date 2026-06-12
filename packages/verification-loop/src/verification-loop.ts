// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , Verification Loop core
//
// Runs replay + cross-validation to progress a skill's verification status.
// Per CR v8.0 Section 9.4.5 + Anti-38.

import type { Database } from 'better-sqlite3';
import { ulid } from '@orqenix/memory-engine';
import { Observer } from '@orqenix/self-learning-observer';
import {
  type VerifyInput,
  type VerifyResult,
  type VerificationRun,
  type VerificationStatus,
  type VerificationThresholds,
  type SkillExecutor,
  DEFAULT_VERIFICATION_THRESHOLDS,
} from './types';

export interface VerificationLoopOptions {
  db: Database;
  executor: SkillExecutor;
  observer?: Observer;
  thresholds?: Partial<VerificationThresholds>;
}

export class VerificationLoop {
  private readonly db: Database;
  private readonly executor: SkillExecutor;
  private readonly observer: Observer;
  private readonly thresholds: VerificationThresholds;

  constructor(options: VerificationLoopOptions) {
    this.db = options.db;
    this.executor = options.executor;
    this.observer = options.observer ?? new Observer({ db: this.db });
    this.thresholds = { ...DEFAULT_VERIFICATION_THRESHOLDS, ...options.thresholds };
  }

  /**
   * Verifies a skill: replay test + cross-validation.
   *
   * Progression:
   *   unverified → (replay pass) → replay_tested → (cross-val pass) → verified
   *
   * Per Anti-38, only 'verified' skills can be default-enabled.
   */
  async verify(input: VerifyInput): Promise<VerifyResult> {
    const thresholds = { ...this.thresholds, ...input.thresholds };
    const runs: VerificationRun[] = [];

    // Need minimum samples to verify
    if (input.derivedFromObservations.length < thresholds.replayTestSamplesMin) {
      return {
        newStatus: 'unverified',
        passed: false,
        runs: [],
        canDefaultEnable: false,
      };
    }

    // Split observations: holdout for cross-validation
    const holdoutCount = Math.max(
      1,
      Math.floor((input.derivedFromObservations.length * thresholds.crossValidationHoldoutPct) / 100)
    );
    const holdout = input.derivedFromObservations.slice(0, holdoutCount);
    const trainingSamples = input.derivedFromObservations.slice(holdoutCount);

    // ── Replay test (against training samples) ──────────────────────────
    const replayRun = await this.runVerification({
      skillName: input.skillName,
      skillVersion: input.skillVersion,
      kind: 'replay',
      observationIds: trainingSamples,
      projectId: input.projectId,
    });
    runs.push(replayRun);

    const replayPassed = replayRun.success_rate * 100 >= thresholds.successThresholdPct;
    if (!replayPassed) {
      this.persistRun(replayRun);
      return { newStatus: 'unverified', passed: false, runs, canDefaultEnable: false };
    }
    this.persistRun(replayRun);

    // ── Cross-validation (against holdout, NOT used to generate) ─────────
    const crossValRun = await this.runVerification({
      skillName: input.skillName,
      skillVersion: input.skillVersion,
      kind: 'cross_validation',
      observationIds: holdout,
      projectId: input.projectId,
    });
    runs.push(crossValRun);
    this.persistRun(crossValRun);

    const crossValPassed = crossValRun.success_rate * 100 >= thresholds.successThresholdPct;

    const newStatus: VerificationStatus = crossValPassed
      ? 'verified'
      : 'replay_tested';

    return {
      newStatus,
      passed: crossValPassed,
      runs,
      canDefaultEnable: newStatus === 'verified', // Anti-38
    };
  }

  /** Returns verification run history for a skill */
  getHistory(skillName: string): VerificationRun[] {
    const rows = this.db
      .prepare('SELECT * FROM skill_verification_runs WHERE skill_id = ? ORDER BY run_at DESC')
      .all(skillName) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToRun(r));
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async runVerification(input: {
    skillName: string;
    skillVersion: string;
    kind: VerificationRun['verification_kind'];
    observationIds: string[];
    projectId: string;
  }): Promise<VerificationRun> {
    // Load the observations to replay against
    const allEvents = this.observer.query({ projectId: input.projectId, limit: 2000 });
    const byId = new Map(allEvents.map((e) => [e.id, e]));

    let success = 0;
    let failure = 0;
    let partial = 0;

    for (const obsId of input.observationIds) {
      const event = byId.get(obsId);
      if (!event) continue;
      const expectedOutcome = event.outcome_kind === 'success' ? 'success' : 'error';
      const result = await this.executor.replay({
        skillName: input.skillName,
        input: event.action_payload,
        expectedOutcome,
      });
      if (result.matched) success += 1;
      else if (result.actualOutcome === 'partial') partial += 1;
      else failure += 1;
    }

    const total = success + failure + partial;
    const successRate = total > 0 ? success / total : 0;

    return {
      id: ulid(),
      skill_id: input.skillName,
      skill_version: input.skillVersion,
      verification_kind: input.kind,
      run_at: new Date().toISOString(),
      observations_used: total,
      success_count: success,
      failure_count: failure,
      partial_count: partial,
      success_rate: successRate,
      notes: null,
      result_payload_json: null,
    };
  }

  private persistRun(run: VerificationRun): void {
    this.db
      .prepare(
        `INSERT INTO skill_verification_runs (
          id, skill_id, skill_version, verification_kind, run_at,
          observations_used, success_count, failure_count, partial_count,
          success_rate, notes, result_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id, run.skill_id, run.skill_version, run.verification_kind, run.run_at,
        run.observations_used, run.success_count, run.failure_count, run.partial_count,
        run.success_rate, run.notes, run.result_payload_json
      );
  }

  private rowToRun(row: Record<string, unknown>): VerificationRun {
    return {
      id: row.id as string,
      skill_id: row.skill_id as string,
      skill_version: row.skill_version as string,
      verification_kind: row.verification_kind as VerificationRun['verification_kind'],
      run_at: row.run_at as string,
      observations_used: row.observations_used as number,
      success_count: row.success_count as number,
      failure_count: row.failure_count as number,
      partial_count: row.partial_count as number,
      success_rate: row.success_rate as number,
      notes: (row.notes as string | null) ?? null,
      result_payload_json: (row.result_payload_json as string | null) ?? null,
    };
  }
}
