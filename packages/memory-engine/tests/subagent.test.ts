// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { SqliteStore } from "../src/store/sqlite-store";
import { SubagentHarnessManager, SubagentHarnessError } from "../src/subagent/harness";
import { ReturnAbsorber } from "../src/subagent/return-absorber";
import {
  shouldCompress,
  shouldMoveTier,
  makeSubagentReturnFlags,
  validateProtectionFlags,
} from "../src/hierarchy/compress-guard";
import { MigrationRunner, HIERARCHY_MIGRATIONS, BASE_KB_BOOTSTRAP } from "../src/migrations/index";
import type { SubagentHarness, SubagentReturn } from "../src/subagent/types";
import type { MemoryEntry } from "../src/store/types";
import { BlobStore } from "../src/store/blob-store";

const PROJECT = "blake3:proj0001";
const BRANCH = "blake3:branchmain";
const PARENT_SESSION = "01J3X8H9PARENT";

function makeHarness(overrides: Partial<SubagentHarness> = {}): SubagentHarness {
  return {
    systemPrompt: "You are a test-runner subagent.",
    scopedContext: { entryIds: ["e1"], rationale: "test files" },
    goal: "Run tests and report failures",
    constraints: {
      maxSteps: 5,
      maxWallTimeSec: 90,
      allowedTools: ["run_shell", "read_file"],
      forbiddenTools: ["write_file", "git_commit"],
    },
    returnSchema: { type: "object" },
    subagentKind: "test-runner",
    ...overrides,
  };
}

function makeReturn(overrides: Partial<SubagentReturn> = {}): SubagentReturn {
  return {
    output: { passed: 142, failed: 3 },
    outputMatchesSchema: true,
    wallTimeMs: 47000,
    stepsTaken: 3,
    ...overrides,
  };
}

describe("SubagentHarnessManager (ADR-E-002 + Anti-pattern 36)", () => {
  let manager: SubagentHarnessManager;

  beforeEach(() => {
    manager = new SubagentHarnessManager();
  });

  it("invokes a subagent and returns the result", async () => {
    const invocation = await manager.invoke({
      parentSessionId: PARENT_SESSION,
      branchId: BRANCH,
      projectId: PROJECT,
      harness: makeHarness(),
      runner: async () => makeReturn(),
    });
    expect(invocation.subagentKind).toBe("test-runner");
    expect(invocation.ret.output).toEqual({ passed: 142, failed: 3 });
    expect(invocation.subagentSessionId).toMatch(/^[0-9A-Z]{26}$/);
  });

  it("rejects harness without systemPrompt", async () => {
    await expect(
      manager.invoke({
        parentSessionId: PARENT_SESSION,
        branchId: BRANCH,
        projectId: PROJECT,
        harness: makeHarness({ systemPrompt: "" }),
        runner: async () => makeReturn(),
      }),
    ).rejects.toBeInstanceOf(SubagentHarnessError);
  });

  it("rejects harness without goal", async () => {
    await expect(
      manager.invoke({
        parentSessionId: PARENT_SESSION,
        branchId: BRANCH,
        projectId: PROJECT,
        harness: makeHarness({ goal: "" }),
        runner: async () => makeReturn(),
      }),
    ).rejects.toBeInstanceOf(SubagentHarnessError);
  });

  it("blocks sub-subagent spawning (Anti-pattern 36)", async () => {
    await expect(
      manager.invoke({
        parentSessionId: PARENT_SESSION,
        branchId: BRANCH,
        projectId: PROJECT,
        harness: makeHarness({
          constraints: {
            maxSteps: 5,
            maxWallTimeSec: 90,
            allowedTools: ["invoke_subagent"],
            forbiddenTools: [],
          },
        }),
        runner: async () => makeReturn(),
      }),
    ).rejects.toThrow(/single-level depth/);
  });

  it("enforces maxSteps limit", async () => {
    await expect(
      manager.invoke({
        parentSessionId: PARENT_SESSION,
        branchId: BRANCH,
        projectId: PROJECT,
        harness: makeHarness({
          constraints: { maxSteps: 2, maxWallTimeSec: 90, allowedTools: [], forbiddenTools: [] },
        }),
        runner: async () => makeReturn({ stepsTaken: 10 }),
      }),
    ).rejects.toThrow(/maxSteps/);
  });

  it("enforces wall-time timeout", async () => {
    await expect(
      manager.invoke({
        parentSessionId: PARENT_SESSION,
        branchId: BRANCH,
        projectId: PROJECT,
        harness: makeHarness({
          constraints: { maxSteps: 5, maxWallTimeSec: 0.05, allowedTools: [], forbiddenTools: [] },
        }),
        runner: () => new Promise((resolve) => setTimeout(() => resolve(makeReturn()), 1000)),
      }),
    ).rejects.toThrow(/wall-time/);
  });
});

describe("ReturnAbsorber (T1+T2, INV-13)", () => {
  let db: DB;
  let store: SqliteStore;
  let absorber: ReturnAbsorber;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply(HIERARCHY_MIGRATIONS);
    store = Object.assign(Object.create(SqliteStore.prototype), {
      db,
      blobs: new BlobStore(db),
    });
    absorber = new ReturnAbsorber(store as SqliteStore);
  });

  afterEach(() => {
    db.close();
  });

  it("absorbs return into T1 and T2", () => {
    const result = absorber.absorb({
      ret: makeReturn(),
      subagentSessionId: "subX",
      subagentKind: "test-runner",
      parentSessionId: PARENT_SESSION,
      branchId: BRANCH,
      projectId: PROJECT,
    });
    expect(result.t1EntryId).toBeTruthy();
    expect(result.t2EntryId).toBeTruthy();
    expect(result.t1EntryId).not.toBe(result.t2EntryId);

    const t1 = store.getEntry("chat", result.t1EntryId);
    const t2 = store.getEntry("chat", result.t2EntryId);
    expect(t1?.tier).toBe("T1");
    expect(t2?.tier).toBe("T2");
    expect(t1?.protection_flags?.kind).toBe("subagent_return");
    expect(t2?.protection_flags?.kind).toBe("subagent_return");
  });
});

describe("Compress guards (INV-13)", () => {
  function makeEntry(flags: MemoryEntry["protection_flags"]): MemoryEntry {
    return {
      id: "e1",
      hash: "h1",
      kb: "chat",
      tier: "T1",
      content: "x",
      embedding: null,
      project_id: PROJECT,
      branch_id: BRANCH,
      session_id: PARENT_SESSION,
      memory_level: "session",
      protection_flags: flags,
      cloned_from_branch_id: null,
      promoted_from_session_id: null,
      promoted_from_branch_id: null,
      created_at: new Date(Date.now() - 120000).toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  it("never compresses subagent_return entries", () => {
    const flags = makeSubagentReturnFlags({
      subagentSessionId: "subX",
      subagentKind: "test",
      parentSessionId: PARENT_SESSION,
    });
    expect(shouldCompress(makeEntry(flags))).toBe(false);
  });

  it("never moves tier for subagent_return entries", () => {
    const flags = makeSubagentReturnFlags({
      subagentSessionId: "subX",
      subagentKind: "test",
      parentSessionId: PARENT_SESSION,
    });
    expect(shouldMoveTier(makeEntry(flags))).toBe(false);
  });

  it("allows compression for normal entries past cooldown", () => {
    expect(shouldCompress(makeEntry(null))).toBe(true);
  });

  it("blocks compression during cooldown", () => {
    const entry = makeEntry(null);
    entry.created_at = new Date().toISOString();
    expect(shouldCompress(entry, 60)).toBe(false);
  });

  it("makeSubagentReturnFlags sets all protection flags", () => {
    const flags = makeSubagentReturnFlags({
      subagentSessionId: "subX",
      subagentKind: "test",
      parentSessionId: PARENT_SESSION,
    });
    expect(flags.never_compress).toBe(true);
    expect(flags.never_move_tier).toBe(true);
    expect(flags.immutable).toBe(true);
    expect(flags.duplicate_in_tiers).toEqual(["T1", "T2"]);
  });

  it("validateProtectionFlags rejects incomplete subagent_return", () => {
    const result = validateProtectionFlags({
      kind: "subagent_return",
      immutable: true,
      never_compress: false,
      never_move_tier: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("never_compress"))).toBe(true);
  });
});
