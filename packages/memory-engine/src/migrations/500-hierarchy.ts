// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Migration 500-510: hierarchy columns
//
// Per CR v8.0 Section 4.7. Adds branch_id/session_id/memory_level/
// protection_flags/cloned_from_branch_id + promotion provenance to all 4 KB
// tables, plus creates session/branch tables and audit_entries hierarchy enrichment.

import { blake3 } from '@noble/hashes/blake3';

function checksum(up: string, down = ''): string {
  const bytes = new TextEncoder().encode(up + '\n' + down);
  const h = blake3(bytes);
  let s = '';
  for (let i = 0; i < h.length; i++) {
    s += (h[i] as number).toString(16).padStart(2, '0');
  }
  return s;
}

// Migration 500: hierarchy columns on the 4 KB tables
const KB_TABLES = ['chat_entries', 'code_entries', 'decision_entries', 'lesson_entries'];

function kbHierarchyUp(table: string): string {
  return [
    `ALTER TABLE ${table} ADD COLUMN branch_id TEXT;`,
    `ALTER TABLE ${table} ADD COLUMN session_id TEXT;`,
    `ALTER TABLE ${table} ADD COLUMN memory_level TEXT CHECK (memory_level IN ('session','branch','project'));`,
    `ALTER TABLE ${table} ADD COLUMN protection_flags TEXT;`,
    `ALTER TABLE ${table} ADD COLUMN cloned_from_branch_id TEXT;`,
    `ALTER TABLE ${table} ADD COLUMN promoted_from_session_id TEXT;`,
    `ALTER TABLE ${table} ADD COLUMN promoted_from_branch_id TEXT;`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_session ON ${table}(session_id);`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_branch ON ${table}(branch_id, memory_level);`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_protection ON ${table}(protection_flags) WHERE protection_flags IS NOT NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_promoted ON ${table}(promoted_from_session_id) WHERE promoted_from_session_id IS NOT NULL;`,
  ].join('\n');
}

const MIGRATION_500_UP = KB_TABLES.map(kbHierarchyUp).join('\n');

const MIGRATION_500_DOWN = KB_TABLES.flatMap((t) => [
  `DROP INDEX IF EXISTS idx_${t}_session;`,
  `DROP INDEX IF EXISTS idx_${t}_branch;`,
  `DROP INDEX IF EXISTS idx_${t}_protection;`,
  `DROP INDEX IF EXISTS idx_${t}_promoted;`,
]).join('\n');

// Migration 501: sessions + branches tables
const MIGRATION_501_UP = `
CREATE TABLE IF NOT EXISTS branches (
  branch_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  cloned_from_branch_id TEXT,
  cell_snapshot TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_branches_project ON branches(project_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  parent_session_id TEXT,
  agent_platform TEXT,
  state TEXT NOT NULL CHECK (state IN ('active','paused','deleted')),
  started_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  team_session_with TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_sessions_branch ON sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state, last_active_at DESC);
`.trim();

const MIGRATION_501_DOWN = `
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS branches;
`.trim();

// Migration 502: audit_entries hierarchy enrichment + blobs table
const MIGRATION_502_UP = `
CREATE TABLE IF NOT EXISTS audit_entries (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  project_id TEXT NOT NULL,
  branch_id TEXT,
  session_id TEXT,
  parent_session_id TEXT,
  kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT,
  payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  this_hash TEXT NOT NULL,
  cloud_sig TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_entries(project_id, seq);
CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_entries(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_entries(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_kind ON audit_entries(kind, ts DESC);

CREATE TABLE IF NOT EXISTS blobs (
  hash TEXT PRIMARY KEY,
  content BLOB NOT NULL,
  size_bytes INTEGER NOT NULL,
  zstd_level INTEGER NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
) STRICT;
`.trim();

const MIGRATION_502_DOWN = `
DROP TABLE IF EXISTS blobs;
DROP TABLE IF EXISTS audit_entries;
`.trim();

// Migration 540: installed_plugins (wires D8.α.4 RegistryPersistence)
const MIGRATION_540_UP = `
CREATE TABLE IF NOT EXISTS installed_plugins (
  id TEXT PRIMARY KEY,
  package_name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  kind TEXT NOT NULL,
  package_path TEXT NOT NULL,
  state TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  last_activated_at TEXT,
  crash_count INTEGER NOT NULL DEFAULT 0,
  total_invocations INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  manifest_json TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_plugins_state ON installed_plugins(state);
CREATE INDEX IF NOT EXISTS idx_plugins_kind ON installed_plugins(kind);
`.trim();

const MIGRATION_540_DOWN = `DROP TABLE IF EXISTS installed_plugins;`;

// Migration 560: config_overrides (wires D8.α.5 SettingsPersistence)
const MIGRATION_560_UP = `
CREATE TABLE IF NOT EXISTS config_overrides (
  module_id TEXT NOT NULL,
  setting_path TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('session','branch','project','user','system')),
  hierarchy_id TEXT,
  value_json TEXT NOT NULL,
  set_at TEXT NOT NULL,
  set_by TEXT NOT NULL,
  PRIMARY KEY (module_id, setting_path, level, hierarchy_id)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_config_module ON config_overrides(module_id);

CREATE TABLE IF NOT EXISTS audit_workbench_actions (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_workbench_actions_ts ON audit_workbench_actions(ts DESC);
`.trim();

const MIGRATION_560_DOWN = `
DROP TABLE IF EXISTS audit_workbench_actions;
DROP TABLE IF EXISTS config_overrides;
`.trim();

export interface Migration {
  id: number;
  name: string;
  up: string;
  down: string;
  checksum: string;
}

export const HIERARCHY_MIGRATIONS: Migration[] = [
  {
    id: 500,
    name: 'hierarchy-columns',
    up: MIGRATION_500_UP,
    down: MIGRATION_500_DOWN,
    checksum: checksum(MIGRATION_500_UP, MIGRATION_500_DOWN),
  },
  {
    id: 501,
    name: 'sessions-branches-tables',
    up: MIGRATION_501_UP,
    down: MIGRATION_501_DOWN,
    checksum: checksum(MIGRATION_501_UP, MIGRATION_501_DOWN),
  },
  {
    id: 502,
    name: 'audit-entries-blobs',
    up: MIGRATION_502_UP,
    down: MIGRATION_502_DOWN,
    checksum: checksum(MIGRATION_502_UP, MIGRATION_502_DOWN),
  },
  {
    id: 540,
    name: 'installed-plugins',
    up: MIGRATION_540_UP,
    down: MIGRATION_540_DOWN,
    checksum: checksum(MIGRATION_540_UP, MIGRATION_540_DOWN),
  },
  {
    id: 560,
    name: 'config-overrides',
    up: MIGRATION_560_UP,
    down: MIGRATION_560_DOWN,
    checksum: checksum(MIGRATION_560_UP, MIGRATION_560_DOWN),
  },
];
