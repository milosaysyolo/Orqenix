import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifest, findPlugin, listByCategory, resolveSource } from "../src/index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mp-loader-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const VALID = {
  name: "m",
  owner: { name: "o" },
  plugins: [
    { name: "in-tree-one", description: "d", source: "./a", category: "x" },
    { name: "in-tree-two", description: "d", source: "./b", category: "y" },
    {
      name: "external-one",
      description: "d",
      source: { source: "url", url: "https://x", sha: "0123456789abcdef0123456789abcdef01234567" },
    },
  ],
};

describe("loader", () => {
  it("loads valid manifest from disk", async () => {
    await writeFile(join(dir, "m.json"), JSON.stringify(VALID));
    const m = await loadManifest(join(dir, "m.json"));
    expect(m.plugins).toHaveLength(3);
  });

  it("throws on invalid manifest", async () => {
    await writeFile(join(dir, "m.json"), JSON.stringify({ name: "x" }));
    await expect(loadManifest(join(dir, "m.json"))).rejects.toThrow(/Invalid manifest/);
  });

  it("findPlugin returns entry by name", () => {
    expect(findPlugin(VALID as any, "in-tree-one")?.name).toBe("in-tree-one");
    expect(findPlugin(VALID as any, "missing")).toBeUndefined();
  });

  it("listByCategory filters by category", () => {
    expect(listByCategory(VALID as any, "x").map((p) => p.name)).toEqual(["in-tree-one"]);
  });

  it("resolveSource handles in-tree", () => {
    expect(resolveSource(VALID.plugins[0] as any).kind).toBe("in-tree");
  });

  it("resolveSource handles url", () => {
    const r = resolveSource(VALID.plugins[2] as any);
    expect(r.kind).toBe("url");
    expect(r.identifier).toContain("@0123456789");
  });
});
