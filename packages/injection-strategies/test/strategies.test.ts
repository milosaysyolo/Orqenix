// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { STRATEGIES, DEFAULT_STRATEGY, getStrategy } from "../src";
import type { MemoryEntry } from "@orqenix/memory-tiers";

function mem(
  id: string,
  tier: "working" | "episodic" | "semantic" | "procedural",
  content: string,
  confidence = 0.8,
): MemoryEntry {
  return {
    id: `mem:${id.padEnd(32, "A")}` as any,
    tier,
    type: "fact",
    content,
    contentHash: "0".repeat(64),
    sourceEntryIds: ["ce:1"],
    confidence,
    createdAt: "2026-01-01T00:00:00Z",
    lastAccessedAt: "2026-01-01T00:00:00Z",
    accessCount: 0,
    scopeId: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    metadata: {},
  };
}

const baseMsgs = [
  { role: "system" as const, content: "You are helpful." },
  { role: "user" as const, content: "What did I prefer?" },
];
const memList = [
  mem("M01", "working", "I prefer Rust"),
  mem("M02", "episodic", "I decided to use SQLite"),
  mem("M03", "semantic", "I learned BLAKE3 is fast"),
  mem("M04", "procedural", "How to ship Phase 5: incremental gates"),
];

describe("5 injection strategies", () => {
  it("default is B", () => {
    expect(DEFAULT_STRATEGY.name).toBe("B");
  });

  it("A prepends ALL memories to system", () => {
    const out = STRATEGIES.A.apply({ messages: baseMsgs, memories: memList });
    expect(out.strategy).toBe("A");
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[0].content).toContain("I prefer Rust");
    expect(out.messages[0].content).toContain("How to ship Phase 5");
    expect(out.injectedMemoryIds.length).toBe(4);
  });

  it("B only includes working + episodic", () => {
    const out = STRATEGIES.B.apply({ messages: baseMsgs, memories: memList });
    expect(out.strategy).toBe("B");
    expect(out.messages[0].content).toContain("I prefer Rust");
    expect(out.messages[0].content).not.toContain("BLAKE3 is fast");
    expect(out.injectedMemoryIds.length).toBe(2);
  });

  it("C annotates the last user message", () => {
    const out = STRATEGIES.C.apply({ messages: baseMsgs, memories: memList });
    const lastUser = out.messages[out.messages.length - 1];
    expect(lastUser.role).toBe("user");
    expect(lastUser.content).toContain("I prefer Rust");
    expect(lastUser.content).toContain("What did I prefer?");
  });

  it("D injects a fake assistant turn before the user question", () => {
    const out = STRATEGIES.D.apply({ messages: baseMsgs, memories: memList });
    const idxUser = out.messages.findIndex((m) => m.content === "What did I prefer?");
    expect(idxUser).toBeGreaterThanOrEqual(1);
    expect(out.messages[idxUser - 1].role).toBe("assistant");
    expect(out.messages[idxUser - 1].content).toContain("I recall");
  });

  it("E ranks by confidence and picks top-k", () => {
    const memsVar = [
      mem("M01", "working", "low", 0.3),
      mem("M02", "working", "high", 0.95),
      mem("M03", "working", "mid", 0.6),
    ];
    const out = STRATEGIES.E.apply({ messages: baseMsgs, memories: memsVar, k: 2 });
    expect(out.injectedMemoryIds.length).toBe(2);
    expect(out.messages[0].content).toContain("high");
    expect(out.messages[0].content).toContain("mid");
    expect(out.messages[0].content).not.toContain("low");
  });

  it("all strategies respect tokenBudget", () => {
    const big = Array.from({ length: 100 }, (_, i) =>
      mem(`M${String(i).padStart(2, "0")}`, "working", `memory content ${i} `.repeat(20)),
    );
    for (const s of Object.values(STRATEGIES)) {
      const out = s.apply({ messages: baseMsgs, memories: big, tokenBudget: 200, k: 50 });
      expect(out.tokensUsed).toBeLessThanOrEqual(220);
    }
  });

  it("getStrategy returns correct instance", () => {
    expect(getStrategy("A").name).toBe("A");
    expect(getStrategy("E").name).toBe("E");
  });
});
