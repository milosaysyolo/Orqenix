// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Cache layer
//
// LRU cache with 5-minute TTL for cross-project query results.
// Reduces redundant filesystem reads for repeated queries.
//
// Cache key = BLAKE3(query JSON canonical form)

import { blake3 } from "@noble/hashes/blake3";
import type { CrossProjectQuery, FederationResult, ProjectId } from "./types";

export interface CacheLayerOptions {
  /** Cache TTL in milliseconds (default 5 min) */
  ttlMs?: number;
  /** Maximum number of cached entries (default 100) */
  maxSize?: number;
}

interface CacheEntry {
  result: FederationResult;
  createdAt: number;
}

/**
 * LRU cache for federation query results.
 *
 * - Bounded size (default 100 entries)
 * - TTL-based expiration (default 5 min)
 * - Cache key derived from query content (deterministic)
 * - Per-current-project keyed (prevents cross-project cache leaks)
 */
export class CacheLayer {
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cache: Map<string, CacheEntry>;

  constructor(options: CacheLayerOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 min
    this.maxSize = options.maxSize ?? 100;
    this.cache = new Map();
  }

  /** Fetches a cached result; returns null if missing or expired */
  get(currentProjectId: ProjectId, query: CrossProjectQuery): FederationResult | null {
    const key = this.computeKey(currentProjectId, query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.createdAt > this.ttlMs) {
      // Expired
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  /** Stores a result. Evicts oldest if maxSize exceeded. */
  set(currentProjectId: ProjectId, query: CrossProjectQuery, result: FederationResult): void {
    const key = this.computeKey(currentProjectId, query);

    // Evict expired entries
    this.gc();

    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }

    this.cache.set(key, {
      result,
      createdAt: Date.now(),
    });
  }

  /** Clears all cached entries (e.g., when approvals change) */
  clear(): void {
    this.cache.clear();
  }

  /** Returns the number of cached entries */
  size(): number {
    return this.cache.size;
  }

  /** Removes expired entries (called automatically on set) */
  gc(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  private computeKey(currentProjectId: ProjectId, query: CrossProjectQuery): string {
    // Canonical query JSON (deterministic across runs)
    const canonical = JSON.stringify({
      currentProjectId,
      query: query.query,
      kinds: query.kinds ? [...query.kinds].sort() : null,
      limit: query.limit,
    });

    const bytes = new TextEncoder().encode(canonical);
    const hash = blake3(bytes);
    return Array.from(hash)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
