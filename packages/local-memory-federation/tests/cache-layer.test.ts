// SPDX-License-Identifier: Apache-2.0
// Tests for CacheLayer

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheLayer } from "../src/cache-layer";
import type { CrossProjectQuery, FederationResult, ProjectId } from "../src/types";

const PROJECT_A = "blake3:aaaaaaaa00000000" as ProjectId;
const PROJECT_B = "blake3:bbbbbbbb00000000" as ProjectId;

function makeQuery(query = "auth"): CrossProjectQuery {
  return {
    query,
    limit: 20,
    skipCache: false,
  };
}

function makeResult(durationMs = 50): FederationResult {
  return {
    query: makeQuery(),
    candidates: [],
    projects_queried: [],
    projects_with_results: [],
    duration_ms: durationMs,
    cache_hit: false,
  };
}

describe("CacheLayer", () => {
  it("stores and retrieves results", () => {
    const cache = new CacheLayer({ ttlMs: 1000, maxSize: 10 });
    const q = makeQuery("test");
    const r = makeResult(100);

    expect(cache.get(PROJECT_A, q)).toBeNull();
    cache.set(PROJECT_A, q, r);
    expect(cache.get(PROJECT_A, q)).toEqual(r);
  });

  it("returns null after TTL expires", () => {
    vi.useFakeTimers();
    const cache = new CacheLayer({ ttlMs: 1000, maxSize: 10 });
    const q = makeQuery();
    cache.set(PROJECT_A, q, makeResult());

    expect(cache.get(PROJECT_A, q)).not.toBeNull();

    vi.advanceTimersByTime(1500);
    expect(cache.get(PROJECT_A, q)).toBeNull();

    vi.useRealTimers();
  });

  it("isolates cache by current project (no cross-project leakage)", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 10 });
    const q = makeQuery("shared-query");
    const r = makeResult();

    cache.set(PROJECT_A, q, r);

    // Same query but different current project must not hit cache
    expect(cache.get(PROJECT_B, q)).toBeNull();
    expect(cache.get(PROJECT_A, q)).toEqual(r);
  });

  it("treats different queries as different keys", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 10 });
    cache.set(PROJECT_A, makeQuery("auth"), makeResult(10));
    cache.set(PROJECT_A, makeQuery("test"), makeResult(20));

    expect(cache.get(PROJECT_A, makeQuery("auth"))?.duration_ms).toBe(10);
    expect(cache.get(PROJECT_A, makeQuery("test"))?.duration_ms).toBe(20);
  });

  it("evicts oldest entry when at capacity (LRU)", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 2 });
    cache.set(PROJECT_A, makeQuery("q1"), makeResult(1));
    cache.set(PROJECT_A, makeQuery("q2"), makeResult(2));
    cache.set(PROJECT_A, makeQuery("q3"), makeResult(3)); // evicts q1

    expect(cache.size()).toBe(2);
    expect(cache.get(PROJECT_A, makeQuery("q1"))).toBeNull();
    expect(cache.get(PROJECT_A, makeQuery("q2"))).not.toBeNull();
    expect(cache.get(PROJECT_A, makeQuery("q3"))).not.toBeNull();
  });

  it("promotes recently-accessed entries to most-recent (LRU)", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 2 });
    cache.set(PROJECT_A, makeQuery("q1"), makeResult(1));
    cache.set(PROJECT_A, makeQuery("q2"), makeResult(2));

    // Access q1 → moves to most-recent
    cache.get(PROJECT_A, makeQuery("q1"));

    // Adding q3 should evict q2 (oldest), not q1
    cache.set(PROJECT_A, makeQuery("q3"), makeResult(3));

    expect(cache.get(PROJECT_A, makeQuery("q1"))).not.toBeNull();
    expect(cache.get(PROJECT_A, makeQuery("q2"))).toBeNull();
    expect(cache.get(PROJECT_A, makeQuery("q3"))).not.toBeNull();
  });

  it("clear() removes all entries", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 10 });
    cache.set(PROJECT_A, makeQuery("q1"), makeResult());
    cache.set(PROJECT_A, makeQuery("q2"), makeResult());
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("produces deterministic keys for equivalent queries", () => {
    const cache = new CacheLayer({ ttlMs: 60000, maxSize: 10 });
    const q1: CrossProjectQuery = {
      query: "auth",
      kinds: ["decision", "lesson"],
      limit: 20,
      skipCache: false,
    };
    const q2: CrossProjectQuery = {
      query: "auth",
      kinds: ["lesson", "decision"], // different order
      limit: 20,
      skipCache: false,
    };

    cache.set(PROJECT_A, q1, makeResult(42));
    // Same query content (kinds sorted internally) should hit cache
    expect(cache.get(PROJECT_A, q2)?.duration_ms).toBe(42);
  });
});
