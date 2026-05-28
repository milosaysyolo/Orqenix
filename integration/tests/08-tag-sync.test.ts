import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ORQENIX_ROOT, PRO_ROOT } from "../helpers/workspace.js";

const EXPECTED_TAG = "v0.4.0-phase-4";

async function gitTagExists(repo: string, tag: string): Promise<boolean> {
  const r = await execa("git", ["tag", "--list", tag], { cwd: repo, reject: false });
  return r.stdout.trim() === tag;
}

describe("E2E 08 cross-repo tag sync", () => {
  it("Orqenix has v0.4.0-phase-4 tag", async () => {
    expect(await gitTagExists(ORQENIX_ROOT, EXPECTED_TAG)).toBe(true);
  });

  it("Orqenix-Pro has v0.4.0-phase-4 tag", async () => {
    expect(await gitTagExists(PRO_ROOT, EXPECTED_TAG)).toBe(true);
  });

  it("both repos have Phase-4 tag present", async () => {
    const o = await gitTagExists(ORQENIX_ROOT, EXPECTED_TAG);
    const p = await gitTagExists(PRO_ROOT, EXPECTED_TAG);
    expect(o && p).toBe(true);
  });

  it("both repos resolve as sibling directories", async () => {
    const orqenix = await execa("git", ["rev-parse", "--show-toplevel"], { cwd: ORQENIX_ROOT });
    const pro = await execa("git", ["rev-parse", "--show-toplevel"], { cwd: PRO_ROOT });
    const orqenixParent = orqenix.stdout.split(/[\\/]/).slice(0, -1).join("/");
    const proParent = pro.stdout.split(/[\\/]/).slice(0, -1).join("/");
    expect(orqenixParent).toBe(proParent);
  });
});
