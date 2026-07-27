// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryEngine } from "../src/engine";
import type { SubagentReturn } from "../src/subagent/types";

const PROJECT = "blake3:proj0001";
const MAIN = "blake3:branchmain";

describe("MemoryEngine (E2E keystone)", () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = await MemoryEngine.open(":memory:", {
      projectId: PROJECT,
      bootstrapBaseTables: true,
    });
  });

  afterEach(() => {
    engine.close();
  });

  it("opens + runs migrations", () => {
    const verify = engine.verifyAuditChain();
    expect(verify.valid).toBe(true);
    expect(verify.entriesVerified).toBe(0);
  });

  it("writes a memory entry + audits it", async () => {
    const entry = await engine.write({
      kb: "decision",
      content: "Use Stripe for billing",
      branch_id: MAIN,
      session_id: "01J3X8H9SESS",
      memory_level: "session",
    });
    expect(entry.id).toBeTruthy();

    const audit = engine.listAudit(0, 10);
    expect(audit.some((e) => e.kind === "memory.write")).toBe(true);
  });

  it("audit chain stays valid after writes", async () => {
    await engine.write({ kb: "decision", content: "A", branch_id: MAIN, memory_level: "branch" });
    await engine.write({ kb: "decision", content: "B", branch_id: MAIN, memory_level: "branch" });
    await engine.write({ kb: "lesson", content: "C", branch_id: MAIN, memory_level: "branch" });

    const verify = engine.verifyAuditChain();
    expect(verify.valid).toBe(true);
    expect(verify.entriesVerified).toBe(3);
  });

  it("queries across hierarchy", async () => {
    await engine.write({
      kb: "decision",
      content: "billing via Stripe",
      branch_id: MAIN,
      memory_level: "branch",
    });
    const result = await engine.query({ query: "billing", branchId: MAIN, limit: 10 });
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("creates a branch via deep-copy + audits", async () => {
    await engine.write({
      kb: "decision",
      content: "main decision",
      branch_id: MAIN,
      memory_level: "branch",
    });
    const result = await engine.createBranch({
      parentBranchId: MAIN,
      newBranchName: "feature/billing",
    });
    expect(result.indexRowsCloned).toBeGreaterThan(0);

    const audit = engine.listAudit(0, 20);
    expect(audit.some((e) => e.kind === "branch.deep_cloned_from_parent")).toBe(true);
    expect(engine.verifyAuditChain().valid).toBe(true);
  });

  it("invokes subagent + absorbs return to T1+T2 + audits", async () => {
    const ret: SubagentReturn = {
      output: { passed: 100, failed: 0 },
      outputMatchesSchema: true,
      wallTimeMs: 5000,
      stepsTaken: 2,
    };

    const absorbed = await engine.invokeSubagent({
      parentSessionId: "01J3X8H9PARENT",
      branchId: MAIN,
      harness: {
        systemPrompt: "test-runner",
        scopedContext: { entryIds: [], rationale: "tests" },
        goal: "run tests",
        constraints: {
          maxSteps: 5,
          maxWallTimeSec: 90,
          allowedTools: ["run_shell"],
          forbiddenTools: [],
        },
        returnSchema: { type: "object" },
        subagentKind: "test-runner",
      },
      runner: async () => ret,
    });

    expect(absorbed.t1EntryId).toBeTruthy();
    expect(absorbed.t2EntryId).toBeTruthy();

    const audit = engine.listAudit(0, 20);
    expect(audit.some((e) => e.kind === "subagent.spawn")).toBe(true);
    expect(audit.some((e) => e.kind === "subagent.return_absorbed")).toBe(true);
  });

  it("subagent return surfaces with x10 boost in subsequent query", async () => {
    await engine.write({
      kb: "chat",
      content: "discussion about billing",
      branch_id: MAIN,
      session_id: "01J3X8H9PARENT",
      memory_level: "session",
    });

    await engine.invokeSubagent({
      parentSessionId: "01J3X8H9PARENT",
      branchId: MAIN,
      harness: {
        systemPrompt: "analyzer",
        scopedContext: { entryIds: [], rationale: "x" },
        goal: "analyze billing",
        constraints: { maxSteps: 5, maxWallTimeSec: 90, allowedTools: [], forbiddenTools: [] },
        returnSchema: { type: "object" },
        subagentKind: "analyzer",
      },
      runner: async () => ({
        output: "billing analysis complete",
        outputMatchesSchema: true,
        wallTimeMs: 1000,
        stepsTaken: 1,
      }),
    });

    const result = await engine.query({
      query: "billing",
      kbs: ["chat"],
      sessionId: "01J3X8H9PARENT",
      branchId: MAIN,
      limit: 10,
    });

    expect(result.results[0]?.entry.protection_flags?.kind).toBe("subagent_return");
  });

  it("promotes entry session->branch + audits", async () => {
    const entry = await engine.write({
      kb: "decision",
      content: "session decision to promote",
      branch_id: MAIN,
      session_id: "01J3X8H9SESS",
      memory_level: "session",
    });

    await engine.promote({
      entryId: entry.id,
      kb: "decision",
      from: "session",
      to: "branch",
      fromSessionId: "01J3X8H9SESS",
      fromBranchId: MAIN,
      reason: "critical decision",
    });

    const audit = engine.listAudit(0, 20);
    expect(audit.some((e) => e.kind === "memory.promoted.session_to_branch")).toBe(true);
  });

  it("fetchContent resolves entry (wires federation stub)", async () => {
    const entry = await engine.write({
      kb: "decision",
      content: "fetchable content",
      branch_id: MAIN,
      memory_level: "branch",
    });
    const content = engine.fetchContent("decision", entry.id);
    expect(content).toBe("fetchable content");
  });
});
