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

export interface BasicDetectorOptions {
  db: Database;
  thresholds?: Partial<DetectionThresholds>;
}

export class BasicDetector implements IDetector {
  private readonly db: Database;
  private readonly thresholds: DetectionThresholds;
  private readonly candidateStore: CandidateStore;

  constructor(options: BasicDetectorOptions) {
    this.db = options.db;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.candidateStore = new CandidateStore(this.db);
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
   */
  async run(input: DetectionInput): Promise<DetectionResult> {
    const startMs = Date.now();
    const thresholds = { ...this.thresholds, ...input.thresholds };
    const patterns = await this.detect(input);

    let created = 0;
    let updated = 0;
    for (const pattern of patterns) {
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
