import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "../src/plugin/registry.js";
import type { OrqenixPlugin } from "../src/plugin/types.js";

function makePlugin(name: string, priority = 0): OrqenixPlugin {
  return {
    name,
    version: "1.0.0",
    priority,
    hooks: {},
  };
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    registry.setContextProvider(() => ({
      scope: null,
      config: {},
      log: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    }));
  });

  it("registers and lists plugins by priority desc", async () => {
    await registry.register(makePlugin("a", 1));
    await registry.register(makePlugin("b", 10));
    await registry.register(makePlugin("c", 5));
    const list = registry.list();
    expect(list.map((p) => p.name)).toEqual(["b", "c", "a"]);
  });

  it("refuses duplicate registration", async () => {
    await registry.register(makePlugin("dup"));
    await expect(registry.register(makePlugin("dup"))).rejects.toThrow(/already registered/);
  });

  it("calls onRegister and rolls back on failure", async () => {
    let called = false;
    await expect(
      registry.register({
        name: "boom",
        version: "1.0.0",
        hooks: {},
        onRegister: async () => {
          called = true;
          throw new Error("nope");
        },
      }),
    ).rejects.toThrow(/nope/);
    expect(called).toBe(true);
    expect(registry.has("boom")).toBe(false);
  });

  it("runBefore aborts on throw", async () => {
    const calls: string[] = [];
    await registry.register({
      name: "a",
      version: "1.0.0",
      priority: 10,
      hooks: {
        "agent.task.before": async () => {
          calls.push("a");
          throw new Error("stop");
        },
      },
    });
    await registry.register({
      name: "b",
      version: "1.0.0",
      priority: 1,
      hooks: {
        "agent.task.before": async () => {
          calls.push("b");
        },
      },
    });
    await expect(
      registry.runBefore("agent.task.before", {
        id: "t",
        agentName: "x",
        intent: "test",
        scope: { full: "_default/p/d/p/s", hash: "x", short: "x", descriptor: {} as any },
        startTime: Date.now(),
        context: {},
      }),
    ).rejects.toThrow(/stop/);
    expect(calls).toEqual(["a"]);
  });

  it("runAfter does not abort on failure", async () => {
    const calls: string[] = [];
    await registry.register({
      name: "a",
      version: "1.0.0",
      priority: 10,
      hooks: {
        "agent.task.after": async () => {
          calls.push("a");
          throw new Error("ignored");
        },
      },
    });
    await registry.register({
      name: "b",
      version: "1.0.0",
      priority: 1,
      hooks: {
        "agent.task.after": async () => {
          calls.push("b");
        },
      },
    });
    await registry.runAfter(
      "agent.task.after",
      {
        id: "t",
        agentName: "x",
        intent: "test",
        scope: { full: "_default/p/d/p/s", hash: "x", short: "x", descriptor: {} as any },
        startTime: 0,
        context: {},
      },
      { taskId: "t", success: true, durationMs: 10 },
    );
    expect(calls).toEqual(["a", "b"]);
  });

  it("transform hooks chain output to next plugin", async () => {
    await registry.register({
      name: "doubler",
      version: "1.0.0",
      priority: 10,
      hooks: {
        "tool.execute.after": async (out) => ({ ...out, durationMs: out.durationMs * 2 }),
      },
    });
    await registry.register({
      name: "adder",
      version: "1.0.0",
      priority: 1,
      hooks: {
        "tool.execute.after": async (out) => ({ ...out, durationMs: out.durationMs + 1 }),
      },
    });
    const result = await registry.runTransformTool("tool.execute.after", {
      callId: "c1",
      result: null,
      durationMs: 10,
    });
    expect(result.durationMs).toBe(21);
  });

  it("unregisters cleanly", async () => {
    await registry.register(makePlugin("x"));
    expect(registry.has("x")).toBe(true);
    await registry.unregister("x");
    expect(registry.has("x")).toBe(false);
  });
});
