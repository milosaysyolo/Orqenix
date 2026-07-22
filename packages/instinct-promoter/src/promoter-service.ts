// SPDX-License-Identifier: Apache-2.0
// @orqenix/instinct-promoter , Promoter service (headless core)
//
// Coordinates candidate review: lists ranked candidates, enriches with redacted
// samples, executes review decisions. On Promote, delegates to skill-genesis

import type { Database } from 'better-sqlite3';
import { CandidateStore, type IDetector, type InstinctCandidate } from '@orqenix/self-learning-detection';
import { Observer, DEFAULT_GOVERNANCE } from '@orqenix/self-learning-observer';
import type { SelfLearningGovernance, ObservationEvent } from '@orqenix/self-learning-observer';
import { SkillGenesis } from '@orqenix/skill-genesis';
import {  type PromoterCandidate,  type ObservationSample,  type ReviewDecision,  type ReviewResult,} from './types';

/** Audit writer for promoter events */
export interface PromoterAuditWriter {
  append(event: {
    kind:
      | 'candidate.reviewed'
      | 'candidate.promoted_to_skill'
      | 'observer.candidate_detected';
    ts: string;
    actor: { user: string };
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export class NoopPromoterAuditWriter implements PromoterAuditWriter {
  async append(): Promise<void> {
    // no-op
  }
}

export interface PromoterServiceOptions {
  db: Database;
  candidateStore?: CandidateStore;
  observer?: Observer;
  skillGenesis?: SkillGenesis;
  audit?: PromoterAuditWriter;
  detector?: IDetector;
}
export class PromoterService {
  private readonly db: Database;
  private readonly candidateStore: CandidateStore;
  private readonly observer: Observer;
  private readonly skillGenesis: SkillGenesis;
  private readonly audit: PromoterAuditWriter;
  private readonly governance: SelfLearningGovernance;
  private iterationResults: string[][] = [];

  constructor(options: PromoterServiceOptions) {
    this.db = options.db;
    this.candidateStore = options.candidateStore ?? new CandidateStore(this.db);
    this.observer = options.observer ?? new Observer({ db: this.db });
    this.skillGenesis = options.skillGenesis ?? new SkillGenesis({ db: this.db });
    this.audit = options.audit ?? new NoopPromoterAuditWriter();
    this.governance = options.observer?.governance ?? DEFAULT_GOVERNANCE;
  }

  // ─── Convergence ─────────────────────────────────────────────────────

  /**
   * Records the pattern hashes from one loop iteration's candidate set.
   * Used by checkConvergence to detect when results have stabilised.
   */
  recordIterationResult(patternHashes: string[]): void {
    this.iterationResults.push(patternHashes);
    // Keep only the window we need
    if (this.iterationResults.length > this.governance.convergenceWindow) {
      this.iterationResults = this.iterationResults.slice(
        -this.governance.convergenceWindow
      );
    }
  }

  /** Returns true if the last N iteration results are identical */
  checkConvergence(): boolean {
    if (this.iterationResults.length < this.governance.convergenceWindow) {
      return false;
    }
    const window = this.iterationResults.slice(-this.governance.convergenceWindow);
    const first = JSON.stringify(window[0]);
    return window.every((r) => JSON.stringify(r) === first);
  }

  /** Resets convergence tracking (e.g. new session / config change) */
  resetConvergenceTracking(): void {
    this.iterationResults = [];
  }

  /** Returns convergence status snapshot */
  getConvergenceStatus(): {
    windowSize: number;
    recordedIterations: number;
    converged: boolean;
  } {
    return {
      windowSize: this.governance.convergenceWindow,
      recordedIterations: this.iterationResults.length,
      converged: this.checkConvergence(),
    };
  }

  /**
   * Lists candidates ready for review, ranked by impact, enriched with
   * redacted observation samples.
   */
  async listForReview(projectId: string, limit = 50): Promise<PromoterCandidate[]> {
    const candidates = this.candidateStore.list(projectId, 'detected', limit);
    return candidates.map((c: InstinctCandidate) => {
      const sampleIds = JSON.parse(c.sample_observation_ids) as string[];
      const samples = this.fetchSamples(projectId, sampleIds);
      const estTimeSavedPerWeekMin = this.estimateWeeklySavings(
        c.observation_count,
        samples
      );
      return {
        id: c.id,
        patternName: c.pattern_name ?? '(unnamed)',
        patternDescription: c.pattern_description ?? '',
        occurrenceCount: c.observation_count,
        successRate: c.success_rate,
        impactScore: c.impact_score,
        estTimeSavedPerWeekMin,
        crossScope: c.cross_scope,
        crossScopeSources: c.cross_scope_sources_json
          ? (JSON.parse(c.cross_scope_sources_json) as string[])
          : [],
        samples,
        status: c.status,
      };
    });
  }

  /**
   * Executes a review decision (Promote / Customize / Reject / Defer).
   */
  async review(decision: ReviewDecision, projectId: string): Promise<ReviewResult> {
    const candidate = this.candidateStore.get(decision.candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${decision.candidateId} not found`);
    }
    // Audit the review
    await this.audit.append({
      kind: 'candidate.reviewed',
      ts: new Date().toISOString(),
      actor: { user: decision.reviewedBy },
      payload: {
        candidateId: decision.candidateId,
        action: decision.action,
        ...(decision.reason ? { reason: decision.reason } : {}),
      },
    });
    switch (decision.action) {
      case 'reject':
        this.candidateStore.setReviewStatus(
          decision.candidateId,
          'rejected',
          decision.reviewedBy,
          decision.reason
        );
        return { ok: true, candidateId: decision.candidateId, action: 'reject' };
      case 'defer':
        this.candidateStore.setReviewStatus(
          decision.candidateId,
          'deferred',
          decision.reviewedBy,
          decision.reason
        );
        return { ok: true, candidateId: decision.candidateId, action: 'defer' };
      case 'promote_customize':
        // Mark reviewed; UI opens the skill builder pre-filled
        this.candidateStore.setReviewStatus(
          decision.candidateId,
          'reviewed',
          decision.reviewedBy
        );
        return {
          ok: true,
          candidateId: decision.candidateId,
          action: 'promote_customize',
          openBuilder: true,
        };
      case 'promote': {
        // Generate skill from candidate (skill-genesis)
        const genResult = await this.skillGenesis.generateFromCandidate({
          candidateId: decision.candidateId,
          projectId,
        });
        this.candidateStore.setReviewStatus(
          decision.candidateId,
          'promoted',
          decision.reviewedBy
        );
        await this.audit.append({
          kind: 'candidate.promoted_to_skill',
          ts: new Date().toISOString(),
          actor: { user: decision.reviewedBy },
          payload: {
            candidateId: decision.candidateId,
            skillName: genResult.skillName,
            verificationStatus: 'unverified', // Anti-38: must verify before default-enabled
          },
        });
        return {
          ok: true,
          candidateId: decision.candidateId,
          action: 'promote',
          generatedSkillName: genResult.skillName,
        };
      }
    }
  }

  /** Fetches redacted observation samples by ID */
  private fetchSamples(projectId: string, ids: string[]): ObservationSample[] {
    const samples: ObservationSample[] = [];
    const events = this.observer.query({ projectId, limit: 1000 });
    const byId = new Map(events.map((e: ObservationEvent) => [e.id, e]));
    for (const id of ids.slice(0, 5)) {
      const e = byId.get(id);
      if (!e) continue;
      samples.push({
        id: e.id,
        timestamp: e.timestamp,
        actionKind: e.action_kind,
        outcomeKind: e.outcome_kind,
        durationMs: e.outcome_duration_ms,
        // action_payload already PII-redacted at capture
        preview: JSON.stringify(e.action_payload).slice(0, 120),
      });
    }
    return samples;
  }

  private estimateWeeklySavings(
    occurrenceCount: number,
    samples: ObservationSample[]
  ): number {
    const avgDurationMs =
      samples.length > 0
        ? samples.reduce((s, x) => s + (x.durationMs ?? 0), 0) / samples.length
        : 0;
    // Assume observations span ~1 week; savings = occurrences * (duration - invoke cost)
    const savedMsPerOcc = Math.max(0, avgDurationMs - 2000);
    return Math.round((occurrenceCount * savedMsPerOcc) / 60000);
  }
}