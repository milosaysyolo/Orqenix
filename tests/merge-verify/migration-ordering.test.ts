// SPDX-License-Identifier: Apache-2.0
// MIGRATION ORDERING: all migrations across phases apply cleanly in sequence.
// A far-diverged merge can reorder/duplicate migrations or drop one. This test
// applies the full chain on a fresh DB and asserts the final schema is complete.

import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { HIERARCHY_MIGRATIONS, MARKETPLACE_MIGRATIONS, MigrationRunner, BASE_KB_BOOTSTRAP } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';

describe('MIGRATION ORDERING (all phases)', () => {
  let db: DB;
  afterEach(() => db?.close());

  it('full migration chain applies cleanly in order', () => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    const runner = new MigrationRunner(db);
    const all = [...HIERARCHY_MIGRATIONS, ...MARKETPLACE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS]
      .sort((a, b) => a.id - b.id);
    const result = runner.apply(all);
    expect(result.applied.length).toBeGreaterThan(0);
  });

  it('migration ids are unique (no collision after merge)', () => {
    const all = [...HIERARCHY_MIGRATIONS, ...MARKETPLACE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS];
    const ids = all.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('final schema has all expected tables', () => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    const runner = new MigrationRunner(db);
    const all = [...HIERARCHY_MIGRATIONS, ...MARKETPLACE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS].sort((a, b) => a.id - b.id);
    runner.apply(all);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    const expected = [
      'chat_entries', 'code_entries', 'decision_entries', 'lesson_entries',
      'sessions', 'branches', 'audit_entries', 'blobs',
      'installed_plugins',
      'marketplace_imports', 'adapter_provenance', 'local_plugins',
      'config_overrides',
      'observation_events', 'instinct_candidates', 'skill_verification_runs',
    ];
    for (const t of expected) {
      expect(tables, `Missing table: ${t}`).toContain(t);
    }
  });

  it('hierarchy columns exist on all 4 KB tables', () => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    new MigrationRunner(db).apply([...HIERARCHY_MIGRATIONS].sort((a, b) => a.id - b.id));
    for (const table of ['chat_entries', 'code_entries', 'decision_entries', 'lesson_entries']) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
      expect(cols).toContain('branch_id');
      expect(cols).toContain('memory_level');
      expect(cols).toContain('protection_flags');
    }
  });
});
