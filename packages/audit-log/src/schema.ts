// SPDX-License-Identifier: Apache-2.0
// @bc CS-024 Audit Schema
// @gate G18.1

import type { MigrationRecord } from '@orqenix/storage-sqlite';

const M001 = `
CREATE TABLE IF NOT EXISTS audit_log_entries (
  rowid          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_id       TEXT NOT NULL,
  actor_scope_id TEXT NOT NULL,
  event_kind     TEXT NOT NULL,
  payload_json   TEXT NOT NULL,
  prev_hash      TEXT,
  content_hash   TEXT NOT NULL,
  created_at     TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS audit_log_scope_kind
  ON audit_log_entries (scope_id, event_kind, rowid);

CREATE INDEX IF NOT EXISTS audit_log_content_hash
  ON audit_log_entries (content_hash);
`;

export const AUDIT_LOG_MIGRATIONS: MigrationRecord[] = [
  { id: 30, name: 'audit_log_v1', sql: M001, checksum: '' },
];
