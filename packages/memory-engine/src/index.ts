// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Public API surface
//
// Phase 8 Foundation (D8.α.6) , KEYSTONE
// Charter gates: G58 (Memory Hierarchy) + G59 (Branch Deep Copy) + G60 (Subagent Harness)

// ─────────────────────────────────────────────────────────────────────────
// Engine facade (top-level)
// ─────────────────────────────────────────────────────────────────────────

export { MemoryEngine } from './engine';
export type { MemoryEngineOptions } from './engine';

// ─────────────────────────────────────────────────────────────────────────
// Storage layer
// ─────────────────────────────────────────────────────────────────────────

export { SqliteStore } from './store/sqlite-store';
export { BlobStore } from './store/blob-store';
export { HybridSearch, DEFAULT_WEIGHTS } from './store/hybrid-search';
export type { HybridSearchWeights, HybridSearchInput } from './store/hybrid-search';
export { ulid } from './store/ulid';

export type {
  KbKind,
  Tier,
  MemoryLevel,
  ProtectionFlags,
  MemoryEntry,
  WriteEntryInput,
  LevelQueryInput,
  SearchResult,
} from './store/types';

// ─────────────────────────────────────────────────────────────────────────
// Hierarchy engine
// ─────────────────────────────────────────────────────────────────────────

export { HierarchyQuery } from './hierarchy/hierarchy-query';
export { BranchStore } from './hierarchy/branch-store';
export { PromotionEngine } from './hierarchy/promotion';
export type { PromotionResult } from './hierarchy/promotion';
export {
  shouldCompress,
  shouldMoveTier,
  validateProtectionFlags,
  makeSubagentReturnFlags,
} from './hierarchy/compress-guard';

export type {
  LevelBoosts,
  HierarchyQueryInput,
  HierarchyQueryResult,
  RankedResult,
  CreateBranchInput,
  CreateBranchResult,
  PromoteInput,
} from './hierarchy/types';
export { DEFAULT_LEVEL_BOOSTS } from './hierarchy/types';

// ─────────────────────────────────────────────────────────────────────────
// Subagent
// ─────────────────────────────────────────────────────────────────────────

export { SubagentHarnessManager, SubagentHarnessError } from './subagent/harness';
export { ReturnAbsorber } from './subagent/return-absorber';
export type {
  SubagentConstraints,
  SubagentHarness,
  SubagentReturn,
  InvokeSubagentInput,
  AbsorbResult,
} from './subagent/types';
export { DEFAULT_SUBAGENT_CONSTRAINTS } from './subagent/types';

// ─────────────────────────────────────────────────────────────────────────
// Audit chain
// ─────────────────────────────────────────────────────────────────────────

export { AuditChainWriter } from './audit/chain-writer';
export type {
  MemoryAuditKind,
  ActorRef,
  TargetRef,
  ProvenanceInfo,
  AuditEntry,
  AppendAuditInput,
  ChainVerifyResult,
} from './audit/types';

// ─────────────────────────────────────────────────────────────────────────
// Migrations
// ─────────────────────────────────────────────────────────────────────────

export {
  HIERARCHY_MIGRATIONS,
  MigrationRunner,
  BASE_KB_BOOTSTRAP,
  type Migration,
} from './migrations/index';
export { MigrationDriftError } from './migrations/runner';
