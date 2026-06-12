// SPDX-License-Identifier: Apache-2.0
// @orqenix/instinct-promoter , Type definitions

import { z } from 'zod';

/** Review action a user takes on a candidate */
export type ReviewAction = 'promote' | 'promote_customize' | 'reject' | 'defer';

export const ReviewDecisionSchema = z.object({
  candidateId: z.string(),
  action: z.enum(['promote', 'promote_customize', 'reject', 'defer']),
  reviewedBy: z.string(),
  /** Optional reason (for reject/defer) */
  reason: z.string().optional(),
});

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

/** A redacted observation sample for UI display */
export interface ObservationSample {
  id: string;
  timestamp: string;
  actionKind: string;
  outcomeKind: string | null;
  durationMs: number | null;
  /** Already PII-redacted preview of the action */
  preview: string;
}

/** A candidate enriched for display in the Promoter UI */
export interface PromoterCandidate {
  id: string;
  patternName: string;
  patternDescription: string;
  occurrenceCount: number;
  successRate: number;
  impactScore: number;
  /** Estimated time saved per week (minutes) */
  estTimeSavedPerWeekMin: number;
  /** Whether this candidate spans multiple scopes */
  crossScope: boolean;
  crossScopeSources: string[];
  /** Redacted observation samples */
  samples: ObservationSample[];
  status: 'detected' | 'reviewed' | 'promoted' | 'rejected' | 'deferred';
}

export interface ReviewResult {
  ok: boolean;
  candidateId: string;
  action: ReviewAction;
  /** For promote actions: the generated skill name */
  generatedSkillName?: string;
  /** For promote_customize: whether the skill builder should open */
  openBuilder?: boolean;
}
