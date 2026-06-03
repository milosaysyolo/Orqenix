import type { MigrationRecord } from "@orqenix/storage-sqlite";

const M001 = `
CREATE TABLE IF NOT EXISTS reindex_entries (
  rel_path      TEXT NOT NULL,
  scope_id      TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  modified_at   TEXT NOT NULL,
  indexed_at    TEXT NOT NULL,
  PRIMARY KEY (scope_id, rel_path)
) STRICT;

CREATE INDEX IF NOT EXISTS reindex_entries_hash
  ON reindex_entries (content_hash);
`;

export const REINDEX_MIGRATIONS: MigrationRecord[] = [
  { id: 10, name: "reindex_v1", sql: M001, checksum: "" },
];
