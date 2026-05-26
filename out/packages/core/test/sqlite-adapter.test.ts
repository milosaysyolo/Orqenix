import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteAdapter } from "../src/storage/sqlite-adapter.js";

describe("SqliteAdapter", () => {
  let dir: string;
  let dbPath: string;
  let adapter: SqliteAdapter;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "orqenix-sqlite-"));
    dbPath = join(dir, "test.db");
    adapter = new SqliteAdapter(dbPath);
    await adapter.open();
  });

  afterEach(async () => {
    await adapter.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("KV: set / get / delete", async () => {
    await adapter.set("k1", { hello: "world" });
    expect(await adapter.get("k1")).toEqual({ hello: "world" });
    await adapter.delete("k1");
    expect(await adapter.get("k1")).toBeNull();
  });

  it("KV: TTL expires", async () => {
    await adapter.set("k2", "tmp", 1);
    expect(await adapter.get("k2")).toBe("tmp");
    await new Promise((r) => setTimeout(r, 1100));
    expect(await adapter.get("k2")).toBeNull();
  });

  it("Document: insert and query", async () => {
    const id = await adapter.insert("notes", { id: "n1", title: "hello" });
    expect(id).toBe("n1");
    const got = await adapter.query("notes", { id: "n1" });
    expect(got).toHaveLength(1);
    expect(got[0]?.title).toBe("hello");
  });

  it("persists across reopen", async () => {
    await adapter.set("persistent", { n: 42 });
    await adapter.close();
    adapter = new SqliteAdapter(dbPath);
    await adapter.open();
    expect(await adapter.get("persistent")).toEqual({ n: 42 });
  });

  it("close is idempotent", async () => {
    await adapter.close();
    await expect(adapter.close()).resolves.toBeUndefined();
    adapter = new SqliteAdapter(dbPath);
    await adapter.open();
    await adapter.set("after-close", { ok: true });
    expect(await adapter.get("after-close")).toEqual({ ok: true });
  });

  it("vector methods throw with Phase 4 hint", async () => {
    await expect(adapter.upsertVector("c", "id", [0.1, 0.2], {})).rejects.toThrow(/Phase 4/);
    await expect(adapter.searchVectors("c", [0.1], 5)).rejects.toThrow(/Phase 4/);
  });
});
