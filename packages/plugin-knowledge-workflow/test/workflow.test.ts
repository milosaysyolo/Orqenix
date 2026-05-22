import { describe, it, expect } from "vitest";
import { PluginRegistry } from "@orqenix/core/plugin";
import { createKnowledgeWorkflowPlugin, noopDeps } from "../src/index.js";

describe("knowledge-workflow plugin", () => {
  it("injects briefing into task systemPrelude", async () => {
    const reg = new PluginRegistry();
    reg.setContextProvider(() => ({
      scope: null,
      config: {},
      log: { debug() {}, info() {}, warn() {}, error() {} },
    }));

    const deps = noopDeps();
    deps.agents.getManifest = () => ({ knowledge_briefing: true });
    deps.knowledge.queryBriefing = async () => "PROJECT CONVENTIONS: use TS";
    await reg.register(createKnowledgeWorkflowPlugin(deps));

    const task = {
      id: "t",
      agentName: "x",
      intent: "do thing",
      scope: { full: "_default/p/d/p/s", hash: "x", short: "x", descriptor: {} as any },
      startTime: 0,
      context: {},
    };
    await reg.runBefore("agent.task.before", task);
    expect(task.context.systemPrelude).toContain("PROJECT CONVENTIONS");
  });

  it("respects reindex_after=none", async () => {
    const reg = new PluginRegistry();
    reg.setContextProvider(() => ({
      scope: null,
      config: {},
      log: { debug() {}, info() {}, warn() {}, error() {} },
    }));
    const deps = noopDeps();
    deps.agents.getManifest = () => ({ reindex_after: "none" });
    let reindexCalled = false;
    deps.knowledge.reindex = async () => {
      reindexCalled = true;
    };
    await reg.register(createKnowledgeWorkflowPlugin(deps));

    await reg.runAfter(
      "agent.task.after",
      {
        id: "t",
        agentName: "x",
        intent: "",
        scope: { full: "x", hash: "x", short: "x", descriptor: {} as any },
        startTime: 0,
        context: {},
      },
      { taskId: "t", success: true, durationMs: 1 },
    );
    expect(reindexCalled).toBe(false);
  });
});
