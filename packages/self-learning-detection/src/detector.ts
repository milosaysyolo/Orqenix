// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Basic detector (top-level)
//
// Orchestrates sequence detection → frequency analysis → candidate persistence.
// Implements IDetector for drop-in replacement by Pro advanced detector.

import type { Database } from "better-sqlite3";
import { SequenceDetector } from "./sequence-detector";
import { FrequencyAnalyzer } from "./frequency-analyzer";
import { CandidateStore } from "./candidate-store";
import {
  type DetectionInput,
  type DetectionResult,
  type DetectedPattern,
  type IDetector,
  type DetectionThresholds,
  DEFAULT_THRESHOLDS,
} from "./types";
import { type SelfLearningGovernance, DEFAULT_GOVERNANCE } from "@orqenix/self-learning-observer";

export interface BasicDetectorOptions {
  db: Database;
  thresholds?: Partial<DetectionThresholds>;
  /** Optional governance to cap generated candidates per run */
  governance?: Partial<SelfLearningGovernance>;
}

export class BasicDetector implements IDetector {
  private readonly db: Database;
  private readonly thresholds: DetectionThresholds;
  private readonly candidateStore: CandidateStore;
  private readonly generationCap: number;

  constructor(options: BasicDetectorOptions) {
    this.db = options.db;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.candidateStore = new CandidateStore(this.db);
    this.generationCap = options.governance?.generationCap ?? DEFAULT_GOVERNANCE.generationCap;
  }

  /** Returns detected patterns (without persisting) */
  async detect(input: DetectionInput): Promise<DetectedPattern[]> {
    const thresholds = { ...this.thresholds, ...input.thresholds };
    const sequenceDetector = new SequenceDetector(thresholds);
    const frequencyAnalyzer = new FrequencyAnalyzer(thresholds);

    const sequences = sequenceDetector.extractSequences(input.events);
    return frequencyAnalyzer.analyze(sequences);
  }

  /**
   * Full run: detect + persist candidates with cooldown handling.
   * Respects generationCap from governance — only processes the top
   * N patterns by impact score.
   */
  async run(input: DetectionInput): Promise<DetectionResult> {
    const startMs = Date.now();
    const thresholds = { ...this.thresholds, ...input.thresholds };
    const patterns = await this.detect(input);

    // Apply generation cap — top N by impact score
    const capped = patterns
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, this.generationCap);

    let created = 0;
    let updated = 0;
    for (const pattern of capped) {
      const result = this.candidateStore.upsert(
        pattern,
        {
          projectId: input.projectId,
          branchId: input.branchId ?? null,
          sessionId: input.sessionId ?? null,
        },
        thresholds,
      );
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      // 'cooldown' → skip
    }

    return {
      candidatesCreated: created,
      candidatesUpdated: updated,
      patternsAnalyzed: patterns.length,
      durationMs: Date.now() - startMs,
    };
  }

  /** Returns the candidate store (for Promoter UI) */
  getCandidateStore(): CandidateStore {
    return this.candidateStore;
  }
}
