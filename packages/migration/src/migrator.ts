// SPDX-License-Identifier: Apache-2.0
// @bc CS-026 Migrator
// @gate G24.2, G24.3, G24.4

import { SqliteConnection, runMigrations, listApplied, type MigrationRecord } from '@orqenix/storage-sqlite';
import { CHAT_KB_MIGRATIONS } from '@orqenix/kb-chat';
import { MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import { REINDEX_MIGRATIONS } from '@orqenix/reindex-incremental';
import { SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { WORKSPACE_MIGRATIONS } from '@orqenix/workspace';
import { AUDIT_LOG_MIGRATIONS } from '@orqenix/audit-log';
import {
  MigrationError, RollbackError,
  type MigrationPhase, type MigrationReport, type MigrationStep, type RollbackReport,
} from './contracts.js';
import { backupDatabase, restoreFromBackup, verifyBackup } from './backup.js';

const PHASE_5_MIGRATIONS: MigrationRecord[] = [
  ...CHAT_KB_MIGRATIONS,
  ...MEMORY_TIER_MIGRATIONS,
  ...REINDEX_MIGRATIONS,
  ...SCOPE_LINK_MIGRATIONS,
  ...WORKSPACE_MIGRATIONS,
  ...AUDIT_LOG_MIGRATIONS,
].sort((a, b) => a.id - b.id);

export interface MigratorOptions {
  dbPath: string;
  backupDir: string;
  now?: () => string;
}

export class PhaseFourToFiveMigrator {
  private readonly dbPath: string;
  private readonly backupDir: string;
  private readonly now: () => string;

  constructor(opts: MigratorOptions) {
    this.dbPath = opts.dbPath;
    this.backupDir = opts.backupDir;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  async migrate(): Promise<MigrationReport> {
    const startedAt = this.now();
    const start = Date.now();

    const meta = await backupDatabase(this.dbPath, this.backupDir);
    if (!(await verifyBackup(meta.backupPath))) {
      throw new MigrationError('backup verification failed');
    }

    const conn = new SqliteConnection({ path: this.dbPath });
    const appliedBefore = new Set(listApplied(conn).map((m) => m.id));
    const stepsApplied: MigrationStep[] = [];
    try {
      const count = runMigrations(conn, PHASE_5_MIGRATIONS);
      const appliedAfter = listApplied(conn);
      for (const m of appliedAfter) {
        if (!appliedBefore.has(m.id) && PHASE_5_MIGRATIONS.find((p) => p.id === m.id)) {
          stepsApplied.push({
            id: m.id, name: m.name,
            fromPhase: 'phase-4', toPhase: 'phase-5',
          });
        }
      }
      conn.close();
      const finishedAt = this.now();
      const report: MigrationReport = {
        fromPhase: 'phase-4', toPhase: 'phase-5',
        stepsApplied, backupPath: meta.backupPath,
        startedAt, finishedAt, durationMs: Date.now() - start,
      };
      void count;
      return report;
    } catch (e) {
      try { conn.close(); } catch { /* ignore */ }
      try { await restoreFromBackup(meta.backupPath, this.dbPath); }
      catch (re) {
        throw new MigrationError(
          `migration failed AND rollback failed: ${(e as Error).message} | rollback: ${(re as Error).message}`,
        );
      }
      throw new MigrationError(`migration failed (rolled back): ${(e as Error).message}`);
    }
  }

  async rollback(backupPath: string): Promise<RollbackReport> {
    if (!(await verifyBackup(backupPath))) {
      throw new RollbackError(`backup at ${backupPath} failed integrity check`);
    }
    await restoreFromBackup(backupPath, this.dbPath);
    return {
      toPhase: 'phase-4', backupPath, restoredAt: this.now(),
    };
  }

  status(): { currentPhase: MigrationPhase; appliedMigrationIds: number[] } {
    const conn = new SqliteConnection({ path: this.dbPath });
    const applied = listApplied(conn);
    conn.close();
    const ids = applied.map((m) => m.id).sort((a, b) => a - b);
    const phase5Ids = new Set(PHASE_5_MIGRATIONS.map((m) => m.id));
    const anyPhase5Applied = ids.some((i) => phase5Ids.has(i));
    return {
      currentPhase: anyPhase5Applied ? 'phase-5' : 'phase-4',
      appliedMigrationIds: ids,
    };
  }
}
