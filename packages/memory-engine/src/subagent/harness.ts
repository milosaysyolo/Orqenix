// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Subagent harness
//
// Manages subagent invocation. Subagents have NO matrix and NO persistence
// per ADR-E-002. The harness assembles parent-injected context, runs the
// subagent, and hands the return to the absorber. Single-level depth per
// Anti-pattern 36.

import { ulid } from '../store/ulid';
import {
  type SubagentHarness as Harness,
  type SubagentReturn,
  type InvokeSubagentInput,
  DEFAULT_SUBAGENT_CONSTRAINTS,
} from './types';

export class SubagentHarnessError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SubagentHarnessError';
    Object.setPrototypeOf(this, SubagentHarnessError.prototype);
  }
}

export interface SubagentInvocation {
  subagentSessionId: string;
  parentSessionId: string;
  subagentKind: string;
  ret: SubagentReturn;
}

/**
 * Manages subagent invocation. Does NOT allocate any matrix or persistence
 * for the subagent (ADR-E-002). The subagent runs in an ephemeral context
 * window provided by the runner; the harness only enforces constraints and
 * tracks the invocation for audit.
 */
export class SubagentHarnessManager {
  /**
   * Invokes a subagent with a parent-assembled harness.
   *
   * Steps (CR v8.0 Section 5.1):
   *   Phase A: validate harness (anti-drift constraints, no sub-subagent)
   *   Phase B: run subagent via runner (ephemeral, enforces wall-time)
   *   Phase C: return is handed to caller for absorption (return-absorber.ts)
   */
  async invoke(input: InvokeSubagentInput): Promise<SubagentInvocation> {
    // ── Phase A: validate harness ────────────────────────────────────────
    this.validateHarness(input.harness);

    const subagentSessionId = ulid();
    const constraints = {
      ...DEFAULT_SUBAGENT_CONSTRAINTS,
      ...input.harness.constraints,
    };

    // ── Phase B: run subagent with wall-time enforcement ─────────────────
    const ret = await this.runWithTimeout(
      input.harness,
      input.runner,
      constraints.maxWallTimeSec * 1000
    );

    // Validate steps taken against maxSteps
    if (ret.stepsTaken > constraints.maxSteps) {
      throw new SubagentHarnessError(
        'SUBAGENT_MAX_STEPS_EXCEEDED',
        `Subagent took ${ret.stepsTaken} steps, exceeding maxSteps=${constraints.maxSteps}`
      );
    }

    // Phase C: return handed to caller; absorption happens in MemoryEngine
    return {
      subagentSessionId,
      parentSessionId: input.parentSessionId,
      subagentKind: input.harness.subagentKind,
      ret,
    };
  }

  private validateHarness(harness: Harness): void {
    if (!harness.systemPrompt || harness.systemPrompt.trim().length === 0) {
      throw new SubagentHarnessError(
        'SUBAGENT_HARNESS_INVALID',
        'Harness must include a non-empty systemPrompt'
      );
    }
    if (!harness.goal || harness.goal.trim().length === 0) {
      throw new SubagentHarnessError(
        'SUBAGENT_HARNESS_INVALID',
        'Harness must include a goal statement'
      );
    }
    if (!harness.returnSchema) {
      throw new SubagentHarnessError(
        'SUBAGENT_HARNESS_INVALID',
        'Harness must declare a returnSchema (parent absorbs the return)'
      );
    }
    // Anti-pattern 36: subagent cannot spawn sub-subagents.
    // The forbiddenTools must include any subagent-spawn tool.
    const constraints = harness.constraints ?? DEFAULT_SUBAGENT_CONSTRAINTS;
    const allowsSubagentSpawn = constraints.allowedTools.some((t) =>
      t.includes('invoke_subagent') || t.includes('spawn_subagent')
    );
    if (allowsSubagentSpawn) {
      throw new SubagentHarnessError(
        'SUBAGENT_DEPTH_EXCEEDED',
        'Subagents cannot spawn sub-subagents (single-level depth per Anti-pattern 36)'
      );
    }
  }

  private async runWithTimeout(
    harness: Harness,
    runner: InvokeSubagentInput['runner'],
    timeoutMs: number
  ): Promise<SubagentReturn> {
    return Promise.race([
      runner(harness),
      new Promise<SubagentReturn>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new SubagentHarnessError(
                'SUBAGENT_TIMEOUT',
                `Subagent exceeded wall-time limit of ${timeoutMs}ms`
              )
            ),
          timeoutMs
        )
      ),
    ]);
  }
}
