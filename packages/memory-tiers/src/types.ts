import type { ScopeId } from "@orqenix/core";

export type Tier = "working" | "episodic" | "semantic" | "global";

export interface MemoryEntry {
  id: string;
  scope: string;
  tier: Tier;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  importance: number;
  protected: boolean;
  expiresAt?: number;
}

export interface MemoryQuery {
  scope?: string;
  tier?: Tier;
  type?: string;
  since?: number;
  until?: number;
  importanceMin?: number;
  text?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  workingTTL: string | null;
  episodicTTL: string;
  semanticTTL: string;
  globalEnabled: boolean;
  globalTTL: string;
  maxSizeMB: Record<Tier, number>;
  cleanup: "lru" | "importance";
}

export interface CleanupPlan {
  scope: string;
  tier: Tier;
  candidates: number;
  totalBytes: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  protectedCount: number;
  checkpointCount: number;
  willRemove: MemoryEntry[];
  willPreserve: MemoryEntry[];
}

export interface CleanupResult {
  scope: string;
  removed: number;
  bytesFreed: number;
  durationMs: number;
}
