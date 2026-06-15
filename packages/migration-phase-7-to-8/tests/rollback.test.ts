// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { Migrator } from '../src/migrator';
import { Rollback } from '../src/rollback';
import { MigrationError } from '../src/types';
import { BASE_KB_BOOTSTRAP } from '@orqenix/memory-engine';

const SCOPE_ID = 'blake3:proj0001';

async function setupPhase7Project(dir: string): Promise<void> {
  const orqenixDir = join(dir, '.orqenix');
  await mkdir(orqenixDir, { recursive: true });
  await writeFile(join(orqenixDir, 'scope.yaml'), `scope_id: ${SCOPE_ID}\nname: test\ncreated_at: 2026-06-01T00:00:00Z\n`);
  const db = new Database(join(orqenixDir, 'memory.db'));
  db.exec(BASE_KB_BOOTSTRAP);
  db.close();
}

describe('Rollback', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-rb-'));
    await setupPhase7Project(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('restores Phase 7 state from backup', async () => {
    const applyResult = await new Migrator().apply(tmpDir);
    // After migration, project.yaml exists
    expect(existsSync(join(tmpDir, '.orqenix', 'project.yaml'))).toBe(true);

    // Rollback
    const rbResult = await new Rollback().rollback(applyResult.backupPath);
    expect(rbResult.success).toBe(true);

    // project.yaml removed (Phase 8 artifact); scope.yaml restored
    expect(existsSync(join(tmpDir, '.orqenix', 'project.yaml'))).toBe(false);
    expect(existsSync(join(tmpDir, '.orqenix', 'scope.yaml'))).toBe(true);
  });

  it('throws for missing backup', async () => {
    await expect(
      new Rollback().rollback('/nonexistent/backup')
    ).rejects.toBeInstanceOf(MigrationError);
  });
});
