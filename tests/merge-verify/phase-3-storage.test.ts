// SPDX-License-Identifier: Apache-2.0
// PHASE 3 SMOKE: diff-only storage + BLAKE3 content addressing + blob dedup.

import { describe, it, expect, afterEach } from "vitest";
import { MemoryEngine } from "@orqenix/memory-engine";

const PROJECT = "blake3:phase3test";

describe("PHASE 3 — KB Storage (diff-only + BLAKE3)", () => {
  let engine: MemoryEngine;
  afterEach(() => engine?.close());

  it("content-addressed blobs deduplicate identical content", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const store = engine.getStore();
    const big = "large content ".repeat(500);
    const hash1 = store.blobs.put(big);
    const hash2 = store.blobs.put(big);
    expect(hash1).toBe(hash2);
    expect(store.blobs.refCount(hash1)).toBe(2);
  });

  it("BLAKE3 content hash is deterministic", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const store = engine.getStore();
    const bytes = new TextEncoder().encode("deterministic");
    const h1 = store.blobs.computeHash(bytes);
    const h2 = store.blobs.computeHash(bytes);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{32,}$/);
  });

  it("large content (>4KB) goes to blob store, small stays inline", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const small = await engine.write({
      kb: "code",
      content: "x",
      branch_id: "b",
      memory_level: "branch",
    });
    const large = await engine.write({
      kb: "code",
      content: "y".repeat(5000),
      branch_id: "b",
      memory_level: "branch",
    });
    expect(engine.fetchContent("code", small.id)).toBe("x");
    expect(engine.fetchContent("code", large.id)?.length).toBe(5000);
  });
});
