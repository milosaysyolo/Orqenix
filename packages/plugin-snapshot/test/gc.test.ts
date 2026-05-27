import { describe, it, expect } from "vitest";
import { planGc, type RetentionPolicy } from "../src/index.js";

const POLICY: RetentionPolicy = {
  idleAfterDays: 30,
  deprecateAfterDays: 60,
  deleteAfterDays: 90,
  snapshotMaxCount: 20,
};

const NOW = Date.parse("2026-06-01T00:00:00Z");

function snap(id: string, daysAgo: number) {
  return {
    id,
    createdAt: NOW - daysAgo * 86400000,
    fileCount: 1,
    totalBytes: 1,
    contentHash: "x",
  };
}

describe("gc planner", () => {
  it("active to idle after idleAfterDays", () => {
    const decisions = planGc(
      [snap("a", 35)],
      { a: { state: "active", lastTouchedAt: NOW - 35 * 86400000 } },
      POLICY,
      NOW
    );
    expect(decisions[0]).toMatchObject({ id: "a", next: "idle" });
  });

  it("idle to deprecated after deprecateAfterDays", () => {
    const decisions = planGc(
      [snap("a", 70)],
      { a: { state: "idle", lastTouchedAt: NOW - 70 * 86400000 } },
      POLICY,
      NOW
    );
    expect(decisions[0]?.next).toBe("deprecated");
  });

  it("deprecated to deleted after deleteAfterDays", () => {
    const decisions = planGc(
      [snap("a", 100)],
      { a: { state: "deprecated", lastTouchedAt: NOW - 100 * 86400000 } },
      POLICY,
      NOW
    );
    expect(decisions[0]?.next).toBe("deleted");
  });

  it("snapshotMaxCount protects most recent 3", () => {
    const snaps = Array.from({ length: 25 }, (_, i) => snap(`s${i}`, i));
    const states: Record<string, { state: "active"; lastTouchedAt: number }> = {};
    for (const s of snaps) states[s.id] = { state: "active", lastTouchedAt: s.createdAt };
    const decisions = planGc(snaps, states, POLICY, NOW);
    const deletes = decisions.filter((d) => d.next === "deleted");
    expect(deletes.find((d) => d.id === "s0")).toBeUndefined();
    expect(deletes.find((d) => d.id === "s1")).toBeUndefined();
    expect(deletes.find((d) => d.id === "s2")).toBeUndefined();
  });
});
