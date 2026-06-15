// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { SequenceDetector } from '../src/sequence-detector';
import { DEFAULT_THRESHOLDS } from '../src/types';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

function ev(
  id: string,
  session: string,
  action: string,
  ts: string,
  outcome: 'success' | 'error' | null = null
): ObservationEvent {
  return {
    id,
    timestamp: ts,
    project_id: 'p',
    branch_id: 'b',
    session_id: session,
    parent_session_id: null,
    agent_platform: 'claude-code',
    actor_kind: 'agent',
    actor_id: 'x',
    action_kind: action,
    action_payload: {},
    outcome_kind: outcome,
    outcome_duration_ms: outcome ? 1000 : null,
    outcome_payload: null,
    pii_redaction_applied: false,
    redaction_notes: null,
  };
}

describe('SequenceDetector', () => {
  it('extracts sequences ending in terminal outcome', () => {
    const detector = new SequenceDetector(DEFAULT_THRESHOLDS);
    const events = [
      ev('1', 's1', 'file_edit', '2026-06-11T10:00:00Z'),
      ev('2', 's1', 'test_run', '2026-06-11T10:00:05Z', 'success'),
    ];
    const sequences = detector.extractSequences(events);
    // Window [file_edit, test_run] ends in success
    const seq = sequences.find((s) => s.actionKinds.join() === 'file_edit,test_run');
    expect(seq).toBeDefined();
    expect(seq?.success).toBe(true);
  });

  it('groups by session (no cross-session sequences)', () => {
    const detector = new SequenceDetector(DEFAULT_THRESHOLDS);
    const events = [
      ev('1', 's1', 'file_edit', '2026-06-11T10:00:00Z'),
      ev('2', 's2', 'test_run', '2026-06-11T10:00:05Z', 'success'),
    ];
    const sequences = detector.extractSequences(events);
    // No sequence spans s1 → s2
    const cross = sequences.find((s) => s.actionKinds.join() === 'file_edit,test_run');
    expect(cross).toBeUndefined();
  });

  it('skips windows without terminal outcome', () => {
    const detector = new SequenceDetector(DEFAULT_THRESHOLDS);
    const events = [
      ev('1', 's1', 'file_edit', '2026-06-11T10:00:00Z'),
      ev('2', 's1', 'file_read', '2026-06-11T10:00:05Z'), // no outcome
    ];
    const sequences = detector.extractSequences(events);
    expect(sequences).toHaveLength(0);
  });
});
