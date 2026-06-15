// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Migrator } from '../src/migrator';
import { BASE_KB_BOOTSTRAP } from '@orqenix/memory-engine';

const SCOPE_ID = 'blake3:proj0001';

async function setupPhase7Project(dir: string): Promise<void> {
  const orqenixDir = join(dir, '.orqenix');
  await mkdir(orqenixDir, { recursive: true });
  await writeFile(join(orqenixDir, 'scope.yaml'), `scope_id: ${SCOPE_ID}\nname: test-project\ncreated_at: 2026-06-01T00:00:00Z\n`);

  // Create a Phase 7 memory.db with base KB tables + some entries
  const db = new Database(join(orqenixDir, 'memory.db'));
  db.exec(BASE_KB_BOOTSTRAP);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO decision_entries (id, hash, tier, content, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('d1', 'h1', 'T1', 'a decision', SCOPE_ID, now, now);
  db.close();
}

describe('Migrator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-mig-'));
    await setupPhase7Project(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('dry-run reports impact without changes', async () => {
    const result = await new Migrator().dryRun(tmpDir);
    expect(result.migrationsToApply.length).toBeGreaterThan(0);
    expect(result.entriesToBackfill).toBe(1);
    expect(result.noDataLoss).toBe(true);
    // No project.yaml created in dry-run
    expect(existsSync(join(tmpDir, '.orqenix', 'project.yaml'))).toBe(false);
  });

  it('apply creates backup + project.yaml + backfills', async () => {
    const result = await new Migrator().apply(tmpDir);
    expect(result.success).toBe(true);
    expect(result.projectId).toBe(SCOPE_ID);
    expect(result.entriesBackfilled).toBe(1);
    expect(existsSync(result.backupPath)).toBe(true);
    expect(existsSync(join(tmpDir, '.orqenix', 'project.yaml'))).toBe(true);
  });

  it('apply backfills branch_id + memory_level on entries', async () => {
    const result = await new Migrator().apply(tmpDir);
    const db = new Database(join(tmpDir, '.orqenix', 'memory.db'), { readonly: true });
    const row = db.prepare('SELECT branch_id, memory_level FROM decision_entries WHERE id = ?').get('d1') as
      | { branch_id: string; memory_level: string }
      | undefined;
    db.close();
    expect(row?.branch_id).toBe(result.branchId);
    expect(row?.memory_level).toBe('project');
  });

  it('apply records migration audit', async () => {
    await new Migrator().apply(tmpDir);
    const db = new Database(join(tmpDir, '.orqenix', 'memory.db'), { readonly: true });
    const row = db.prepare(
      "SELECT COUNT(*) AS c FROM audit_entries WHERE kind = 'project.migrated_from_phase_7'"
    ).get() as { c: number };
    db.close();
    expect(row.c).toBe(1);
  });

  it('apply sets 30-day rollback window', async () => {
    const result = await new Migrator().apply(tmpDir);
    const rollbackTime = new Date(result.rollbackUntil).getTime();
    const expectedMin = Date.now() + 29 * 24 * 3600 * 1000;
    expect(rollbackTime).toBeGreaterThan(expectedMin);
  });
});
