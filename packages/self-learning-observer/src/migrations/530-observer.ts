// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , Migration 530-539: observation events
//
// Per CR v8.0 Section 9.4.1. Wired into memory-engine migrations.

import { blake3 } from "@noble/hashes/blake3";

function checksum(up: string, down = ""): string {
  const h = blake3(new TextEncoder().encode(up + "\n" + down));
  let s = "";
  for (let i = 0; i < h.length; i++) s += (h[i] as number).toString(16).padStart(2, "0");
  return s;
}

const MIGRATION_530_UP = `
CREATE TABLE IF NOT EXISTS observation_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch_id TEXT,
  session_id TEXT NOT NULL,
  parent_session_id TEXT,
  timestamp TEXT NOT NULL,
  agent_platform TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','agent','subagent')),
  actor_id TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  action_payload_json TEXT NOT NULL,
  outcome_kind TEXT,
  outcome_duration_ms INTEGER,
  outcome_payload_json TEXT,
  pii_redaction_applied INTEGER NOT NULL DEFAULT 0,
  redaction_notes TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_obs_recent ON observation_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_obs_session ON observation_events(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_obs_branch ON observation_events(branch_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_obs_action ON observation_events(action_kind);

CREATE TABLE IF NOT EXISTS instinct_candidates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch_id TEXT,
  session_id TEXT,
  pattern_hash TEXT NOT NULL,
  pattern_name TEXT,
  pattern_description TEXT,
  observation_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  sample_observation_ids TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  impact_score REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('detected','reviewed','promoted','rejected','deferred')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_decision TEXT,
  cross_scope INTEGER NOT NULL DEFAULT 0,
  cross_scope_sources_json TEXT,
  UNIQUE (project_id, pattern_hash)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_candidates_status ON instinct_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_impact ON instinct_candidates(impact_score DESC) WHERE status = 'detected';

CREATE TABLE IF NOT EXISTS skill_verification_runs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  verification_kind TEXT NOT NULL CHECK (verification_kind IN ('replay','a_b','cross_validation')),
  run_at TEXT NOT NULL,
  observations_used INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  partial_count INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  notes TEXT,
  result_payload_json TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_verifications_skill ON skill_verification_runs(skill_id, run_at DESC);

CREATE TABLE IF NOT EXISTS observer_config (
  scope TEXT NOT NULL,
  hierarchy_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, hierarchy_id)
) STRICT;
`.trim();

const MIGRATION_530_DOWN = `
DROP TABLE IF EXISTS observer_config;
DROP TABLE IF EXISTS skill_verification_runs;
DROP TABLE IF EXISTS instinct_candidates;
DROP TABLE IF EXISTS observation_events;
`.trim();

export interface SelfLearningMigration {
  id: number;
  name: string;
  up: string;
  down: string;
  checksum: string;
}

export const SELF_LEARNING_MIGRATIONS: SelfLearningMigration[] = [
  {
    id: 530,
    name: "self-learning-observer",
    up: MIGRATION_530_UP,
    down: MIGRATION_530_DOWN,
    checksum: checksum(MIGRATION_530_UP, MIGRATION_530_DOWN),
  },
];
