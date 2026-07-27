// SPDX-License-Identifier: Apache-2.0
// packages/mesh-transport-http/src/dedup-cache.ts
/**
 * Bounded LRU dedup cache keyed by request.id.
 * Agent note: per CR v7.2 Chapter 3.5, TTL equals request.deadlineMs. O(1) ops.
 */
import type { MeshResponse } from "@orqenix/mesh-transport-core";

interface Entry {
  resp: MeshResponse;
  expiresAt: number;
}

export interface DedupCacheOptions {
  maxEntries?: number;
  now?: () => number;
}

export class DedupCache {
  private readonly map = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: DedupCacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 10_000;
    this.now = opts.now ?? Date.now;
  }

  get(id: string): MeshResponse | undefined {
    const e = this.map.get(id);
    if (!e) return undefined;
    if (this.now() >= e.expiresAt) {
      this.map.delete(id);
      return undefined;
    }
    this.map.delete(id);
    this.map.set(id, e);
    return e.resp;
  }

  set(id: string, resp: MeshResponse, ttlMs: number): void {
    if (this.map.has(id)) this.map.delete(id);
    this.map.set(id, { resp, expiresAt: this.now() + Math.max(0, ttlMs) });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  size(): number {
    return this.map.size;
  }
}
