import type { MigrationRecord } from '@orqenix/storage-sqlite';
import { createVecTable, type SqliteConnection } from '@orqenix/storage-sqlite';

const M001 = `
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id    TEXT PRIMARY KEY,
  scope_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_entry_at TEXT,
  entry_count   INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS chat_entries (
  entry_id        TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content         TEXT NOT NULL,
  tokens          INTEGER,
  content_hash    TEXT NOT NULL,
  prev_entry_hash TEXT,
  created_at      TEXT NOT NULL,
  metadata_json   TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE INDEX IF NOT EXISTS chat_entries_session_created
  ON chat_entries (session_id, created_at);

CREATE INDEX IF NOT EXISTS chat_entries_content_hash
  ON chat_entries (content_hash);
`;

export const CHAT_KB_MIGRATIONS: MigrationRecord[] = [
  { id: 1, name: 'chat_kb_v1', sql: M001, checksum: '' },
];

export function createChatVecTable(conn: SqliteConnection, dim = 384): void {
  createVecTable(conn, 'chat_embeddings', dim);
}
