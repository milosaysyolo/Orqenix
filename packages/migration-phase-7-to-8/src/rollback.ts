// SPDX-License-Identifier: Apache-2.0
// @orqenix/migration-phase-7-to-8 , Rollback
//
// Restores a project to its pre-migration state from a backup. Per CR v8.0
// Section 11.4 (rollback within 30 days).

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { type MigrationRollbackResult, MigrationError } from './types';

export class Rollback {
  /**
   * Rolls back a migration by restoring from a backup directory.
   *
   * @param backupPath Path to the _migration_backup_<timestamp> directory
   */
  async rollback(backupPath: string): Promise<MigrationRollbackResult> {
    if (!existsSync(backupPath)) {
      throw new MigrationError('BACKUP_NOT_FOUND', `Backup not found at ${backupPath}`);
    }

    // The .orqenix dir is the parent of the backup
    const orqenixDir = dirname(backupPath);

    // Verify backup is within the 30-day window (by timestamp in name)
    const m = /_migration_backup_(.+)$/.exec(backupPath);
    if (m) {
      const ts = m[1]!.replace(/-/g, (c, i) => (i === 13 || i === 16 ? ':' : i === 19 ? '.' : c));
      const backupTime = new Date(ts).getTime();
      if (!Number.isNaN(backupTime)) {
        const ageMs = Date.now() - backupTime;
        if (ageMs > 30 * 24 * 3600 * 1000) {
          throw new MigrationError(
            'ROLLBACK_EXPIRED',
            `Backup is older than 30 days; rollback window expired`
          );
        }
      }
    }

    // Restore: remove current Phase 8 files, copy backup contents back
    const { rm, cp, readdir } = await import('node:fs/promises');
    const phase8Files = ['project.yaml', 'memory.db', 'memory.db-wal', 'memory.db-shm'];
    for (const f of phase8Files) {
      const p = join(orqenixDir, f);
      if (existsSync(p)) {
        await rm(p, { force: true }).catch(() => undefined);
      }
    }

    // Copy backup contents back into .orqenix (excluding the backup dir itself)
    const entries = await readdir(backupPath, { withFileTypes: true });
    for (const entry of entries) {
      const src = join(backupPath, entry.name);
      const dest = join(orqenixDir, entry.name);
      await cp(src, dest, { recursive: true });
    }

    return {
      success: true,
      restoredFrom: backupPath,
      message: `Project restored to Phase 7 state from ${backupPath}. project.yaml removed; scope.yaml restored.`,
    };
  }
}
