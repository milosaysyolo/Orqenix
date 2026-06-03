// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import plugin, { ConfigSchema } from "../src/v1";

describe("v1 contract preservation", () => {
  it("public API surface unchanged", () => {
    expect(typeof plugin.run).toBe("function");
    expect(ConfigSchema._def.typeName).toBe("ZodObject");
  });

  it("config schema keys unchanged", () => {
    expect(Object.keys(ConfigSchema.shape).sort()).toEqual(["targetRatio", "threshold"]);
  });

  it("empty context passthrough", async () => {
    const r = await plugin.run({ context: [], threshold: 1000 });
    expect(r.compressed).toBe(false);
    expect(r.context).toEqual([]);
  });

  it("below threshold passthrough", async () => {
    const r = await plugin.run({ context: [{ role: "user", content: "hi" }], threshold: 1000 });
    expect(r.compressed).toBe(false);
  });

  it("above threshold compresses", async () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(120),
    }));
    const r = await plugin.run({ context: msgs, threshold: 200 });
    expect(r.compressed).toBe(true);
    expect(r.metrics.tokensOut).toBeLessThan(r.metrics.tokensIn);
    expect(r.context.length).toBeGreaterThanOrEqual(1);
  });
});
