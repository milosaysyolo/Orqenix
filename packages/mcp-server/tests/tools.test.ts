// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryEngine } from "@orqenix/memory-engine";
import { ALL_TOOLS, getToolByName, type ToolContext } from "../src/tools";

const PROJECT = "blake3:proj0001";
const BRANCH = "blake3:branchmain";
const SESSION = "01J3X8H9SESSION0000000000";

describe("MCP Tools", () => {
  let engine: MemoryEngine;
  let ctx: ToolContext;

  beforeEach(async () => {
    engine = await MemoryEngine.open(":memory:", {
      projectId: PROJECT,
      bootstrapBaseTables: true,
    });
    ctx = {
      engine,
      skillRuntime: {
        invoke: async () => ({ output: "stub", durationMs: 1 }),
      } as never,
      sessionId: SESSION,
      branchId: BRANCH,
      clientId: "test-client",
    };
  });

  afterEach(() => {
    engine.close();
  });

  it("declares exactly 10 tools", () => {
    expect(ALL_TOOLS).toHaveLength(10);
  });

  it("all tools have unique names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(10);
  });

  it("all tool names use orqenix_ prefix", () => {
    for (const t of ALL_TOOLS) {
      expect(t.name).toMatch(/^orqenix_/);
    }
  });

  it("record_decision writes to decision KB", async () => {
    const tool = getToolByName("orqenix_record_decision")!;
    const result = (await tool.handler(
      { title: "Use Stripe", rationale: "Best DX", status: "accepted" },
      ctx,
    )) as { entryId: string };
    expect(result.entryId).toBeTruthy();
  });

  it("recall_memory returns decisions just written", async () => {
    const record = getToolByName("orqenix_record_decision")!;
    await record.handler({ title: "billing decision", rationale: "use Stripe for billing" }, ctx);

    const recall = getToolByName("orqenix_recall_memory")!;
    const result = (await recall.handler(
      { query: "billing", kbs: ["decision"], limit: 10 },
      ctx,
    )) as { results: Array<{ content: string }> };
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("verify_audit_chain returns valid for fresh project", async () => {
    const tool = getToolByName("orqenix_verify_audit_chain")!;
    const result = (await tool.handler({}, ctx)) as { valid: boolean };
    expect(result.valid).toBe(true);
  });

  it("record_lesson writes to lesson KB", async () => {
    const tool = getToolByName("orqenix_record_lesson")!;
    const result = (await tool.handler(
      { title: "Avoid N+1", context: "ORM queries", lesson: "Use eager loading" },
      ctx,
    )) as { entryId: string };
    expect(result.entryId).toBeTruthy();
  });

  it("invoke_skill delegates to skill runtime", async () => {
    const tool = getToolByName("orqenix_invoke_skill")!;
    const result = (await tool.handler({ skillName: "@example/skill", input: { x: 1 } }, ctx)) as {
      output: string;
    };
    expect(result.output).toBe("stub");
  });

  it("rejects unknown tool", () => {
    expect(getToolByName("orqenix_nonexistent")).toBeUndefined();
  });

  it("report_session_start returns a session id", async () => {
    const tool = getToolByName("orqenix_report_session_start")!;
    const result = (await tool.handler({ agentPlatform: "claude-code" }, ctx)) as {
      sessionId: string;
      agentPlatform: string;
    };
    expect(result.sessionId).toBeTruthy();
    expect(result.agentPlatform).toBe("claude-code");
  });
});
