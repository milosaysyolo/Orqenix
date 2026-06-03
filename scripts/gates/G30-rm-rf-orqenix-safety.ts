// SPDX-License-Identifier: Apache-2.0
// @gate G30
import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { WorkspaceStore, WORKSPACE_MIGRATIONS } from '@orqenix/workspace';
import { AuditLogStore, AUDIT_LOG_MIGRATIONS } from '@orqenix/audit-log';
import { DetachPlanner, DetachExecutor, InvalidConfirmationError } from '@orqenix/detach';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');
const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'g30-'));
  const conn = new SqliteConnection({ path: join(dir, 'd.sqlite') });
  runMigrations(conn, [...SCOPE_LINK_MIGRATIONS, ...WORKSPACE_MIGRATIONS, ...AUDIT_LOG_MIGRATIONS]);
  const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
  const workspaceStore = new WorkspaceStore({ conn });
  const auditStore = new AuditLogStore({ conn, scopeId: A });
  return {
    dir, conn, linkStore, workspaceStore, auditStore,
    planner: new DetachPlanner({ localScopeId: A, linkStore, workspaceStore, auditStore }),
    executor: new DetachExecutor({ localScopeId: A, linkStore, workspaceStore, auditStore, rootDir: dir }),
  };
}
async function tear(dir: string, conn: SqliteConnection) {
  conn.close(); await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

async function seedOrqenixDir(dir: string): Promise<void> {
  const orq = join(dir, '.orqenix');
  await mkdir(orq, { recursive: true });
  await writeFile(join(orq, 'identity.key'), 'PEM-PLACEHOLDER');
  await writeFile(join(orq, 'scope.yaml'), 'name: x');
  await mkdir(join(orq, 'gate-reports'), { recursive: true });
  await writeFile(join(orq, 'gate-reports', 'G1.json'), '{}');
}

class G30 extends GateRunner {
  readonly id = 'G30';
  readonly title = 'rm-rf .orqenix Safety';
  protected loadSpec(): unknown { return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G30.yaml'), 'utf-8'); }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G30.1', 'full-detach with default preserves identity.key', async () => {
        const { dir, conn, planner, executor } = await setup();
        try {
          await seedOrqenixDir(dir);
          const plan = planner.planFullDetach();
          await executor.execute(plan, plan.confirmationToken);
          const state = await executor.checkDirState(dir);
          if (!state.hasIdentityKey) throw new Error('identity.key removed by default');
          if (state.otherEntryCount !== 0) throw new Error('other files not removed');
        } finally { await tear(dir, conn); }
      }),
      await this.check('G30.2', 'preserveIdentityKey=false fully clears .orqenix', async () => {
        const { dir, conn, planner, executor } = await setup();
        try {
          await seedOrqenixDir(dir);
          const plan = planner.planFullDetach();
          await executor.execute(plan, plan.confirmationToken, { preserveIdentityKey: false });
          const state = await executor.checkDirState(dir);
          if (state.hasIdentityKey) throw new Error('identity.key still present');
          if (state.otherEntryCount !== 0) throw new Error('other files still present');
        } finally { await tear(dir, conn); }
      }),
      await this.check('G30.3', 'destructive op requires valid confirmation token', async () => {
        const { dir, conn, planner, executor } = await setup();
        try {
          await seedOrqenixDir(dir);
          const plan = planner.planFullDetach();
          let caught = false;
          try { await executor.execute(plan, 'detach:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'); }
          catch (e) { caught = e instanceof InvalidConfirmationError; }
          if (!caught) throw new Error('bad token allowed destructive op');
          // identity.key + scope.yaml + gate-reports/ should still exist
          const idKey = await readFile(join(dir, '.orqenix', 'identity.key'), 'utf-8');
          if (idKey !== 'PEM-PLACEHOLDER') throw new Error('identity.key was mutated despite bad token');
        } finally { await tear(dir, conn); }
      }),
      await this.check('G30.4', 'dryRun for full-detach does not remove any files', async () => {
        const { dir, conn, planner, executor } = await setup();
        try {
          await seedOrqenixDir(dir);
          const plan = planner.planFullDetach();
          await executor.execute(plan, plan.confirmationToken, { dryRun: true });
          const state = await executor.checkDirState(dir);
          if (!state.hasIdentityKey) throw new Error('dryRun removed identity.key');
          if (state.otherEntryCount === 0) throw new Error('dryRun removed other files');
        } finally { await tear(dir, conn); }
      }),
      await this.check('G30.5', 'unlink kind never touches .orqenix directory', async () => {
        const { dir, conn, linkStore, planner, executor } = await setup();
        try {
          await seedOrqenixDir(dir);
          const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
          linkStore.create({ remoteScopeId: B, direction: 'outbound' });
          linkStore.updateStatus(B, 'outbound', 'active');
          const plan = planner.planUnlink(B);
          await executor.execute(plan, plan.confirmationToken);
          const state = await executor.checkDirState(dir);
          if (!state.hasIdentityKey || state.otherEntryCount === 0) {
            throw new Error('unlink touched .orqenix directory');
          }
        } finally { await tear(dir, conn); }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G30-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G30(); const rep = await r.execute(); r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G30 crashed:', e); process.exit(2); });
