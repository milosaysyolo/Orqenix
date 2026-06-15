// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Storage layer types

/** The 4 Knowledge Base kinds (CR v8.0 Section 4.2) */
export type KbKind = 'chat' | 'code' | 'decision' | 'lesson';

/** Memory tiers (CR v8.0 Section 4.2) */
export type Tier = 'T1' | 'T2' | 'T3' | 'T4';

/** Hierarchy memory level */
export type MemoryLevel = 'session' | 'branch' | 'project';

/** Protection flags for subagent returns + pinned entries (INV-13) */
export interface ProtectionFlags {
  kind: 'subagent_return' | 'pinned';
  immutable: boolean;
  never_compress: boolean;
  never_move_tier: boolean;
  duplicate_in_tiers?: Tier[];
  subagent_session_id?: string;
  subagent_kind?: string;
  parent_session_id?: string;
  returned_at?: string;
}

/** A memory entry row (one cell of the matrix) */
export interface MemoryEntry {
  /** ULID */
  id: string;
  /** BLAKE3 content hash (references blob store) */
  hash: string;
  /** KB kind */
  kb: KbKind;
  /** Tier */
  tier: Tier;
  /** Inline content (small) or null if blob-stored */
  content: string | null;
  /** Embedding vector (Float32 or Int8 quantized), null if not embedded */
  embedding: Float32Array | null;
  /** Hierarchy fields */
  project_id: string;
  branch_id: string;
  session_id: string | null;
  memory_level: MemoryLevel;
  /** Protection flags JSON, null for normal entries */
  protection_flags: ProtectionFlags | null;
  /** Branch deep-copy provenance */
  cloned_from_branch_id: string | null;
  /** Promotion provenance */
  promoted_from_session_id: string | null;
  promoted_from_branch_id: string | null;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

/** Input for writing a new memory entry */
export interface WriteEntryInput {
  kb: KbKind;
  content: string;
  embedding?: Float32Array;
  tier?: Tier; // default T1
  project_id: string;
  branch_id: string;
  session_id?: string;
  memory_level: MemoryLevel;
  protection_flags?: ProtectionFlags;
  cloned_from_branch_id?: string;
  promoted_from_session_id?: string;
  promoted_from_branch_id?: string;
}

/** Query parameters scoped to a single hierarchy level */
export interface LevelQueryInput {
  query: string;
  queryEmbedding?: Float32Array;
  kbs?: KbKind[];
  level: MemoryLevel;
  scopeId: string; // session_id, branch_id, or project_id
  projectId: string;
  limit: number;
}

/** A scored search result */
export interface SearchResult {
  entry: MemoryEntry;
  /** Raw relevance score 0-1 before level boost */
  rawScore: number;
  /** Component scores for debugging */
  scores: {
    vector: number;
    bm25: number;
    trigram: number;
    recency: number;
  };
}
