import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryManager } from "../src/memory-manager.js";
import type { RetentionPolicy } from "../src/types.js";
import { parseDuration } from "../src/duration.js";

const POLICY: RetentionPolicy = {
  workingTTL: null,
  episodicTTL: "7d",
  semanticTTL: "90d",
  globalEnabled: false,
  globalTTL: "365d",
  maxSizeMB: { working: 50, episodic: 100, semantic: 500, global: 0 },
  cleanup: "lru",
};

describe("parseDuration", () => {
  it("parses common units", () => {
    expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration("24h")).toBe(24 * 60 * 60 * 1000);
    expect(parseDuration("30m")).toBe(30 * 60 * 1000);
    expect(parseDuration("60s")).toBe(60 * 1000);
    expect(parseDuration("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  it("returns null for null input", () => {
    expect(parseDuration(null)).toBeNull();
  });

  it("throws on invalid format", () => {
    expect(() => parseDuration("bad")).toThrow();
  });
});

describe("MemoryManager", () => {
  let projectRoot: string;
  let mm: MemoryManager;

  beforeEach(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), "orq-mem-"));
    mm = new MemoryManager({ projectRoot, policy: POLICY });
    await mm.open();
  });

  afterEach(async () => {
    await mm.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("writes and queries entries in episodic tier", async () => {
    await mm.write("episodic", {
      id: "e1",
      scope: "scope-a",
      type: "decision",
      content: "use TypeScript",
      timestamp: Date.now(),
      importance: 5,
      protected: false,
    });
    const results = await mm.query("episodic", { scope: "scope-a" });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("use TypeScript");
    expect(results[0]?.tier).toBe("episodic");
  });

  it("isolates entries between tiers", async () => {
    await mm.write("working", {
      id: "w1",
      scope: "x",
      type: "convo",
      content: "hello",
      timestamp: Date.now(),
      importance: 3,
      protected: false,
    });
    await mm.write("semantic", {
      id: "s1",
      scope: "x",
      type: "pattern",
      content: "world",
      timestamp: Date.now(),
      importance: 5,
      protected: false,
    });
    const w = await mm.query("working", {});
    const s = await mm.query("semantic", {});
    expect(w).toHaveLength(1);
    expect(s).toHaveLength(1);
    expect(w[0]?.content).toBe("hello");
    expect(s[0]?.content).toBe("world");
  });

  it("refuses global tier when not enabled", async () => {
    await expect(
      mm.write("global", {
        id: "g1",
        scope: "x",
        type: "shared",
        content: "x",
        timestamp: Date.now(),
        importance: 1,
        protected: false,
      }),
    ).rejects.toThrow(/not enabled/);
  });

  it("respects importance filter in query", async () => {
    const now = Date.now();
    for (let i = 1; i <= 5; i++) {
      await mm.write("episodic", {
        id: `e${i}`,
        scope: "x",
        type: "t",
        content: `c${i}`,
        timestamp: now + i,
        importance: i,
        protected: false,
      });
    }
    const high = await mm.query("episodic", { importanceMin: 4 });
    expect(high).toHaveLength(2);
  });

  it("plans cleanup of old entries respecting protected flag", async () => {
    const now = Date.now();
    const oldTime = now - 10 * 24 * 60 * 60 * 1000;
    await mm.write("episodic", {
      id: "old-unprotected",
      scope: "x",
      type: "t",
      content: "old",
      timestamp: oldTime,
      importance: 1,
      protected: false,
    });
    await mm.write("episodic", {
      id: "old-protected",
      scope: "x",
      type: "t",
      content: "old protected",
      timestamp: oldTime,
      importance: 1,
      protected: true,
    });
    await mm.write("episodic", {
      id: "old-checkpoint",
      scope: "x",
      type: "checkpoint",
      content: "checkpoint",
      timestamp: oldTime,
      importance: 1,
      protected: false,
    });

    const plans = await mm.planCleanupForScope("x");
    const episodicPlan = plans.find((p) => p.tier === "episodic");
    expect(episodicPlan).toBeDefined();
    expect(episodicPlan?.willRemove).toHaveLength(1);
    expect(episodicPlan?.willRemove[0]?.id).toBe("old-unprotected");
    expect(episodicPlan?.protectedCount).toBe(1);
    expect(episodicPlan?.checkpointCount).toBe(1);
  });

  it("executes cleanup and returns metrics", async () => {
    const old = Date.now() - 10 * 24 * 60 * 60 * 1000;
    await mm.write("episodic", {
      id: "drop",
      scope: "x",
      type: "t",
      content: "0123456789",
      timestamp: old,
      importance: 1,
      protected: false,
    });
    const plans = await mm.planCleanupForScope("x");
    const results = await mm.executeCleanup(plans);
    const ep = results.find((r) => r.scope === "x");
    expect(ep).toBeDefined();
    const remaining = await mm.query("episodic", { scope: "x" });
    expect(remaining).toHaveLength(0);
  });

  it("exports and imports a scope as JSON", async () => {
    await mm.write("episodic", {
      id: "e1",
      scope: "src",
      type: "t",
      content: "content",
      timestamp: Date.now(),
      importance: 3,
      protected: false,
    });

    const dump = await mm.exportScope("src");
    expect(dump.episodic).toHaveLength(1);

    await mm.store("episodic").delete("e1");
    expect(await mm.query("episodic", { scope: "src" })).toHaveLength(0);

    const imported = await mm.importDump(dump);
    expect(imported).toBe(1);
    expect(await mm.query("episodic", { scope: "src" })).toHaveLength(1);
  });

  it("computes stats per tier", async () => {
    await mm.write("episodic", {
      id: "e1",
      scope: "x",
      type: "t",
      content: "abc",
      timestamp: Date.now(),
      importance: 3,
      protected: false,
    });
    const stats = await mm.stats("x");
    expect(stats.episodic.count).toBe(1);
    expect(stats.episodic.bytes).toBe(3);
    expect(stats.working.count).toBe(0);
  });

  it("sweeps expired entries", async () => {
    await mm.write("working", {
      id: "expired",
      scope: "x",
      type: "t",
      content: "old",
      timestamp: Date.now() - 1000,
      importance: 1,
      protected: false,
      expiresAt: Date.now() - 100,
    });
    await mm.write("working", {
      id: "alive",
      scope: "x",
      type: "t",
      content: "fresh",
      timestamp: Date.now(),
      importance: 1,
      protected: false,
    });
    const swept = await mm.sweepAllExpired();
    expect(swept.working).toBe(1);
    const remaining = await mm.query("working", {});
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("alive");
  });
});
