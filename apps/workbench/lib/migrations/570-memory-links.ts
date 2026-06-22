// SPDX-License-Identifier: Apache-2.0

import { blake3 } from '@noble/hashes/blake3';

function checksum(up: string, down = ''): string {
  const h = blake3(new TextEncoder().encode(up + '\n' + down));
  let s = '';
  for (let i = 0; i < h.length; i++) s += (h[i] as number).toString(16).padStart(2, '0');
  return s;
}

const UP = `
CREATE TABLE IF NOT EXISTS memory_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  entry_kb TEXT NOT NULL,
  linkable INTEGER NOT NULL DEFAULT 0,
  from_scope TEXT NOT NULL,
  to_scope TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('created','active','inactive','severed')),
  cross_session_active INTEGER NOT NULL DEFAULT 1,
  cross_branch_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_mlinks_entry ON memory_links(entry_id);
CREATE INDEX IF NOT EXISTS idx_mlinks_state ON memory_links(state);
CREATE INDEX IF NOT EXISTS idx_mlinks_project ON memory_links(project_id);

CREATE TABLE IF NOT EXISTS memory_library (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  entry_kb TEXT NOT NULL,
  pinned_at TEXT NOT NULL,
  collection TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_mlib_project ON memory_library(project_id);
`.trim();

const DOWN = `
DROP TABLE IF EXISTS memory_library;
DROP TABLE IF EXISTS memory_links;
`.trim();

export const MEMORY_LINK_MIGRATIONS = [
  { id: 570, name: 'memory-links', up: UP, down: DOWN, checksum: checksum(UP, DOWN) },
];
