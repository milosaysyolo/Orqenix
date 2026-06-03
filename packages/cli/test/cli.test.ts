// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, dispatch, flagString, flagBool, usage } from "../src";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function makeIo() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) },
  };
}

describe("parseArgs", () => {
  it("parses command tokens then flags", () => {
    const a = parseArgs(["link", "create", "--remote", B, "--direction", "outbound"]);
    expect(a.command).toEqual(["link", "create"]);
    expect(a.flags.remote).toBe(B);
    expect(a.flags.direction).toBe("outbound");
  });

  it("parses --flag=value", () => {
    const a = parseArgs(["scope", "info", "--scope=" + SCOPE]);
    expect(a.flags.scope).toBe(SCOPE);
  });

  it("treats lone --flag as true", () => {
    const a = parseArgs(["detach", "exec", "--dry-run"]);
    expect(a.flags["dry-run"]).toBe(true);
  });

  it("captures positionals after flags", () => {
    const a = parseArgs(["cmd", "--x", "1", "pos1", "pos2"]);
    expect(a.positionals).toEqual(["pos1", "pos2"]);
  });

  it("flagBool reads boolean and string forms", () => {
    const a1 = parseArgs(["x", "--flag"]);
    expect(flagBool(a1, "flag")).toBe(true);
    const a2 = parseArgs(["x", "--flag=true"]);
    expect(flagBool(a2, "flag")).toBe(true);
    const a3 = parseArgs(["x"]);
    expect(flagBool(a3, "flag", false)).toBe(false);
  });

  it("flagString returns default when missing", () => {
    const a = parseArgs(["x"]);
    expect(flagString(a, "name", "default")).toBe("default");
  });
});

describe("dispatch", () => {
  let dir: string;
  let ctx: ReturnType<typeof makeCtx>;
  function makeCtx() {
    const m = makeIo();
    return {
      ctx: { rootDir: dir, dbPath: join(dir, "kb.sqlite"), scopeId: SCOPE, io: m.io },
      out: m.out,
      err: m.err,
    };
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-cli-"));
    ctx = makeCtx();
  });
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("version returns Phase 5 version", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["version"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain("0.5.0-phase-5");
  });

  it("scope info returns context", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["scope", "info"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain(SCOPE);
  });

  it("link create then link list round-trip", async () => {
    const c = await dispatch(ctx.ctx, parseArgs(["link", "create", "--remote", B]));
    expect(c.exitCode).toBe(0);
    const l = await dispatch(ctx.ctx, parseArgs(["link", "list"]));
    expect(l.exitCode).toBe(0);
    expect(l.output).toContain(B);
  });

  it("workspace create then workspace list", async () => {
    const c = await dispatch(ctx.ctx, parseArgs(["workspace", "create", "--name", "demo"]));
    expect(c.exitCode).toBe(0);
    const l = await dispatch(ctx.ctx, parseArgs(["workspace", "list"]));
    expect(l.exitCode).toBe(0);
    expect(l.output).toContain("demo");
  });

  it("audit verify on empty log returns ok", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["audit", "verify"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('"ok": true');
  });

  it("detach plan unlink reports required flag missing", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["detach", "plan", "--kind", "unlink-remote"]));
    expect(r.exitCode).toBe(1);
    expect(r.output?.toLowerCase()).toContain("error");
  });

  it("migrate status reports current phase", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["migrate", "status"]));
    expect(r.exitCode).toBe(0);
  });

  it("unknown command returns exit 1 with usage", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["banana", "split"]));
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain("unknown command");
  });

  it("help flag shows usage", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["--help"]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain("Commands:");
  });

  it("rejects --name missing on scope init", async () => {
    const r = await dispatch(ctx.ctx, parseArgs(["scope", "init"]));
    expect(r.exitCode).toBe(1);
  });

  it("usage() includes all command groups", () => {
    const u = usage();
    expect(u).toContain("scope");
    expect(u).toContain("link");
    expect(u).toContain("workspace");
    expect(u).toContain("audit");
    expect(u).toContain("detach");
    expect(u).toContain("migrate");
  });
});
