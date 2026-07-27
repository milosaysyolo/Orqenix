// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Migration runner
//
// Applies migrations with BLAKE3 checksum tracking + drift detection.
// Extends the Phase 5 pattern (storage-sqlite migration runner).

import type { Database } from "better-sqlite3";
import type { Migration } from "./500-hierarchy";

export class MigrationDriftError extends Error {
  constructor(
    public readonly migrationId: number,
    public readonly storedChecksum: string,
    public readonly incomingChecksum: string,
  ) {
    super(
      `Migration ${migrationId} drift: stored checksum ${storedChecksum} != incoming ${incomingChecksum}. ` +
        `The migration file was modified after it was applied. Investigate before proceeding.`,
    );
    this.name = "MigrationDriftError";
    Object.setPrototypeOf(this, MigrationDriftError.prototype);
  }
}

export interface MigrationResult {
  applied: number[];
  skipped: number[];
}

export class MigrationRunner {
  constructor(private readonly db: Database) {}

  /**
   * Applies migrations idempotently. Tracks checksums in _orqenix_migrations.
   * Throws MigrationDriftError if a stored checksum doesn't match.
   *
   * @param failOnDrift default true; if false, logs drift but continues
   */
  apply(migrations: Migration[], failOnDrift = true): MigrationResult {
    const applied: number[] = [];
    const skipped: number[] = [];

    // Ensure migration tracking table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _orqenix_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);

    const getStmt = this.db.prepare("SELECT checksum FROM _orqenix_migrations WHERE id = ?");
    const insertStmt = this.db.prepare(
      "INSERT INTO _orqenix_migrations (id, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
    );

    for (const migration of migrations) {
      const existing = getStmt.get(migration.id) as { checksum: string } | undefined;

      if (existing) {
        // Already applied; check drift
        if (existing.checksum !== migration.checksum) {
          if (failOnDrift) {
            throw new MigrationDriftError(migration.id, existing.checksum, migration.checksum);
          }
          // eslint-disable-next-line no-console
          console.warn(
            `[memory-engine] Migration ${migration.id} drift detected but failOnDrift=false; continuing`,
          );
        }
        skipped.push(migration.id);
        continue;
      }

      // Apply in a transaction
      const txn = this.db.transaction(() => {
        this.db.exec(migration.up);
        insertStmt.run(migration.id, migration.name, migration.checksum, new Date().toISOString());
      });
      txn();
      applied.push(migration.id);
    }

    return { applied, skipped };
  }

  /** Rolls back a migration by ID (runs its down SQL) */
  rollback(migration: Migration): void {
    const txn = this.db.transaction(() => {
      this.db.exec(migration.down);
      this.db.prepare("DELETE FROM _orqenix_migrations WHERE id = ?").run(migration.id);
    });
    txn();
  }

  /** Lists applied migration IDs */
  listApplied(): number[] {
    const rows = this.db
      .prepare("SELECT id FROM _orqenix_migrations ORDER BY id ASC")
      .all() as Array<{ id: number }>;
    return rows.map((r) => r.id);
  }
}
