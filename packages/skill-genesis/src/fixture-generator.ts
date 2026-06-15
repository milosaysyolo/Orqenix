// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Fixture generator
//
// Generates test fixtures from observation samples. Per CR v8.0 Section 9.4.4.

import type { ObservationEvent } from '@orqenix/self-learning-observer';
import type { InferredParameter, GeneratedFixture } from './types';

export class FixtureGenerator {
  /**
   * Generates test fixtures from observation samples. Each successful sample
   * becomes a positive fixture; each error sample becomes a negative fixture.
   */
  generate(events: ObservationEvent[], parameters: InferredParameter[]): GeneratedFixture[] {
    const fixtures: GeneratedFixture[] = [];
    const paramNames = new Set(parameters.map((p) => p.name));

    // Group events by session to find terminal outcomes
    const bySession = new Map<string, ObservationEvent[]>();
    for (const e of events) {
      const arr = bySession.get(e.session_id) ?? [];
      arr.push(e);
      bySession.set(e.session_id, arr);
    }

    let idx = 0;
    for (const sessionEvents of bySession.values()) {
      const sorted = [...sessionEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const terminal = sorted.find((e) => e.outcome_kind !== null);
      if (!terminal) continue;

      // Build input from the first event's payload, restricted to inferred params
      const firstPayload = sorted[0]?.action_payload ?? {};
      const input: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this.flatten(firstPayload))) {
        const paramName = key.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '_');
        if (paramNames.has(paramName)) {
          input[paramName] = value;
        }
      }

      fixtures.push({
        name: `fixture-${++idx}`,
        input,
        expectedOutcome: terminal.outcome_kind === 'success' ? 'success' : 'error',
      });

      if (fixtures.length >= 10) break; // cap at 10 fixtures
    }

    return fixtures;
  }

  private flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, this.flatten(value as Record<string, unknown>, path));
      } else {
        out[path] = value;
      }
    }
    return out;
  }
}
