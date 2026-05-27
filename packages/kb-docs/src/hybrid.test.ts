import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";
import { hybridSearch } from "./hybrid.js";

function randVec(dims = 384): Float32Array {
  const v = new Float32Array(dims);
  for (let i = 0; i < dims; i++) v[i] = Math.random() - 0.5;
  return v;
}

describe("hybrid retrieval", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    initSchema(db);

    db.prepare(`INSERT INTO documents (id, path, format, file_hash, indexed_at) VALUES (?,?,?,?,?)`).run(
      "d1", "lifecycle.md", "markdown", "abc", new Date().toISOString(),
    );
    db.prepare(`INSERT INTO documents (id, path, format, file_hash, indexed_at) VALUES (?,?,?,?,?)`).run(
      "d2", "marketplace.md", "markdown", "def", new Date().toISOString(),
    );

    const insert = db.prepare(
      `INSERT INTO chunks (id, doc_id, heading_path, content, start_line, end_line, embedding) VALUES (?,?,?,?,?,?,?)`,
    );
    const samples: [string, string, string, string, number, number][] = [
      ["c1", "d1", '["Lifecycle"]', "Lifecycle manages versioning, snapshots, and rollback for skills", 1, 5],
      ["c2", "d1", '["Knowledge Layer"]', "Knowledge layer indexes docs, code, and decisions", 6, 10],
      ["c3", "d2", '["Marketplace"]', "Marketplace federates plugin sources with cryptographic signatures", 11, 15],
    ];
    for (const [id, doc_id, hp, content, sl, el] of samples) {
      insert.run(id, doc_id, hp, content, sl, el, Buffer.from(randVec().buffer));
    }
  });

  it("returns BM25 matches for keyword query", () => {
    const r = hybridSearch(db, "lifecycle versioning", randVec(), 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.content).toContain("Lifecycle");
  });

  it("ranks by RRF fused score", () => {
    const r = hybridSearch(db, "marketplace plugin", randVec(), 5);
    expect(r[0]!.content).toContain("Marketplace");
    expect(r[0]!.score).toBeGreaterThan(0);
  });

  it("respects topK limit", () => {
    const r = hybridSearch(db, "knowledge", randVec(), 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("returns dense + sparse score breakdown", () => {
    const r = hybridSearch(db, "lifecycle", randVec(), 3);
    expect(r[0]!).toHaveProperty("scoreDense");
    expect(r[0]!).toHaveProperty("scoreSparse");
  });

  it("handles empty FTS match gracefully", () => {
    const r = hybridSearch(db, "xyzqq", randVec(), 5);
    expect(Array.isArray(r)).toBe(true);
  });
});
