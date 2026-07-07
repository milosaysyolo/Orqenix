import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import * as m200 from "../src/phase-6/200-transport-config.js";
import * as m201 from "../src/phase-6/201-dedup-state.js";

describe("Phase 6 migrations", () => {
  it("200: up creates mesh_transports, down drops it cleanly", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-mig-"));
    try {
      const db = new Database(join(dir, "m.db"));
      db.pragma("journal_mode = WAL");
      m200.up(db);
      const has = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='mesh_transports'`)
        .get();
      expect(has).toBeDefined();
      m200.down(db);
      const after = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='mesh_transports'`)
        .get();
      expect(after).toBeUndefined();
      db.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("201: up creates mesh_dedup_state, down drops it cleanly", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-mig-"));
    try {
      const db = new Database(join(dir, "m.db"));
      db.pragma("journal_mode = WAL");
      m201.up(db);
      const has = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='mesh_dedup_state'`)
        .get();
      expect(has).toBeDefined();
      m201.down(db);
      const after = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='mesh_dedup_state'`)
        .get();
      expect(after).toBeUndefined();
      db.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("200 and 201 reserve the expected migration IDs and phase", () => {
    expect(m200.id).toBe(200);
    expect(m200.phase).toBe(6);
    expect(m201.id).toBe(201);
    expect(m201.phase).toBe(6);
  });

  it("200 up is idempotent (re-running does not throw on STRICT table)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-mig-"));
    try {
      const db = new Database(join(dir, "m.db"));
      m200.up(db);
      expect(() => m200.up(db)).not.toThrow();
      db.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
