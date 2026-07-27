// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Hierarchy engine types

import type { KbKind, SearchResult } from '../store/types';

/** Level boost factors (CR v8.0 Section 4.4, configurable) */
export interface LevelBoosts {
  session: number; // default 1.5
  branch: number; // default 1.2
  project: number; // default 1.0
  subagentReturn: number; // default 10.0
}

export const DEFAULT_LEVEL_BOOSTS: LevelBoosts = {
  session: 1.5,
  branch: 1.2,
  project: 1.0,
  subagentReturn: 10.0,
};

/** Query parameters for the hierarchy query (parallel 3-step) */
export interface HierarchyQueryInput {
  query: string;
  queryEmbedding?: Float32Array;
  kbs?: KbKind[];
  /** Current session (queries originate here) */
  sessionId?: string;
  /** Current branch */
  branchId: string;
  /** Project */
  projectId: string;
  /** Max final results */
  limit: number;
  /** Anti-noise threshold (default 0.65) */
  minRelevanceScore?: number;
  /** Cluster cosine threshold (default 0.92) */
  clusterCosineThreshold?: number;
  /** Override level boosts */
  levelBoosts?: Partial<LevelBoosts>;
  /** Whether cross-session sharing link is active (default true) */
  crossSessionActive?: boolean;
  /** Whether cross-branch sharing link is active (default true) */
  crossBranchActive?: boolean;
}

/** A ranked result with hierarchy provenance */
export interface RankedResult extends SearchResult {
  /** Final score after level boost */
  finalScore: number;
  /** Which level this result came from */
  sourceLevel: "session" | "branch" | "project";
}

export interface HierarchyQueryResult {
  results: RankedResult[];
  /** Levels actually queried (depends on active links) */
  levelsQueried: Array<"session" | "branch" | "project">;
  /** Total query duration */
  durationMs: number;
}

/** Branch creation input */
export interface CreateBranchInput {
  parentBranchId: string;
  newBranchName: string;
  projectId: string;
  /** Which tiers to clone (default 'all') */
  cloneTiers?: "all" | "t1_t2_only" | "t1_only";
}

export interface CreateBranchResult {
  branchId: string;
  branchName: string;
  cellSnapshot: Record<string, Record<KbKind, number>>;
  indexRowsCloned: number;
  blobReferencesReused: number;
  durationMs: number;
}

/** Promotion input */
export interface PromoteInput {
  entryId: string;
  kb: KbKind;
  /** Direction */
  from: "session" | "branch";
  to: "branch" | "project";
  fromSessionId?: string;
  fromBranchId: string;
  toBranchId?: string;
  projectId: string;
  reason?: string;
}
