// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import {
  MigrationRunner,
  HIERARCHY_MIGRATIONS,
  BASE_KB_BOOTSTRAP,
} from '../src/migrations/index';
import { MigrationDriftError } from '../src/migrations/runner';

describe('MigrationRunner', () => {
  let db: DB;
  let runner: MigrationRunner;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(BASE_KB_BOOTSTRAP);
    runner = new MigrationRunner(db);
  });

  afterEach(() => {
    db.close();
  });

  it('declares 5 migrations (500/501/502/540/560)', () => {
    const ids = HIERARCHY_MIGRATIONS.map((m) => m.id);
    expect(ids).toEqual([500, 501, 502, 540, 560]);
  });

  it('all migrations have BLAKE3 checksums', () => {
    for (const m of HIERARCHY_MIGRATIONS) {
      expect(m.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('applies all migrations', () => {
    const result = runner.apply(HIERARCHY_MIGRATIONS);
    expect(result.applied).toEqual([500, 501, 502, 540, 560]);
    expect(result.skipped).toEqual([]);
  });

  it('is idempotent (re-apply skips)', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    const second = runner.apply(HIERARCHY_MIGRATIONS);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([500, 501, 502, 540, 560]);
  });

  it('creates hierarchy columns on all 4 KB tables', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    for (const table of ['chat_entries', 'code_entries', 'decision_entries', 'lesson_entries']) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);
      expect(names).toContain('branch_id');
      expect(names).toContain('session_id');
      expect(names).toContain('memory_level');
      expect(names).toContain('protection_flags');
      expect(names).toContain('cloned_from_branch_id');
    }
  });

  it('creates sessions + branches + audit + blobs + installed_plugins + config_overrides tables', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('sessions');
    expect(names).toContain('branches');
    expect(names).toContain('audit_entries');
    expect(names).toContain('blobs');
    expect(names).toContain('installed_plugins');
    expect(names).toContain('config_overrides');
    expect(names).toContain('audit_workbench_actions');
  });

  it('detects checksum drift', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    const tampered = HIERARCHY_MIGRATIONS.map((m) =>
      m.id === 500 ? { ...m, checksum: 'deadbeef'.repeat(8) } : m
    );
    expect(() => runner.apply(tampered)).toThrow(MigrationDriftError);
  });

  it('continues on drift when failOnDrift=false', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    const tampered = HIERARCHY_MIGRATIONS.map((m) =>
      m.id === 500 ? { ...m, checksum: 'deadbeef'.repeat(8) } : m
    );
    const result = runner.apply(tampered, false);
    expect(result.skipped).toContain(500);
  });

  it('lists applied migration IDs', () => {
    runner.apply(HIERARCHY_MIGRATIONS);
    expect(runner.listApplied()).toEqual([500, 501, 502, 540, 560]);
  });
});
