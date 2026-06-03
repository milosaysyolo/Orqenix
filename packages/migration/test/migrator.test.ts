// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection } from "@orqenix/storage-sqlite";
import {
  PhaseFourToFiveMigrator,
  backupDatabase,
  restoreFromBackup,
  verifyBackup,
  MigrationError,
  BackupMissingError,
} from "../src";

describe("PhaseFourToFiveMigrator", () => {
  let dir: string;
  let dbPath: string;
  let backupDir: string;
  let migrator: PhaseFourToFiveMigrator;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-mig-"));
    dbPath = join(dir, "kb.sqlite");
    backupDir = join(dir, "backups");

    // Simulate a Phase 4 DB (empty + has migration table from a stub)
    const conn = new SqliteConnection({ path: dbPath });
    conn.exec(
      `CREATE TABLE IF NOT EXISTS phase4_legacy (id INTEGER PRIMARY KEY, payload TEXT) STRICT;`,
    );
    conn.exec(`INSERT INTO phase4_legacy (payload) VALUES ('legacy data');`);
    conn.close();

    migrator = new PhaseFourToFiveMigrator({ dbPath, backupDir });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("migrate applies Phase 5 migrations in id order", async () => {
    const report = await migrator.migrate();
    const ids = report.stepsApplied.map((s) => s.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
    expect(ids).toContain(1); // chat
    expect(ids).toContain(2); // memory-tiers
    expect(ids).toContain(10); // reindex
    expect(ids).toContain(20); // scope-link
    expect(ids).toContain(21); // workspace
    expect(ids).toContain(30); // audit-log
  });

  it("migrate preserves Phase 4 legacy data", async () => {
    await migrator.migrate();
    const conn = new SqliteConnection({ path: dbPath });
    const rows = conn
      .prepare<{ payload: string }>(`SELECT payload FROM phase4_legacy`)
      .all() as Array<{ payload: string }>;
    conn.close();
    expect(rows.length).toBe(1);
    expect(rows[0].payload).toBe("legacy data");
  });

  it("migrate produces a verifiable backup", async () => {
    const report = await migrator.migrate();
    expect(await verifyBackup(report.backupPath)).toBe(true);
  });

  it("status reports phase-5 after successful migration", async () => {
    const before = migrator.status();
    expect(before.currentPhase).toBe("phase-4");
    await migrator.migrate();
    const after = migrator.status();
    expect(after.currentPhase).toBe("phase-5");
  });

  it("rollback restores from a specific backup", async () => {
    const report = await migrator.migrate();
    await migrator.rollback(report.backupPath);
    const after = migrator.status();
    expect(after.currentPhase).toBe("phase-4");
  });

  it("rollback rejects missing backup", async () => {
    await expect(migrator.rollback("/nonexistent/path.sqlite.bak")).rejects.toThrow();
  });

  it("rollback rejects backup with bad integrity", async () => {
    const report = await migrator.migrate();
    await writeFile(report.backupPath, "corrupted");
    await expect(migrator.rollback(report.backupPath)).rejects.toThrow();
  });

  it("idempotent re-run after successful migration", async () => {
    await migrator.migrate();
    const second = await migrator.migrate();
    expect(second.stepsApplied.length).toBe(0);
  });

  it("backupDatabase + restoreFromBackup round-trip", async () => {
    const meta = await backupDatabase(dbPath, backupDir);
    expect(meta.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const altDb = join(dir, "restored.sqlite");
    await restoreFromBackup(meta.backupPath, altDb);
    const a = await readFile(dbPath);
    const b = await readFile(altDb);
    expect(a.equals(b)).toBe(true);
  });

  it("restoreFromBackup throws BackupMissingError when source missing", async () => {
    await expect(restoreFromBackup("/no/such/file.bak", join(dir, "x.sqlite"))).rejects.toThrow(
      BackupMissingError,
    );
  });
});
