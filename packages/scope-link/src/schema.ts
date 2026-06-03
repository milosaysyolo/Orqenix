// SPDX-License-Identifier: Apache-2.0
// @bc CS-020 Scope Link Schema
// @gate G29.1

import type { MigrationRecord } from '@orqenix/storage-sqlite';

const M001 = `
CREATE TABLE IF NOT EXISTS scope_links (
  local_scope_id        TEXT NOT NULL,
  remote_scope_id       TEXT NOT NULL,
  direction             TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  status                TEXT NOT NULL CHECK (status IN ('pending','active','revoked')),
  display_name          TEXT,
  capability_token_jti  TEXT,
  created_at            TEXT NOT NULL,
  last_synced_at        TEXT,
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (local_scope_id, remote_scope_id, direction)
) STRICT;

CREATE INDEX IF NOT EXISTS scope_links_status
  ON scope_links (local_scope_id, status, direction);
`;

export const SCOPE_LINK_MIGRATIONS: MigrationRecord[] = [
  { id: 20, name: 'scope_links_v1', sql: M001, checksum: '' },
];
