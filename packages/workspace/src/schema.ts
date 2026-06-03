// SPDX-License-Identifier: Apache-2.0
// @bc CS-022 Workspace Schema
// @gate G31.1

import type { MigrationRecord } from "@orqenix/storage-sqlite";

const M001 = `
CREATE TABLE IF NOT EXISTS workspaces (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  owner_scope_id  TEXT NOT NULL,
  description     TEXT,
  created_at      TEXT NOT NULL,
  metadata_json   TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scope_id      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','contributor','observer')),
  joined_at     TEXT NOT NULL,
  PRIMARY KEY (workspace_id, scope_id)
) STRICT;

CREATE INDEX IF NOT EXISTS workspace_memberships_scope
  ON workspace_memberships (scope_id, role);
`;

export const WORKSPACE_MIGRATIONS: MigrationRecord[] = [
  { id: 21, name: "workspaces_v1", sql: M001, checksum: "" },
];
