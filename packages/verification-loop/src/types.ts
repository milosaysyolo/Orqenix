// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , Type definitions

import { z } from "zod";

/** Verification status progression (CR v8.0 Section 9.4.5) */
export type VerificationStatus = "unverified" | "replay_tested" | "verified" | "marketplace-ready";

/** Verification kind */
export type VerificationKind = "replay" | "a_b" | "cross_validation";

/** Verification thresholds (configurable) */
export interface VerificationThresholds {
  replayTestSamplesMin: number; // default 5
  crossValidationHoldoutPct: number; // default 20
  successThresholdPct: number; // default 80
}

export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  replayTestSamplesMin: 5,
  crossValidationHoldoutPct: 20,
  successThresholdPct: 80,
};

/** A single verification run result */
export const VerificationRunSchema = z.object({
  id: z.string(),
  skill_id: z.string(),
  skill_version: z.string(),
  verification_kind: z.enum(["replay", "a_b", "cross_validation"]),
  run_at: z.string().datetime(),
  observations_used: z.number().int(),
  success_count: z.number().int(),
  failure_count: z.number().int(),
  partial_count: z.number().int(),
  success_rate: z.number(),
  notes: z.string().nullable(),
  result_payload_json: z.string().nullable(),
});

export type VerificationRun = z.infer<typeof VerificationRunSchema>;

/** Input to verify a skill */
export interface VerifyInput {
  skillName: string;
  skillVersion: string;
  /** Observation IDs the skill was derived from (for replay + holdout split) */
  derivedFromObservations: string[];
  projectId: string;
  thresholds?: Partial<VerificationThresholds>;
}

/** Result of a verification run */
export interface VerifyResult {
  /** New status after verification */
  newStatus: VerificationStatus;
  /** Whether verification passed */
  passed: boolean;
  /** Per-kind run results */
  runs: VerificationRun[];
  /** Whether the skill can now be default-enabled */
  canDefaultEnable: boolean;
}

/**
 * A skill executor used by verification (provided by skill-runtime).
 * Returns whether the skill's output matched the expected outcome for an input.
 */
export interface SkillExecutor {
  /** Runs the skill against an input, returns whether the outcome matched expectation */
  replay(input: {
    skillName: string;
    input: unknown;
    expectedOutcome: "success" | "error";
  }): Promise<{ matched: boolean; actualOutcome: "success" | "error" | "partial" }>;
}

/** Mock executor for standalone testing */
export class MockSkillExecutor implements SkillExecutor {
  constructor(private readonly successRate = 1.0) {}
  async replay(input: {
    expectedOutcome: "success" | "error";
  }): Promise<{ matched: boolean; actualOutcome: "success" | "error" | "partial" }> {
    const matched = Math.random() < this.successRate;
    return {
      matched,
      actualOutcome: matched
        ? input.expectedOutcome
        : input.expectedOutcome === "success"
          ? "error"
          : "success",
    };
  }
}
