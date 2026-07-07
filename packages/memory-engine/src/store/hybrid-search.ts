// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Hybrid search
//
// Reuses Phase 4 hybrid search weights (vector 0.5 + BM25 0.3 + trigram 0.1
// + recency 0.1). Replaces the D8.α.3 ProjectIndex.query() stub with real
// search against SQLite memory.db.

import type { Database } from "better-sqlite3";
import type { KbKind, MemoryEntry, SearchResult, Tier, ProtectionFlags } from "./types";

export interface HybridSearchWeights {
  vector: number;
  bm25: number;
  trigram: number;
  recency: number;
}

export const DEFAULT_WEIGHTS: HybridSearchWeights = {
  vector: 0.5,
  bm25: 0.3,
  trigram: 0.1,
  recency: 0.1,
};

const KB_TABLE: Record<KbKind, string> = {
  chat: "chat_entries",
  code: "code_entries",
  decision: "decision_entries",
  lesson: "lesson_entries",
};

const TIER_BOOST: Record<Tier, number> = {
  T1: 0.1,
  T2: 0.05,
  T3: 0,
  T4: -0.05,
};

export interface HybridSearchInput {
  query: string;
  queryEmbedding?: Float32Array;
  kbs: KbKind[];
  /** Scope filter: branch_id + optional session_id */
  branchId: string;
  sessionId?: string;
  memoryLevel: "session" | "branch" | "project";
  projectId: string;
  limit: number;
}

/**
 * Hybrid search against the SQLite store. For Phase 8 D8.α.6, we implement:
 *   - BM25-ish keyword scoring via LIKE + term frequency
 *   - Trigram substring matching
 *   - Recency boost
 *   - Vector scoring when sqlite-vec available + queryEmbedding provided
 *
 * The Phase 4 RTK noise filter + Light Reindex are composed at the engine
 * level; this class provides the raw scored candidates.
 */
export class HybridSearch {
  constructor(
    private readonly db: Database,
    private readonly weights: HybridSearchWeights = DEFAULT_WEIGHTS,
  ) {}

  search(input: HybridSearchInput): SearchResult[] {
    const results: SearchResult[] = [];

    for (const kb of input.kbs) {
      const table = KB_TABLE[kb];
      const rows = this.queryTable(table, input);
      for (const row of rows) {
        const entry = this.rowToEntry(row, kb);
        const scores = this.scoreEntry(entry, input);
        const rawScore =
          scores.vector * this.weights.vector +
          scores.bm25 * this.weights.bm25 +
          scores.trigram * this.weights.trigram +
          scores.recency * this.weights.recency +
          (TIER_BOOST[entry.tier] ?? 0);

        results.push({ entry, rawScore: Math.max(0, Math.min(1, rawScore)), scores });
      }
    }

    return results.sort((a, b) => b.rawScore - a.rawScore).slice(0, input.limit);
  }

  private queryTable(table: string, input: HybridSearchInput): Record<string, unknown>[] {
    // Scope filter: entries at this level for this branch (+ session if session-level)
    const conditions: string[] = ["project_id = @projectId", "memory_level = @level"];
    const params: Record<string, unknown> = {
      projectId: input.projectId,
      level: input.memoryLevel,
    };

    if (input.memoryLevel === "session") {
      conditions.push("session_id = @sessionId");
      params.sessionId = input.sessionId ?? "";
    } else if (input.memoryLevel === "branch") {
      conditions.push("branch_id = @branchId");
      params.branchId = input.branchId;
    }
    // project level: no branch/session filter

    const sql = `
      SELECT * FROM ${table}
      WHERE ${conditions.join(" AND ")}
      LIMIT 500
    `;
    return this.db.prepare(sql).all(params) as Record<string, unknown>[];
  }

  private rowToEntry(row: Record<string, unknown>, kb: KbKind): MemoryEntry {
    let embedding: Float32Array | null = null;
    if (row.embedding instanceof Buffer) {
      embedding = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
    }
    let protectionFlags: ProtectionFlags | null = null;
    if (typeof row.protection_flags === "string" && row.protection_flags.length > 0) {
      try {
        protectionFlags = JSON.parse(row.protection_flags) as ProtectionFlags;
      } catch {
        protectionFlags = null;
      }
    }
    return {
      id: row.id as string,
      hash: row.hash as string,
      kb,
      tier: row.tier as Tier,
      content: (row.content as string | null) ?? null,
      embedding,
      project_id: row.project_id as string,
      branch_id: (row.branch_id as string) ?? "",
      session_id: (row.session_id as string | null) ?? null,
      memory_level: (row.memory_level as MemoryEntry["memory_level"]) ?? "project",
      protection_flags: protectionFlags,
      cloned_from_branch_id: (row.cloned_from_branch_id as string | null) ?? null,
      promoted_from_session_id: (row.promoted_from_session_id as string | null) ?? null,
      promoted_from_branch_id: (row.promoted_from_branch_id as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: (row.updated_at as string) ?? (row.created_at as string),
    };
  }

  private scoreEntry(entry: MemoryEntry, input: HybridSearchInput): SearchResult["scores"] {
    const content = (entry.content ?? "").toLowerCase();
    const queryLower = input.query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    // BM25-ish: term frequency normalized
    let termHits = 0;
    for (const term of queryTerms) {
      if (content.includes(term)) termHits += 1;
    }
    const bm25 = queryTerms.length > 0 ? termHits / queryTerms.length : 0;

    // Trigram: substring overlap ratio
    const trigram = this.trigramScore(content, queryLower);

    // Vector: cosine similarity if both embeddings present
    let vector = 0;
    if (entry.embedding && input.queryEmbedding) {
      vector = this.cosine(entry.embedding, input.queryEmbedding);
    }

    // Recency boost
    const recency = this.recencyScore(entry.created_at);

    return { vector, bm25, trigram, recency };
  }

  private trigramScore(content: string, query: string): number {
    if (query.length < 3) return content.includes(query) ? 0.5 : 0;
    const queryGrams = this.trigrams(query);
    let hits = 0;
    for (const g of queryGrams) {
      if (content.includes(g)) hits += 1;
    }
    return queryGrams.size > 0 ? hits / queryGrams.size : 0;
  }

  private trigrams(s: string): Set<string> {
    const grams = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) {
      grams.add(s.slice(i, i + 3));
    }
    return grams;
  }

  private cosine(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] as number) * (b[i] as number);
      normA += (a[i] as number) ** 2;
      normB += (b[i] as number) ** 2;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private recencyScore(createdAt: string): number {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const hour = 3600 * 1000;
    if (ageMs < hour) return 1.0;
    if (ageMs < 24 * hour) return 0.5;
    if (ageMs < 7 * 24 * hour) return 0.25;
    return 0.05;
  }
}
