import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createWorkspace, type WorkspaceContext } from "../helpers/workspace.js";

let ws: WorkspaceContext;

beforeAll(async () => { ws = await createWorkspace(); });
afterAll(async () => { await ws.cleanup(); });

describe("E2E 01 init and doctor", () => {
  it("orqenix init exits 0", async () => {
    const r = await ws.cli(["init", "--yes"]);
    expect(r.exitCode).toBe(0);
  });

  it("orqenix doctor reports healthy state", async () => {
    const r = await ws.cli(["doctor"]);
    expect(r.exitCode).toBe(0);
    expect(r.all).toMatch(/plugin|memory|config/i);
  });

  it("init creates AGENTS.md", async () => {
    await ws.cli(["init", "--yes"]);
    expect(await ws.exists("AGENTS.md")).toBe(true);
  });

  it("AGENTS.md has Orqenix section", async () => {
    const md = await ws.readFile("AGENTS.md");
    expect(md.toLowerCase()).toContain("orqenix");
  });
});
