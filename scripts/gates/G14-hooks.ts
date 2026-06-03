// SPDX-License-Identifier: Apache-2.0
// @gate G14
import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HookBus, HOOK_NAMES, nowIso, type PostCompressPayload } from '@orqenix/hooks';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function pcPayload(): PostCompressPayload {
  return {
    event: 'postCompress', scopeId: SCOPE, timestamp: nowIso(),
    inputTokens: 100, outputTokens: 50, ratio: 0.5,
    strategyId: 'drop', preservedTier0Count: 1, durationMs: 1,
  };
}

class G14 extends GateRunner {
  readonly id = 'G14';
  readonly title = 'Hooks';
  protected loadSpec(): unknown { return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G14.yaml'), 'utf-8'); }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G14.1', 'hooks unit tests pass', () => {
        execSync('npx vitest run', { cwd: join(REPO_ROOT, 'packages/hooks'), stdio: 'pipe' });
      }),
      await this.check('G14.2', 'all 7 events registrable', () => {
        const bus = new HookBus();
        let n = 0;
        for (const name of HOOK_NAMES) {
          bus.on(name as any, () => { n++; });
        }
        if (HOOK_NAMES.length !== 7) throw new Error(`expected 7 events, got ${HOOK_NAMES.length}`);
        if (n !== 0) throw new Error('listener invoked unexpectedly');
      }),
      await this.check('G14.3', 'listener error isolation works', async () => {
        const bus = new HookBus();
        let bRan = false;
        const errors: unknown[] = [];
        bus.onError((_, e) => errors.push(e));
        bus.on('postCompress', () => { throw new Error('boom'); });
        bus.on('postCompress', () => { bRan = true; });
        await bus.emit('postCompress', pcPayload());
        if (!bRan) throw new Error('second listener was blocked');
        if (errors.length !== 1) throw new Error(`expected 1 error captured, got ${errors.length}`);
      }),
      await this.check('G14.4', 'emit awaits async listeners', async () => {
        const bus = new HookBus();
        let done = false;
        bus.on('postCompress', async () => {
          await new Promise((r) => setTimeout(r, 30));
          done = true;
        });
        await bus.emit('postCompress', pcPayload());
        if (!done) throw new Error('emit did not await async listener');
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G14-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G14(); const rep = await r.execute(); r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G14 crashed:', e); process.exit(2); });
