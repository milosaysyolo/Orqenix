// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { CodeSynthesizer } from '../src/code-synthesizer';
import type { ObservationEvent } from '@orqenix/self-learning-observer';
import type { InferredParameter } from '../src/types';

function ev(actionKind: string, payload: Record<string, unknown> = {}): ObservationEvent {
  return {
    id: `e-${Math.random()}`, timestamp: '2026-06-11T10:00:00Z',
    project_id: 'p', branch_id: 'b', session_id: 's', parent_session_id: null,
    agent_platform: 'claude-code', actor_kind: 'agent', actor_id: 'x',
    action_kind: actionKind, action_payload: payload,
    outcome_kind: 'success', outcome_duration_ms: 1000, outcome_payload: null,
    pii_redaction_applied: false, redaction_notes: null,
  };
}

const params: InferredParameter[] = [
  { name: 'message', type: 'string', variable: true, samples: ['a'], required: true },
];

describe('CodeSynthesizer', () => {
  it('infers shell when shell_command dominates', () => {
    const synth = new CodeSynthesizer();
    const events = [ev('shell_command'), ev('shell_command'), ev('file_read')];
    expect(synth.inferLanguage(events)).toBe('shell');
  });

  it('infers python when python signals present', () => {
    const synth = new CodeSynthesizer();
    const events = [ev('test_run', { command: 'pytest tests/' })];
    expect(synth.inferLanguage(events)).toBe('python');
  });

  it('defaults to typescript', () => {
    const synth = new CodeSynthesizer();
    const events = [ev('tool_call'), ev('memory_write')];
    expect(synth.inferLanguage(events)).toBe('typescript');
  });

  it('synthesizes TypeScript with input interface', () => {
    const synth = new CodeSynthesizer();
    const code = synth.synthesize({
      skillName: '@local/commit',
      actionKinds: ['file_edit', 'git_operation'],
      parameters: params,
      sampleEvents: [],
      language: 'typescript',
    });
    expect(code).toContain('export interface Input');
    expect(code).toContain('message: string');
    expect(code).toContain('export async function invoke');
  });

  it('synthesizes shell from observed commands', () => {
    const synth = new CodeSynthesizer();
    const code = synth.synthesize({
      skillName: '@local/build',
      actionKinds: ['shell_command'],
      parameters: [],
      sampleEvents: [ev('shell_command', { command: 'npm run build' })],
      language: 'shell',
    });
    expect(code).toContain('#!/usr/bin/env bash');
    expect(code).toContain('npm run build');
  });

  it('synthesizes Python with def invoke', () => {
    const synth = new CodeSynthesizer();
    const code = synth.synthesize({
      skillName: '@local/pytool',
      actionKinds: ['test_run'],
      parameters: params,
      sampleEvents: [],
      language: 'python',
    });
    expect(code).toContain('def invoke(');
    expect(code).toContain('message: str');
  });
});
