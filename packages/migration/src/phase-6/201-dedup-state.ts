import type { Database } from 'better-sqlite3';

export const id = 201;
export const phase = 6;
export const description = 'create mesh_dedup_state table';

export function up(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mesh_dedup_state (
      request_id     TEXT PRIMARY KEY,
      response_blob  BLOB NOT NULL,
      expires_at_ms  INTEGER NOT NULL,
      created_at     INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_mesh_dedup_state_expires ON mesh_dedup_state(expires_at_ms);
  `);
}

export function down(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_mesh_dedup_state_expires;
    DROP TABLE IF EXISTS mesh_dedup_state;
  `);
}
