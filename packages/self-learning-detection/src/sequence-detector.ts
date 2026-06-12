// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Sequence detector
//
// Identifies recurring N-action sequences from observation events. Per CR v8.0
// Section 9.4.2 (basic detection: sequence detection).

import type { ObservationEvent } from '@orqenix/self-learning-observer';
import {
  type ActionSequence,
  type DetectionThresholds,
  DEFAULT_THRESHOLDS,
} from './types';

/**
 * Extracts action sequences from a chronological event stream.
 *
 * A sequence is a contiguous window of actions by the same actor within a
 * session, bounded by minSequenceLength..maxSequenceLength. Sequences end at a
 * terminal outcome (success/error) or a context switch.
 */
export class SequenceDetector {
  constructor(private readonly thresholds: DetectionThresholds = DEFAULT_THRESHOLDS) {}

  /**
   * Extracts all candidate sequences from events.
   *
   * Strategy: group events by session, then slide windows of length
   * minSequenceLength..maxSequenceLength. A window is a sequence if it ends
   * with a terminal outcome (the last action has outcome_kind set).
   */
  extractSequences(events: ObservationEvent[]): ActionSequence[] {
    // Group by session, sort by timestamp
    const bySession = new Map<string, ObservationEvent[]>();
    for (const e of events) {
      const arr = bySession.get(e.session_id) ?? [];
      arr.push(e);
      bySession.set(e.session_id, arr);
    }

    const sequences: ActionSequence[] = [];

    for (const sessionEvents of bySession.values()) {
      const sorted = [...sessionEvents].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      );

      // Slide windows of varying length
      for (let len = this.thresholds.minSequenceLength; len <= this.thresholds.maxSequenceLength; len++) {
        for (let start = 0; start + len <= sorted.length; start++) {
          const window = sorted.slice(start, start + len);
          const last = window[window.length - 1]!;

          // A meaningful sequence ends with a terminal outcome
          if (last.outcome_kind === null) continue;

          const success = last.outcome_kind === 'success';
          const durationMs = window.reduce(
            (sum, e) => sum + (e.outcome_duration_ms ?? 0),
            0
          );

          sequences.push({
            actionKinds: window.map((e) => e.action_kind),
            observationIds: window.map((e) => e.id),
            success,
            durationMs,
          });
        }
      }
    }

    return sequences;
  }
}
