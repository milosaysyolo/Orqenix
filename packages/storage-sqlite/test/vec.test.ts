import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, createVecTable, insertVec, searchVec } from "../src";

describe("sqlite-vec", () => {
  let dir: string;
  let conn: SqliteConnection;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-vec-"));
    conn = new SqliteConnection({ path: join(dir, "db.sqlite"), enableVec: true });
  });
  afterEach(async () => {
    conn.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("creates vec table and round-trips nearest neighbor", () => {
    createVecTable(conn, "embeddings", 4);
    insertVec(conn, "embeddings", 1, new Float32Array([1, 0, 0, 0]));
    insertVec(conn, "embeddings", 2, new Float32Array([0, 1, 0, 0]));
    insertVec(conn, "embeddings", 3, new Float32Array([0, 0, 1, 0]));
    const hits = searchVec(conn, "embeddings", new Float32Array([1, 0, 0, 0]), 2);
    expect(hits[0].rowid).toBe(1);
    expect(hits[0].distance).toBeCloseTo(0, 5);
  });

  it("rejects bad table name", () => {
    expect(() => createVecTable(conn, "bad name; DROP", 4)).toThrow();
  });

  it("rejects bad dim", () => {
    expect(() => createVecTable(conn, "x", 0)).toThrow();
    expect(() => createVecTable(conn, "x", 999_999)).toThrow();
  });
});
