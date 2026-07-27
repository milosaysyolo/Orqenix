// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/tests/migrations.test.ts
// Purpose: Verify the full Workbench migration chain (core 500-560 + self-
//   learning 530 + 570 memory-links + 580 agents + 590 state) applies cleanly on
//   a fresh :memory: db, ids are unique, and all expected tables exist. This
//   catches migration-ordering/collision bugs before the app boots.
// Run: pnpm --filter @orqenix/workbench vitest run tests/migrations.test.ts
// ============================================================================

import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { ALL_PHASE_8_CORE_MIGRATIONS, MigrationRunner, BASE_KB_BOOTSTRAP } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { MEMORY_LINK_MIGRATIONS } from '../lib/migrations/570-memory-links';
import { AGENT_MIGRATIONS } from '../lib/migrations/580-agents';
import { WORKBENCH_STATE_MIGRATIONS } from '../lib/migrations/590-workbench-state';

function compose() {
  return [
    ...ALL_PHASE_8_CORE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS,
    ...MEMORY_LINK_MIGRATIONS, ...AGENT_MIGRATIONS, ...WORKBENCH_STATE_MIGRATIONS,
  ].sort((a, b) => a.id - b.id);
}

describe('Workbench migrations', () => {
  let db: DB;
  afterEach(() => db?.close());

  it('all migrations have unique ids', () => {
    const ids = compose().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('full chain applies cleanly', () => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    const r = new MigrationRunner(db).apply(compose(), false);
    expect(r.applied.length).toBeGreaterThan(0);
  });

  it('all expected tables exist after migration', () => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply(compose(), false);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of [
      'chat_entries', 'decision_entries', 'branches', 'sessions', 'audit_entries',
      'installed_plugins', 'observation_events', 'instinct_candidates',
      'memory_links', 'memory_library', 'agent_definitions', 'teams',
      'config_overrides', 'mcp_tokens', 'bindings',
    ]) {
      expect(tables, `missing ${t}`).toContain(t);
    }
  });
});