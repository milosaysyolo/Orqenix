import type { Database } from 'better-sqlite3';

export const id = 200;
export const phase = 6;
export const description = 'create mesh_transports table';

export function up(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mesh_transports (
      scope_id     TEXT NOT NULL,
      kind         TEXT NOT NULL CHECK (kind IN ('http','libp2p')),
      enabled      INTEGER NOT NULL CHECK (enabled IN (0,1)),
      listen_json  TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      PRIMARY KEY (scope_id, kind)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_mesh_transports_scope ON mesh_transports(scope_id);
  `);
}

export function down(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_mesh_transports_scope;
    DROP TABLE IF EXISTS mesh_transports;
  `);
}
