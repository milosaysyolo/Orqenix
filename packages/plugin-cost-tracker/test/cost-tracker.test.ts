import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "@orqenix/core/plugin";
import plugin, { ledger } from "../src/index.js";
import { computeCost } from "../src/pricing.js";

describe("cost-tracker plugin", () => {
  beforeEach(() => {
    ledger.clear();
  });

  it("computes Anthropic Sonnet 4 cost correctly", () => {
    const c = computeCost("anthropic/claude-sonnet-4", 1_000_000, 500_000);
    expect(c).toBeCloseTo(10.5, 2);
  });

  it("returns zero cost for local Ollama models", () => {
    expect(computeCost("ollama/qwen2.5-coder", 999_999, 999_999)).toBe(0);
  });

  it("ledgers a call when llm.call.after fires", async () => {
    const reg = new PluginRegistry();
    reg.setContextProvider(() => ({
      scope: null,
      config: {},
      log: { debug() {}, info() {}, warn() {}, error() {} },
    }));
    await reg.register(plugin);

    const scope = { full: "_default/p/d/p/s", hash: "x", short: "x", descriptor: {} as any };
    await reg.runAfter(
      "llm.call.after",
      {
        callId: "c1",
        model: "openai/gpt-4o-mini",
        messages: [],
        agentName: "dev-team-builder",
        scope,
      },
      {
        callId: "c1",
        content: "ok",
        tokens: { input: 1000, output: 2000 },
        durationMs: 500,
        finishReason: "stop",
      },
    );

    const entries = ledger.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.agent).toBe("dev-team-builder");
    expect(entries[0]?.costUsd).toBeCloseTo(0.0015, 5);
  });

  it("aggregates cost by agent and model", async () => {
    const reg = new PluginRegistry();
    reg.setContextProvider(() => ({
      scope: null,
      config: {},
      log: { debug() {}, info() {}, warn() {}, error() {} },
    }));
    await reg.register(plugin);

    const scope = { full: "_default/p/d/p/s", hash: "x", short: "x", descriptor: {} as any };
    for (const agent of ["a", "b", "a"]) {
      await reg.runAfter(
        "llm.call.after",
        {
          callId: agent,
          model: "anthropic/claude-haiku-4",
          messages: [],
          agentName: agent,
          scope,
        },
        {
          callId: agent,
          content: "",
          tokens: { input: 1000, output: 1000 },
          durationMs: 100,
          finishReason: "stop",
        },
      );
    }
    const byAgent = ledger.byAgent();
    expect(Object.keys(byAgent).sort()).toEqual(["a", "b"]);
    expect(byAgent.a).toBeCloseTo(byAgent.b! * 2, 5);
  });
});
