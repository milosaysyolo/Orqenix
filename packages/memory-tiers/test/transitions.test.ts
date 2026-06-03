import { describe, it, expect } from "vitest";
import { evaluatePromotion, canDemote, nextTier } from "../src/transitions";
import { DEFAULT_POLICY, type MemoryEntry } from "../src/contracts";

function mk(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: "mem:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as any,
    tier: "working",
    type: "fact",
    content: "x",
    contentHash: "0".repeat(64),
    sourceEntryIds: ["ce:1"],
    confidence: 0.8,
    createdAt: "2026-01-01T00:00:00Z",
    lastAccessedAt: "2026-01-01T00:00:00Z",
    accessCount: 0,
    scopeId: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    metadata: {},
    ...overrides,
  };
}

const NOW = new Date("2026-06-01T00:00:00Z").getTime();

describe("transitions", () => {
  it("working stays put without access or age", () => {
    expect(evaluatePromotion(mk({ accessCount: 0 }), NOW, DEFAULT_POLICY)).toBeNull();
  });
  it("working -> episodic when criteria met", () => {
    expect(evaluatePromotion(mk({ accessCount: 5 }), NOW, DEFAULT_POLICY)).toBe("episodic");
  });
  it("episodic -> semantic requires confidence", () => {
    expect(
      evaluatePromotion(
        mk({ tier: "episodic", accessCount: 10, confidence: 0.5 }),
        NOW,
        DEFAULT_POLICY,
      ),
    ).toBeNull();
    expect(
      evaluatePromotion(
        mk({ tier: "episodic", accessCount: 10, confidence: 0.9 }),
        NOW,
        DEFAULT_POLICY,
      ),
    ).toBe("semantic");
  });
  it("semantic -> procedural only for required types", () => {
    expect(
      evaluatePromotion(
        mk({ tier: "semantic", type: "fact", accessCount: 20 }),
        NOW,
        DEFAULT_POLICY,
      ),
    ).toBeNull();
    expect(
      evaluatePromotion(
        mk({ tier: "semantic", type: "skill", accessCount: 20 }),
        NOW,
        DEFAULT_POLICY,
      ),
    ).toBe("procedural");
  });
  it("procedural is terminal", () => {
    expect(
      evaluatePromotion(
        mk({ tier: "procedural", type: "skill", accessCount: 999 }),
        NOW,
        DEFAULT_POLICY,
      ),
    ).toBeNull();
  });
  it("canDemote only allows working and episodic", () => {
    expect(canDemote("working")).toBe(true);
    expect(canDemote("episodic")).toBe(true);
    expect(canDemote("semantic")).toBe(false);
    expect(canDemote("procedural")).toBe(false);
  });
  it("nextTier maps correctly", () => {
    expect(nextTier("working")).toBe("episodic");
    expect(nextTier("episodic")).toBe("semantic");
    expect(nextTier("semantic")).toBe("procedural");
    expect(nextTier("procedural")).toBeNull();
  });
});
