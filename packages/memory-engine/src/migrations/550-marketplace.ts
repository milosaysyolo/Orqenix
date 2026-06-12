// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Migration 550-559: marketplace state
//
// Per CR v8.0 Section 6.8. Wired into memory-engine migrations.

import { blake3 } from '@noble/hashes/blake3';
import type { Migration } from './500-hierarchy';

function checksum(up: string, down = ''): string {
  const h = blake3(new TextEncoder().encode(up + '\n' + down));
  let s = '';
  for (let i = 0; i < h.length; i++) s += (h[i] as number).toString(16).padStart(2, '0');
  return s;
}

const MIGRATION_550_UP = `
CREATE TABLE IF NOT EXISTS marketplace_imports (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  source_path TEXT,
  csf_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  imported_by TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','partial','failed')),
  warnings_json TEXT,
  result_plugin_name TEXT,
  audit_id TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_imports_recent ON marketplace_imports(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_source ON marketplace_imports(source_kind, imported_at DESC);

CREATE TABLE IF NOT EXISTS adapter_provenance (
  csf_hash TEXT PRIMARY KEY,
  imported_from_kind TEXT NOT NULL,
  original_url TEXT,
  original_path TEXT,
  normalizer_version TEXT NOT NULL,
  original_format_blob TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS local_plugins (
  name TEXT PRIMARY KEY,
  csf_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`.trim();

const MIGRATION_550_DOWN = `
DROP TABLE IF EXISTS local_plugins;
DROP TABLE IF EXISTS adapter_provenance;
DROP TABLE IF EXISTS marketplace_imports;
`.trim();

export const MARKETPLACE_MIGRATIONS: Migration[] = [
  {
    id: 550,
    name: 'marketplace-state',
    up: MIGRATION_550_UP,
    down: MIGRATION_550_DOWN,
    checksum: checksum(MIGRATION_550_UP, MIGRATION_550_DOWN),
  },
];
