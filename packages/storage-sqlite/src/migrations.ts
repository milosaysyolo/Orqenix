import { blake3Bytes } from '@orqenix/core';
import { Buffer } from 'node:buffer';
import { SqliteMigrationError, type AppliedMigration, type MigrationRecord } from './contracts.js';
import type { SqliteConnection } from './connection.js';

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS _orqenix_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
`;

function checksum(sql: string): string {
  return Buffer.from(blake3Bytes(new TextEncoder().encode(sql))).toString('hex');
}

export function listApplied(conn: SqliteConnection): AppliedMigration[] {
  conn.exec(BOOTSTRAP_SQL);
  const rows = conn.prepare<AppliedMigration>(
    `SELECT id, name, checksum, applied_at as appliedAt FROM _orqenix_migrations ORDER BY id ASC`,
  ).all() as AppliedMigration[];
  return rows;
}

export function runMigrations(conn: SqliteConnection, migrations: MigrationRecord[]): number {
  conn.exec(BOOTSTRAP_SQL);
  const applied = new Map(listApplied(conn).map((m) => [m.id, m]));
  const pending = [...migrations].sort((a, b) => a.id - b.id);
  let count = 0;

  for (const m of pending) {
    const want = checksum(m.sql);
    const existing = applied.get(m.id);
    if (existing) {
      if (existing.checksum !== want) {
        throw new SqliteMigrationError(
          m.id,
          `checksum drift: applied=${existing.checksum.slice(0, 12)}... requested=${want.slice(0, 12)}...`,
        );
      }
      continue;
    }
    try {
      conn.transaction(() => {
        conn.exec(m.sql);
        conn.prepare(
          `INSERT INTO _orqenix_migrations (id, name, checksum) VALUES (?, ?, ?)`,
        ).run(m.id, m.name, want);
      });
      count++;
    } catch (e) {
      throw new SqliteMigrationError(m.id, (e as Error).message);
    }
  }
  return count;
}
