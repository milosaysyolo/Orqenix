// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, dispatch, type CliContext } from "../src";

const SCOPE_ID = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function testContext(baseDir: string, overrides?: Partial<CliContext>): CliContext {
  return {
    rootDir: baseDir,
    dbPath: join(baseDir, "kb.sqlite"),
    scopeId: SCOPE_ID,
    io: { stdout: () => {}, stderr: () => {} },
    ...overrides,
  };
}

describe("CLI integration", () => {
  let dir: string;
  let ctx: CliContext;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-int-"));
    ctx = testContext(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("version returns JSON with version field", async () => {
    const r = await dispatch(ctx, parseArgs(["version"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toBeDefined();
    const parsed = JSON.parse(r.output!);
    expect(parsed).toHaveProperty("version");
    expect(typeof parsed.version).toBe("string");
  });

  it("scope info returns error when scopeId is empty", async () => {
    const noScopeCtx = testContext(dir, { scopeId: "" });
    const r = await dispatch(noScopeCtx, parseArgs(["scope", "info"]));
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain("error");
    expect(r.output!.toLowerCase()).toContain("no scope id");
  });

  it("workspace create --name test creates a workspace", async () => {
    const r = await dispatch(ctx, parseArgs(["workspace", "create", "--name", "test"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toBeDefined();
    const parsed = JSON.parse(r.output!);
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("name", "test");
    expect(parsed).toHaveProperty("ownerScopeId", SCOPE_ID);
  });

  it("workspace list returns list of workspaces after creation", async () => {
    // Create a workspace first
    const createR = await dispatch(ctx, parseArgs(["workspace", "create", "--name", "test"]));
    expect(createR.exitCode).toBe(0);

    // List workspaces
    const listR = await dispatch(ctx, parseArgs(["workspace", "list"]));
    expect(listR.exitCode).toBe(0);
    expect(listR.output).toBeDefined();
    const parsed = JSON.parse(listR.output!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed.some((ws: any) => ws.name === "test")).toBe(true);
  });
});
