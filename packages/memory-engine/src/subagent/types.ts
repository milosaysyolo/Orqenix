// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Subagent types

/** Anti-drift constraints for subagent execution (CR v8.0 Section 5.1) */
export interface SubagentConstraints {
  maxSteps: number; // default 5
  maxWallTimeSec: number; // default 90
  allowedTools: string[]; // whitelist
  forbiddenTools: string[]; // blacklist
}

export const DEFAULT_SUBAGENT_CONSTRAINTS: SubagentConstraints = {
  maxSteps: 5,
  maxWallTimeSec: 90,
  allowedTools: [],
  forbiddenTools: ["write_file", "git_commit"],
};

/** Harness package injected by parent into subagent (CR v8.0 Section 5.1 Phase A) */
export interface SubagentHarness {
  /** Anti-drift system prompt */
  systemPrompt: string;
  /** Scoped context: references to specific parent memory entries */
  scopedContext: {
    entryIds: string[];
    rationale: string;
  };
  /** Goal statement */
  goal: string;
  /** Anti-drift constraints */
  constraints: SubagentConstraints;
  /** Return schema (subagent must produce this shape) */
  returnSchema: Record<string, unknown>;
  /** Subagent kind (e.g., 'test-runner', 'code-reviewer') */
  subagentKind: string;
}

/** Result returned by subagent to parent */
export interface SubagentReturn {
  /** Output conforming to returnSchema */
  output: unknown;
  /** Whether output matched the schema */
  outputMatchesSchema: boolean;
  /** Wall-clock duration */
  wallTimeMs: number;
  /** Steps taken */
  stepsTaken: number;
}

/** Input for invoking a subagent */
export interface InvokeSubagentInput {
  parentSessionId: string;
  branchId: string;
  projectId: string;
  harness: SubagentHarness;
  /** Function that actually runs the subagent (provided by agent platform) */
  runner: (harness: SubagentHarness) => Promise<SubagentReturn>;
}

/** Result of absorbing a subagent return into parent memory */
export interface AbsorbResult {
  /** Entry written to T1 */
  t1EntryId: string;
  /** Entry written to T2 (redundancy) */
  t2EntryId: string;
  subagentSessionId: string;
}
