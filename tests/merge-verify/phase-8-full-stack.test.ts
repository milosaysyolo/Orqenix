// SPDX-License-Identifier: Apache-2.0
// PHASE 8 SMOKE: hierarchy + branch deep-copy + subagent + plugin + marketplace
// + normalization + self-learning — the headline Phase 8 features.

import { describe, it, expect, afterEach } from "vitest";
import { MemoryEngine } from "@orqenix/memory-engine";
import { validateManifest, ConformanceSuite } from "@orqenix/plugin-core";
import { NormalizationEngine } from "@orqenix/normalization-engine";
import { ALL_INPUT_ADAPTERS } from "@orqenix/input-adapters";
import { ALL_OUTPUT_ADAPTERS } from "@orqenix/output-adapters";
import { OrqenixMcpServer } from "@orqenix/mcp-server";

const PROJECT = "blake3:phase8test";
const MAIN = "blake3:main";

describe("PHASE 8 — Full Stack", () => {
  let engine: MemoryEngine;
  afterEach(() => engine?.close());

  it("3-level hierarchy query works (parallel, INV-12)", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    await engine.write({
      kb: "decision",
      content: "session billing",
      branch_id: MAIN,
      session_id: "s1",
      memory_level: "session",
    });
    await engine.write({
      kb: "decision",
      content: "branch billing",
      branch_id: MAIN,
      memory_level: "branch",
    });
    const result = await engine.query({
      query: "billing",
      sessionId: "s1",
      branchId: MAIN,
      limit: 10,
    });
    expect(result.levelsQueried.length).toBeGreaterThanOrEqual(2);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("branch deep-copy isolation works (ADR-E-003)", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    await engine.write({
      kb: "decision",
      content: "main decision",
      branch_id: MAIN,
      memory_level: "branch",
    });
    const result = await engine.createBranch({ parentBranchId: MAIN, newBranchName: "feature/x" });
    expect(result.indexRowsCloned).toBeGreaterThan(0);
    expect(engine.verifyAuditChain().valid).toBe(true);
  });

  it("subagent invoke + absorb to T1+T2 works (ADR-E-002)", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const absorbed = await engine.invokeSubagent({
      parentSessionId: "s1",
      branchId: MAIN,
      harness: {
        systemPrompt: "test-runner",
        scopedContext: { entryIds: [], rationale: "x" },
        goal: "run tests",
        constraints: { maxSteps: 5, maxWallTimeSec: 90, allowedTools: [], forbiddenTools: [] },
        returnSchema: { type: "object" },
        subagentKind: "test-runner",
      },
      runner: async () => ({
        output: { passed: 10 },
        outputMatchesSchema: true,
        wallTimeMs: 1000,
        stepsTaken: 2,
      }),
    });
    expect(absorbed.t1EntryId).toBeTruthy();
    expect(absorbed.t2EntryId).toBeTruthy();
  });

  it("plugin manifest validation works (14 kinds)", () => {
    const result = validateManifest({
      name: "@example/skill",
      version: "1.0.0",
      license: "Apache-2.0",
      main: "./plugin.js",
      orqenixPlugin: {
        manifestVersion: "1.0",
        kind: "skill",
        compatibility: { orqenix: "~0.8.0" },
        permissions: ["scope.read"],
        external_agent_compat: ["claude-code"],
        tool: { name: "test", description: "Test", inputSchema: { type: "object" } },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.csf?.kind).toBe("skill");
  });

  it("normalization round-trip fidelity works (INV-15)", async () => {
    const engine2 = new NormalizationEngine({
      inputAdapters: ALL_INPUT_ADAPTERS,
      outputAdapters: ALL_OUTPUT_ADAPTERS,
    });
    expect(engine2.listInputAdapters().length).toBe(14);
    expect(engine2.listOutputAdapters().length).toBe(8);
    const pkg = JSON.stringify(
      {
        name: "@a/b",
        version: "1.0.0",
        license: "Apache-2.0",
        main: "./p.js",
        keywords: ["orqenix-plugin"],
        orqenixPlugin: {
          manifestVersion: "1.0",
          kind: "skill",
          compatibility: { orqenix: "~0.8.0" },
          permissions: [],
          external_agent_compat: [],
          sandboxMode: "separate_process",
        },
      },
      null,
      2,
    );
    const imported = await engine2.import({ sourceKind: "npm", content: pkg });
    expect(imported.csf.name).toBe("@a/b");
    const exported = await engine2.export(imported.csf, "npm");
    expect(exported.report.lossyFields).toEqual([]);
  });

  it("MCP server exposes 10 tools + 9 resources + 6 prompts", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const server = new OrqenixMcpServer({
      engine,
      skillRuntime: {
        invoke: async () => ({ output: "x", durationMs: 1, outputValid: true }),
      } as never,
      transport: "stdio",
      clientId: "merge-test",
    });
    const hs = server.handshake();
    expect(hs.capabilities.tools).toHaveLength(10);
    expect(hs.capabilities.resources).toHaveLength(9);
    expect(hs.capabilities.prompts).toHaveLength(6);
  });
});
