// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Frequency analyzer
//
// Aggregates action sequences into patterns + applies frequency + outcome
// correlation thresholds. Per CR v8.0 Section 9.4.2.

import { blake3 } from "@noble/hashes/blake3";
import {
  type ActionSequence,
  type DetectedPattern,
  type DetectionThresholds,
  DEFAULT_THRESHOLDS,
} from "./types";

interface PatternAccumulator {
  actionKinds: string[];
  occurrences: number;
  successes: number;
  totalDurationMs: number;
  sampleIds: string[];
}

export class FrequencyAnalyzer {
  constructor(private readonly thresholds: DetectionThresholds = DEFAULT_THRESHOLDS) {}

  /**
   * Aggregates sequences into patterns, applying:
   *   - frequency threshold (minOccurrences)
   *   - outcome correlation (minSuccessRate)
   * Returns patterns that pass both, ranked by impact score.
   */
  analyze(sequences: ActionSequence[]): DetectedPattern[] {
    const accumulators = new Map<string, PatternAccumulator>();

    for (const seq of sequences) {
      const hash = this.hashSequence(seq.actionKinds);
      const acc = accumulators.get(hash) ?? {
        actionKinds: seq.actionKinds,
        occurrences: 0,
        successes: 0,
        totalDurationMs: 0,
        sampleIds: [],
      };
      acc.occurrences += 1;
      if (seq.success) acc.successes += 1;
      acc.totalDurationMs += seq.durationMs;
      // Cap sample IDs at 10 for storage efficiency
      if (acc.sampleIds.length < 10) {
        acc.sampleIds.push(seq.observationIds[0] ?? "");
      }
      accumulators.set(hash, acc);
    }

    const patterns: DetectedPattern[] = [];
    for (const [hash, acc] of accumulators) {
      // Frequency threshold
      if (acc.occurrences < this.thresholds.minOccurrences) continue;

      const successRate = acc.occurrences > 0 ? acc.successes / acc.occurrences : 0;
      // Outcome correlation threshold
      if (successRate < this.thresholds.minSuccessRate) continue;

      const avgDurationMs = acc.totalDurationMs / acc.occurrences;
      const estTimeSavedMs = this.estimateTimeSaved(acc.actionKinds, avgDurationMs);
      const impactScore = this.computeImpactScore(acc.occurrences, successRate, estTimeSavedMs);

      patterns.push({
        patternHash: hash,
        actionKinds: acc.actionKinds,
        occurrenceCount: acc.occurrences,
        successCount: acc.successes,
        successRate,
        avgDurationMs,
        sampleObservationIds: acc.sampleIds,
        suggestedName: this.suggestName(acc.actionKinds),
        suggestedDescription: this.suggestDescription(
          acc.actionKinds,
          acc.occurrences,
          successRate,
        ),
        impactScore,
      });
    }

    return patterns.sort((a, b) => b.impactScore - a.impactScore);
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private hashSequence(actionKinds: string[]): string {
    const canonical = actionKinds.join("→");
    const h = blake3(new TextEncoder().encode(canonical));
    return Array.from(h)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Basic time-saved estimate: collapsing N manual actions into 1 skill
   * invocation saves roughly the sequence duration minus a nominal invoke cost.
   * (Advanced estimation ships in Pro.)
   */
  private estimateTimeSaved(actionKinds: string[], avgDurationMs: number): number {
    const invokeCostMs = 2000; // nominal cost of invoking a skill
    return Math.max(0, avgDurationMs - invokeCostMs);
  }

  private computeImpactScore(
    frequency: number,
    successRate: number,
    estTimeSavedMs: number,
  ): number {
    // Normalize: frequency (log scale) × success rate × time-saved (minutes)
    const freqFactor = Math.log10(frequency + 1);
    const timeSavedMin = estTimeSavedMs / 60000;
    const raw = freqFactor * successRate * (1 + timeSavedMin);
    // Scale to roughly 0-10
    return Math.min(10, raw * 2);
  }

  private suggestName(actionKinds: string[]): string {
    // Heuristic: join distinctive verbs from action kinds
    const simplified = actionKinds.map((k) => k.replace(/_/g, "-"));
    if (simplified.length <= 3) {
      return `@local/${simplified.join("-then-")}`;
    }
    return `@local/${simplified[0]}-workflow`;
  }

  private suggestDescription(
    actionKinds: string[],
    occurrences: number,
    successRate: number,
  ): string {
    const steps = actionKinds.map((k, i) => `${i + 1}. ${k.replace(/_/g, " ")}`).join("; ");
    return `Recurring ${actionKinds.length}-step workflow (${occurrences}× observed, ${(successRate * 100).toFixed(0)}% success): ${steps}`;
  }
}
