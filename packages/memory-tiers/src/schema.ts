import type { MigrationRecord } from "@orqenix/storage-sqlite";

const M001 = `
CREATE TABLE IF NOT EXISTS memory_entries (
  memory_id          TEXT PRIMARY KEY,
  tier               TEXT NOT NULL CHECK (tier IN ('working','episodic','semantic','procedural')),
  type               TEXT NOT NULL CHECK (type IN ('fact','preference','decision','task','learning','relationship','skill','observation')),
  content            TEXT NOT NULL,
  content_hash       TEXT NOT NULL,
  source_entry_ids   TEXT NOT NULL,
  confidence         REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at         TEXT NOT NULL,
  last_accessed_at   TEXT NOT NULL,
  access_count       INTEGER NOT NULL DEFAULT 0,
  scope_id           TEXT NOT NULL,
  metadata_json      TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS memory_entries_content_hash_scope
  ON memory_entries (content_hash, scope_id);

CREATE INDEX IF NOT EXISTS memory_entries_tier_type
  ON memory_entries (tier, type);

CREATE INDEX IF NOT EXISTS memory_entries_scope_created
  ON memory_entries (scope_id, created_at);

CREATE TABLE IF NOT EXISTS memory_distiller_watermarks (
  scope_id       TEXT PRIMARY KEY,
  last_entry_id  TEXT,
  last_run_at    TEXT NOT NULL
) STRICT;
`;

export const MEMORY_TIER_MIGRATIONS: MigrationRecord[] = [
  { id: 2, name: "memory_tiers_v1", sql: M001, checksum: "" },
];
