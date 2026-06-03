// SPDX-License-Identifier: Apache-2.0
// @bc CS-011 Recall
// @gate G11.1, G11.2

import type { MemoryEntry, MemoryId, MemoryTier, MemoryTierStore } from "@orqenix/memory-tiers";

export interface RecallOptions {
  k?: number;
  tiers?: MemoryTier[];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

export class KeywordRecall {
  constructor(
    private readonly memStore: MemoryTierStore,
    private readonly scopeId: string,
  ) {
    void this.scopeId;
  }

  recall(query: string, opts: RecallOptions = {}): MemoryEntry[] {
    const k = Math.min(opts.k ?? 5, 50);
    const tiers: MemoryTier[] = opts.tiers ?? ["working", "episodic", "semantic", "procedural"];
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const candidates: MemoryEntry[] = [];
    for (const t of tiers) {
      candidates.push(...this.memStore.listByTier(t, { limit: 1000 }));
    }

    const scored = candidates
      .map((m) => {
        const text = m.content.toLowerCase();
        let hits = 0;
        for (const tok of tokens) {
          const rx = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
          hits += (text.match(rx) ?? []).length;
        }
        return { m, score: hits * (0.5 + m.confidence) };
      })
      .filter((x) => x.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k).map((x) => x.m);
    for (const m of top) {
      try {
        this.memStore.recordAccess(m.id as MemoryId);
      } catch {
        /* swallow */
      }
    }
    return top;
  }
}
