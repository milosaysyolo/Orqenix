// SPDX-License-Identifier: Apache-2.0
// @gate G24
import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SqliteConnection } from '@orqenix/storage-sqlite';
import {
  PhaseFourToFiveMigrator, backupDatabase, restoreFromBackup, verifyBackup, BackupMissingError,
} from '@orqenix/migration';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');

async function freshPhase4DB(): Promise<{ dir: string; dbPath: string; backupDir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'g24-'));
  const dbPath = join(dir, 'kb.sqlite');
  const conn = new SqliteConnection({ path: dbPath });
  conn.exec(`CREATE TABLE IF NOT EXISTS phase4_legacy (id INTEGER PRIMARY KEY, payload TEXT) STRICT;`);
  conn.exec(`INSERT INTO phase4_legacy (payload) VALUES ('legacy-row');`);
  conn.close();
  return { dir, dbPath, backupDir: join(dir, 'backups') };
}

async function teardown(dir: string) {
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G24 extends GateRunner {
  readonly id = 'G24';
  readonly title = 'Migration Tooling';
  protected loadSpec(): unknown { return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G24.yaml'), 'utf-8'); }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G24.1', 'migration unit tests pass', () => {
        execSync('npx vitest run', { cwd: join(REPO_ROOT, 'packages/migration'), stdio: 'pipe' });
      }),
      await this.check('G24.2', 'migrate applies all Phase 5 migrations in id order', async () => {
        const { dir, dbPath, backupDir } = await freshPhase4DB();
        try {
          const m = new PhaseFourToFiveMigrator({ dbPath, backupDir });
          const report = await m.migrate();
          const ids = report.stepsApplied.map((s) => s.id);
          for (let i = 1; i < ids.length; i++) if (ids[i] <= ids[i - 1]) throw new Error('not sorted');
          for (const required of [1, 2, 10, 20, 21, 30]) {
            if (!ids.includes(required)) throw new Error(`missing migration ${required}`);
          }
        } finally { await teardown(dir); }
      }),
      await this.check('G24.3', 'migrate preserves Phase 4 legacy data', async () => {
        const { dir, dbPath, backupDir } = await freshPhase4DB();
        try {
          const m = new PhaseFourToFiveMigrator({ dbPath, backupDir });
          await m.migrate();
          const conn = new SqliteConnection({ path: dbPath, readonly: true });
          const rows = conn.prepare<{ payload: string }>(`SELECT payload FROM phase4_legacy`).all() as Array<{ payload: string }>;
          conn.close();
          if (rows.length !== 1 || rows[0].payload !== 'legacy-row') throw new Error('legacy data lost');
        } finally { await teardown(dir); }
      }),
      await this.check('G24.4', 'rollback restores from backup', async () => {
        const { dir, dbPath, backupDir } = await freshPhase4DB();
        try {
          const m = new PhaseFourToFiveMigrator({ dbPath, backupDir });
          const report = await m.migrate();
          await m.rollback(report.backupPath);
          const status = m.status();
          if (status.currentPhase !== 'phase-4') throw new Error(`expected phase-4 after rollback, got ${status.currentPhase}`);
        } finally { await teardown(dir); }
      }),
      await this.check('G24.5', 'rollback rejects corrupted backup', async () => {
        const { dir, dbPath, backupDir } = await freshPhase4DB();
        try {
          const m = new PhaseFourToFiveMigrator({ dbPath, backupDir });
          const report = await m.migrate();
          await writeFile(report.backupPath, 'corrupted');
          let caught = false;
          try { await m.rollback(report.backupPath); } catch { caught = true; }
          if (!caught) throw new Error('corrupted backup accepted');
        } finally { await teardown(dir); }
      }),
      await this.check('G24.6', 'backup round-trip preserves bytes', async () => {
        const { dir, dbPath, backupDir } = await freshPhase4DB();
        try {
          const meta = await backupDatabase(dbPath, backupDir);
          if (!(await verifyBackup(meta.backupPath))) throw new Error('verify failed');
          const restored = join(dir, 'restored.sqlite');
          await restoreFromBackup(meta.backupPath, restored);
          const { readFile } = await import('node:fs/promises');
          const a = await readFile(dbPath);
          const b = await readFile(restored);
          if (!a.equals(b)) throw new Error('round-trip bytes differ');
        } finally { await teardown(dir); }
      }),
      await this.check('G24.7', 'restoreFromBackup throws BackupMissingError', async () => {
        let caught = false;
        try { await restoreFromBackup('/nonexistent.bak', '/tmp/x.sqlite'); }
        catch (e) { caught = e instanceof BackupMissingError; }
        if (!caught) throw new Error('missing backup not detected');
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G24-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G24(); const rep = await r.execute(); r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G24 crashed:', e); process.exit(2); });
