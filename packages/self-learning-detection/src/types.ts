// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Type definitions

import { z } from 'zod';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

/** Detection thresholds (configurable per CR v8.0 Section 9.6) */
export interface DetectionThresholds {
  /** Minimum occurrences before candidacy (default 5) */
  minOccurrences: number;
  /** Minimum success rate (default 0.80) */
  minSuccessRate: number;
  /** Cooldown hours before re-surfacing same pattern (default 24) */
  cooldownHours: number;
  /** Sequence window: max actions in a detected sequence (default 6) */
  maxSequenceLength: number;
  /** Min sequence length to consider (default 2) */
  minSequenceLength: number;
}

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  minOccurrences: 5,
  minSuccessRate: 0.8,
  cooldownHours: 24,
  maxSequenceLength: 6,
  minSequenceLength: 2,
};

/** A detected action sequence (the raw pattern) */
export interface ActionSequence {
  /** Normalized action kinds in order */
  actionKinds: string[];
  /** Observation event IDs forming this occurrence */
  observationIds: string[];
  /** Whether the sequence ended in success */
  success: boolean;
  /** Total duration of the sequence (ms) */
  durationMs: number;
}

/** A pattern aggregated from multiple occurrences */
export interface DetectedPattern {
  /** BLAKE3 of the normalized action-kind sequence */
  patternHash: string;
  /** The action kinds defining this pattern */
  actionKinds: string[];
  /** Number of times observed */
  occurrenceCount: number;
  /** Number ending in success */
  successCount: number;
  /** Success rate (successCount / occurrenceCount) */
  successRate: number;
  /** Average duration across occurrences (ms) */
  avgDurationMs: number;
  /** Sample observation IDs (capped) */
  sampleObservationIds: string[];
  /** Auto-suggested name */
  suggestedName: string;
  /** Auto-suggested description */
  suggestedDescription: string;
  /** Impact score = frequency × success_rate × est_time_saved */
  impactScore: number;
}

/** A candidate ready for the Promoter */
export const InstinctCandidateSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  branch_id: z.string().nullable(),
  session_id: z.string().nullable(),
  pattern_hash: z.string(),
  pattern_name: z.string().nullable(),
  pattern_description: z.string().nullable(),
  observation_count: z.number().int(),
  success_count: z.number().int(),
  total_count: z.number().int(),
  success_rate: z.number(),
  sample_observation_ids: z.string(), // JSON array
  detected_at: z.string().datetime(),
  impact_score: z.number(),
  status: z.enum(['detected', 'reviewed', 'promoted', 'rejected', 'deferred']),
  reviewed_at: z.string().datetime().nullable(),
  reviewed_by: z.string().nullable(),
  review_decision: z.string().nullable(),
  cross_scope: z.boolean(),
  cross_scope_sources_json: z.string().nullable(),
});

export type InstinctCandidate = z.infer<typeof InstinctCandidateSchema>;

/** Detection run input */
export interface DetectionInput {
  projectId: string;
  branchId?: string;
  sessionId?: string;
  events: ObservationEvent[];
  thresholds?: Partial<DetectionThresholds>;
}

export interface DetectionResult {
  candidatesCreated: number;
  candidatesUpdated: number;
  patternsAnalyzed: number;
  durationMs: number;
}

/**
 * Detector contract. Basic OSS detector implements this; Pro advanced detector
 * also implements it for drop-in replacement / composition.
 */
export interface IDetector {
  detect(input: DetectionInput): Promise<DetectedPattern[]>;
}
