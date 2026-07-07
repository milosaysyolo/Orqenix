// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , thresholds-config tests
import { describe, it, expect } from "vitest";
import { loadThresholds } from "../src/thresholds-config";
describe("thresholds-config", () => {
  it("returns defaults when no overrides", () => {
    const t = loadThresholds();
    expect(t.replayTestSamplesMin).toBe(5);
    expect(t.crossValidationHoldoutPct).toBe(20);
    expect(t.successThresholdPct).toBe(80);
  });
  it("merges partial overrides", () => {
    const t = loadThresholds({ successThresholdPct: 90 });
    expect(t.successThresholdPct).toBe(90);
    expect(t.replayTestSamplesMin).toBe(5);
  });
});
