// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , SkillRuntime executor adapter
//
// Adapts @orqenix/skill-runtime's invoke() into the SkillExecutor contract,
// so verification actually runs the generated skill in the sandbox.

import type { SkillRuntime } from '@orqenix/skill-runtime';
import type { SkillExecutor } from './types';

/**
 * Wraps SkillRuntime so VerificationLoop can replay a skill against observation
 * inputs and compare the outcome to the expected outcome.
 */
export class SkillRuntimeExecutor implements SkillExecutor {
  constructor(
    private readonly runtime: SkillRuntime,
    private readonly clientId = 'verification-loop'
  ) {}

  async replay(input: {
    skillName: string;
    input: unknown;
    expectedOutcome: 'success' | 'error';
  }): Promise<{ matched: boolean; actualOutcome: 'success' | 'error' | 'partial' }> {
    try {
      const result = await this.runtime.invoke(input.skillName, input.input, {
        clientId: this.clientId,
      });
      // Inspect output for a success signal
      const output = result.output as { success?: boolean } | undefined;
      const actualOutcome: 'success' | 'error' | 'partial' =
        output?.success === true ? 'success' : output?.success === false ? 'error' : 'partial';
      return {
        matched: actualOutcome === input.expectedOutcome,
        actualOutcome,
      };
    } catch {
      // A thrown error counts as an 'error' outcome
      return {
        matched: input.expectedOutcome === 'error',
        actualOutcome: 'error',
      };
    }
  }
}
