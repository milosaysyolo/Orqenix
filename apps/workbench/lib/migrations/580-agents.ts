// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/lib/migrations/580-agents.ts
// Purpose: Tables backing the Agents cluster: agent_definitions (.md authored
//   agents/subagents), teams (orchestrated team graphs), team_edges (the wired
//   connections), and a sessions table augment if not present. Surfaces the
//   shipped subagent harness + team-session model.
// Rules: STRICT tables. Id range 580-589 (Workbench-local). Applied by runtime.ts.
// ============================================================================

import { blake3 } from '@noble/hashes/blake3';

function checksum(up: string, down = ''): string {
  const h = blake3(new TextEncoder().encode(up + '\n' + down));
  let s = '';
  for (let i = 0; i < h.length; i++) s += (h[i] as number).toString(16).padStart(2, '0');
  return s;
}

const UP = `
CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agent','subagent')),
  model TEXT,
  markdown TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  max_steps INTEGER NOT NULL DEFAULT 5,
  max_wall_time_sec INTEGER NOT NULL DEFAULT 90,
  enabled INTEGER NOT NULL DEFAULT 1,
  version TEXT NOT NULL DEFAULT '0.1.0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, name)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_agentdef_project ON agent_definitions(project_id);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template INTEGER NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL DEFAULT 'sequential',
  max_subagent_depth INTEGER NOT NULL DEFAULT 1,
  time_budget_sec INTEGER NOT NULL DEFAULT 300,
  token_budget INTEGER NOT NULL DEFAULT 8192,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  edges_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_teams_project ON teams(project_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch_id TEXT,
  parent_session_id TEXT,
  agent_platform TEXT,
  agent_name TEXT,
  model TEXT,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','completed','error','deleted')),
  team_session_with TEXT,
  task TEXT,
  steps_done INTEGER NOT NULL DEFAULT 0,
  steps_total INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);
`.trim();

const DOWN = `
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS agent_definitions;
`.trim();

export const AGENT_MIGRATIONS = [
  { id: 580, name: 'agents-teams-sessions', up: UP, down: DOWN, checksum: checksum(UP, DOWN) },
];
