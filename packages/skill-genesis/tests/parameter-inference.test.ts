// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { ParameterInference } from '../src/parameter-inference';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

function ev(payload: Record<string, unknown>): ObservationEvent {
  return {
    id: `e-${Math.random()}`,
    timestamp: '2026-06-11T10:00:00Z',
    project_id: 'p', branch_id: 'b', session_id: 's', parent_session_id: null,
    agent_platform: 'claude-code', actor_kind: 'agent', actor_id: 'x',
    action_kind: 'shell_command', action_payload: payload,
    outcome_kind: 'success', outcome_duration_ms: 1000, outcome_payload: null,
    pii_redaction_applied: false, redaction_notes: null,
  };
}

describe('ParameterInference', () => {
  it('detects variable fields as parameters', () => {
    const infer = new ParameterInference();
    const events = [
      ev({ command: 'git commit -m "feat: a"', type: 'commit' }),
      ev({ command: 'git commit -m "fix: b"', type: 'commit' }),
      ev({ command: 'git commit -m "docs: c"', type: 'commit' }),
    ];
    const params = infer.infer(events);
    // command varied → parameter; type constant → not a parameter
    expect(params.find((p) => p.name === 'command')).toBeDefined();
    expect(params.find((p) => p.name === 'type')).toBeUndefined();
  });

  it('infers parameter types', () => {
    const infer = new ParameterInference();
    const events = [
      ev({ count: 1, flag: true }),
      ev({ count: 2, flag: false }),
    ];
    const params = infer.infer(events);
    expect(params.find((p) => p.name === 'count')?.type).toBe('number');
    expect(params.find((p) => p.name === 'flag')?.type).toBe('boolean');
  });

  it('builds a JSON schema from parameters', () => {
    const infer = new ParameterInference();
    const events = [ev({ msg: 'a' }), ev({ msg: 'b' })];
    const params = infer.infer(events);
    const schema = infer.toInputSchema(params) as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.type).toBe('object');
    expect(schema.properties.msg).toBeDefined();
    expect(schema.required).toContain('msg');
  });

  it('returns empty for no events', () => {
    const infer = new ParameterInference();
    expect(infer.infer([])).toEqual([]);
  });
});
