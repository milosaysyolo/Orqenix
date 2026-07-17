// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  DropStrategy,
  SummarizeStrategy,
  DistillStrategy,
  CompressChainStrategy,
} from "@orqenix/compress-strategies";
import { SmartCompressionEngine } from "@orqenix/smart-compression";
import { createV2Plugin } from "../src/context/v2.js";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function newPlugin(target: number) {
  const engine = new SmartCompressionEngine({
    config: { targetTokens: target, maxTokens: target * 3 },
    scopeId: SCOPE,
    strategies: {
      drop: new DropStrategy(),
      summarize: new SummarizeStrategy({ localFallback: true }),
      distill: new DistillStrategy({ extract: () => [] }),
      "compress-chain": new CompressChainStrategy({
        distill: new DistillStrategy({ extract: () => [] }),
        summarize: new SummarizeStrategy({ localFallback: true }),
      }),
    },
  });
  return createV2Plugin({ engine });
}

describe("v2 plugin", () => {
  it("preserves system message as tier 0", async () => {
    const v2 = newPlugin(50);
    const r = await v2.run({
      threshold: 50,
      context: [
        { role: "system", content: "core locked instructions" },
        { role: "user", content: "x".repeat(800) },
        { role: "assistant", content: "y".repeat(800) },
        { role: "user", content: "current" },
      ],
    });
    expect(r.compressed).toBe(true);
    expect(r.metrics.preservedTier0Count).toBe(1);
    expect(r.context[0]?.content).toContain("core locked");
  });

  it("returns rich v2 metrics shape", async () => {
    const v2 = newPlugin(100);
    const r = await v2.run({
      threshold: 100,
      context: [
        { role: "system", content: "sys" },
        { role: "user", content: "x".repeat(1500) },
      ],
    });
    expect(r.metrics.ratio).toBeLessThanOrEqual(1);
    expect(r.metrics.strategyId).toMatch(/^(drop|distill|compress-chain|summarize)$/);
    expect(r.decisionReason).toBeTruthy();
  });

  it("passes through when context already small", async () => {
    const v2 = newPlugin(1000);
    const r = await v2.run({ threshold: 1000, context: [{ role: "user", content: "hi" }] });
    expect(r.compressed).toBe(false);
    expect(r.context).toEqual([{ role: "user", content: "hi" }]);
  });
});
