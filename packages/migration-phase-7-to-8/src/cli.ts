// SPDX-License-Identifier: Apache-2.0
// @orqenix/migration-phase-7-to-8 , CLI (orqenix-migrate)

import { MigrationChecker } from './checker';
import { Migrator } from './migrator';
import { Rollback } from './rollback';

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectPath = process.cwd();

  switch (command) {
    case 'check': {
      const result = await new MigrationChecker().check(projectPath);
      log(`Detected phase: ${result.detectedPhase}`);
      log(`Ready to migrate: ${result.ready ? 'YES' : 'NO'}`);
      log(`Estimated entries: ${result.estimatedEntries}`);
      if (result.blockers.length) log(`Blockers:\n  - ${result.blockers.join('\n  - ')}`);
      if (result.warnings.length) log(`Warnings:\n  - ${result.warnings.join('\n  - ')}`);
      break;
    }
    case 'to-phase-8': {
      const isDryRun = args.includes('--dry-run');
      const isApply = args.includes('--apply');
      if (isDryRun) {
        const result = await new Migrator().dryRun(projectPath);
        log(`Would apply migrations: ${result.migrationsToApply.join(', ')}`);
        log(`Would backfill ${result.entriesToBackfill} entries with branch_id ${result.branchId}`);
        log(`Branch: ${result.branchName}`);
        log(`Estimated disk impact: +${result.estimatedDiskImpactKb} KB`);
        log(`No data loss: ${result.noDataLoss}`);
      } else if (isApply) {
        const result = await new Migrator().apply(projectPath);
        log(`Migration complete.`);
        log(`  Backup: ${result.backupPath}`);
        log(`  Migrations applied: ${result.migrationsApplied.join(', ')}`);
        log(`  Entries backfilled: ${result.entriesBackfilled}`);
        log(`  Rollback until: ${result.rollbackUntil}`);
        log(`  Audit ID: ${result.auditId}`);
      } else {
        log('Specify --dry-run or --apply');
        process.exit(1);
      }
      break;
    }
    case 'rollback': {
      const fromIdx = args.indexOf('--from');
      const backupPath = fromIdx >= 0 ? args[fromIdx + 1] : undefined;
      if (!backupPath) {
        log('rollback requires --from <backup-path>');
        process.exit(1);
      }
      const result = await new Rollback().rollback(backupPath);
      log(result.message);
      break;
    }
    default:
      log('Usage: orqenix-migrate <check | to-phase-8 [--dry-run|--apply] | rollback --from <path>>');
      process.exit(1);
  }
}

void main().catch((e) => {
  process.stderr.write(`[orqenix-migrate] ERROR: ${(e as Error).message}\n`);
  process.exit(1);
});
