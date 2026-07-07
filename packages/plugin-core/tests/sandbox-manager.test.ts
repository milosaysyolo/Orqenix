// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { CrashHandler } from "../src/sandbox/crash-handler";
import { resolveResourceLimits } from "../src/sandbox/resource-limits";
import { serializeMessage, parseMessage, generateMessageId } from "../src/sandbox/ipc-protocol";
import { InMemoryPluginAuditWriter } from "../src/audit-kinds";

describe("Resource Limits", () => {
  it("applies defaults when no overrides", () => {
    const limits = resolveResourceLimits(undefined);
    expect(limits.cpuLimitPct).toBe(25);
    expect(limits.memoryLimitMb).toBe(512);
    expect(limits.wallTimeLimitSec).toBe(300);
    expect(limits.networkAllowed).toBe(false);
  });

  it("enforces operator ceiling (plugin cannot request more)", () => {
    const limits = resolveResourceLimits(
      { memoryLimitMb: 2048, cpuLimitPct: 90 },
      { memoryLimitMb: 512, cpuLimitPct: 25 },
    );
    expect(limits.memoryLimitMb).toBe(512);
    expect(limits.cpuLimitPct).toBe(25);
  });

  it("allows plugin to request less than ceiling", () => {
    const limits = resolveResourceLimits({ memoryLimitMb: 128 }, { memoryLimitMb: 512 });
    expect(limits.memoryLimitMb).toBe(128);
  });

  it("network only allowed if both plugin requests AND operator permits", () => {
    expect(
      resolveResourceLimits({ networkAllowed: true }, { networkAllowed: false }).networkAllowed,
    ).toBe(false);
    expect(
      resolveResourceLimits({ networkAllowed: true }, { networkAllowed: true }).networkAllowed,
    ).toBe(true);
  });

  it("FS paths intersected (plugin paths must be subset of operator)", () => {
    const limits = resolveResourceLimits(
      { fsReadPaths: ["/home/milo/projects", "/etc"] },
      { fsReadPaths: ["/home/milo"] },
    );
    expect(limits.fsReadPaths).toEqual(["/home/milo/projects"]);
  });
});

describe("IPC Protocol", () => {
  it("serializes and parses a message round-trip", () => {
    const msg = {
      v: "1.0" as const,
      kind: "invoke" as const,
      id: "abc",
      ts: Date.now(),
      payload: { toolName: "test", input: { x: 1 } },
    };
    const line = serializeMessage(msg);
    expect(line.endsWith("\n")).toBe(true);
    const parsed = parseMessage(line);
    expect(parsed?.kind).toBe("invoke");
    expect(parsed?.id).toBe("abc");
  });

  it("returns null for malformed JSON", () => {
    expect(parseMessage("not json")).toBeNull();
  });

  it("returns null for invalid message schema", () => {
    expect(parseMessage('{"foo": "bar"}')).toBeNull();
  });

  it("returns null for empty line", () => {
    expect(parseMessage("   ")).toBeNull();
  });

  it("generates unique message IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateMessageId()));
    expect(ids.size).toBe(100);
  });
});

describe("CrashHandler (INV-14)", () => {
  let audit: InMemoryPluginAuditWriter;
  let handler: CrashHandler;

  beforeEach(() => {
    audit = new InMemoryPluginAuditWriter();
    handler = new CrashHandler({
      auditWriter: audit,
      maxCrashesBeforeDisable: 3,
    });
  });

  it("records crashes and audits them", async () => {
    const result = await handler.handleCrash({
      pluginName: "@a/skill",
      pluginVersion: "1.0.0",
      exitCode: 1,
      signal: null,
      stderr: "boom",
      uptimeMs: 100,
      timestamp: new Date().toISOString(),
    });
    expect(result.crashCount).toBe(1);
    expect(result.shouldDisable).toBe(false);
    expect(audit.getEvents().some((e) => e.kind === "plugin.crashed")).toBe(true);
  });

  it("auto-disables after max crashes", async () => {
    let disabled = false;
    const h = new CrashHandler({
      maxCrashesBeforeDisable: 3,
      onAutoDisable: () => {
        disabled = true;
      },
    });

    for (let i = 0; i < 3; i++) {
      await h.handleCrash({
        pluginName: "@a/skill",
        pluginVersion: "1.0.0",
        exitCode: 1,
        signal: null,
        stderr: "boom",
        uptimeMs: 50,
        timestamp: new Date().toISOString(),
      });
    }

    expect(h.getCrashCount("@a/skill")).toBe(3);
    expect(disabled).toBe(true);
  });

  it("reset clears crash count", async () => {
    await handler.handleCrash({
      pluginName: "@a/skill",
      pluginVersion: "1.0.0",
      exitCode: 1,
      signal: null,
      stderr: "",
      uptimeMs: 50,
      timestamp: new Date().toISOString(),
    });
    handler.reset("@a/skill");
    expect(handler.getCrashCount("@a/skill")).toBe(0);
  });

  it("handleCrash never throws even if audit fails (INV-14)", async () => {
    const failingAudit = {
      append: async () => {
        throw new Error("audit broken");
      },
    };
    const h = new CrashHandler({ auditWriter: failingAudit });
    await expect(
      h.handleCrash({
        pluginName: "@a/skill",
        pluginVersion: "1.0.0",
        exitCode: 1,
        signal: null,
        stderr: "",
        uptimeMs: 50,
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeDefined();
  });
});
