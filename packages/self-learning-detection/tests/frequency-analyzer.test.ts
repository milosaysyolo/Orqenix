// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { FrequencyAnalyzer } from "../src/frequency-analyzer";
import { DEFAULT_THRESHOLDS } from "../src/types";
import type { ActionSequence } from "../src/types";

function seq(kinds: string[], success: boolean, durationMs = 5000): ActionSequence {
  return { actionKinds: kinds, observationIds: [`obs-${Math.random()}`], success, durationMs };
}

describe("FrequencyAnalyzer", () => {
  it("requires minimum occurrences (5)", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    // Only 4 occurrences → below threshold
    const sequences = Array.from({ length: 4 }, () => seq(["edit", "test"], true));
    const patterns = analyzer.analyze(sequences);
    expect(patterns).toHaveLength(0);
  });

  it("surfaces patterns meeting frequency + success thresholds", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    // 6 occurrences, all success → passes
    const sequences = Array.from({ length: 6 }, () => seq(["edit", "test", "commit"], true));
    const patterns = analyzer.analyze(sequences);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.occurrenceCount).toBe(6);
    expect(patterns[0]?.successRate).toBe(1);
  });

  it("rejects patterns below success rate threshold (80%)", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    // 6 occurrences but only 3 success = 50% < 80%
    const sequences = [
      ...Array.from({ length: 3 }, () => seq(["a", "b"], true)),
      ...Array.from({ length: 3 }, () => seq(["a", "b"], false)),
    ];
    const patterns = analyzer.analyze(sequences);
    expect(patterns).toHaveLength(0);
  });

  it("accepts patterns at exactly 80% success", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    // 10 occurrences, 8 success = 80%
    const sequences = [
      ...Array.from({ length: 8 }, () => seq(["x", "y"], true)),
      ...Array.from({ length: 2 }, () => seq(["x", "y"], false)),
    ];
    const patterns = analyzer.analyze(sequences);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.successRate).toBe(0.8);
  });

  it("ranks patterns by impact score", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    const sequences = [
      // High frequency + long duration → high impact
      ...Array.from({ length: 20 }, () => seq(["big", "workflow"], true, 30000)),
      // Lower frequency + short duration → lower impact
      ...Array.from({ length: 6 }, () => seq(["small", "task"], true, 3000)),
    ];
    const patterns = analyzer.analyze(sequences);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]!.impactScore).toBeGreaterThan(patterns[1]!.impactScore);
  });

  it("generates suggested name + description", () => {
    const analyzer = new FrequencyAnalyzer(DEFAULT_THRESHOLDS);
    const sequences = Array.from({ length: 6 }, () => seq(["file_edit", "test_run"], true));
    const patterns = analyzer.analyze(sequences);
    expect(patterns[0]?.suggestedName).toContain("@local/");
    expect(patterns[0]?.suggestedDescription).toContain("Recurring");
  });
});
