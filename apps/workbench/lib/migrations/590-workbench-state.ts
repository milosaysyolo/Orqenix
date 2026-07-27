import { blake3 } from '@noble/hashes/blake3';

function checksum(up: string, down = ''): string {
  const h = blake3(new TextEncoder().encode(up + '\n' + down));
  let s = '';
  for (let i = 0; i < h.length; i++) s += (h[i] as number).toString(16).padStart(2, '0');
  return s;
}

const UP = `
CREATE TABLE IF NOT EXISTS config_overrides (
  module_id TEXT NOT NULL, key TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'project',
  value_json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (module_id, key, scope)
) STRICT;
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY, client TEXT NOT NULL, scopes_json TEXT NOT NULL,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS bindings (
  platform TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'not_installed',
  installed_at TEXT, config_path TEXT
) STRICT;
`.trim();

const DOWN = `
DROP TABLE IF EXISTS bindings;
DROP TABLE IF EXISTS mcp_tokens;
DROP TABLE IF EXISTS config_overrides;
`.trim();

export const WORKBENCH_STATE_MIGRATIONS = [
  { id: 590, name: 'workbench-state', up: UP, down: DOWN, checksum: checksum(UP, DOWN) },
];
