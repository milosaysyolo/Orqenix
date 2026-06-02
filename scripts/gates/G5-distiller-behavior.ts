import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ChatStore, CHAT_KB_MIGRATIONS } from '@orqenix/kb-chat';
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import { HeuristicDistiller, extractFromText } from '@orqenix/memory-distiller';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

class G5 extends GateRunner {
  readonly id = 'G5';
  readonly title = 'Memory Distiller Behavior';
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G5.yaml'), 'utf-8');
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G5.1', 'memory-distiller unit tests pass', () => {
        execSync('npx vitest run', { cwd: join(REPO_ROOT, 'packages/memory-distiller'), stdio: 'pipe' });
      }),

      await this.check('G5.2', 'extractor handles 50 mixed sentences without crash', () => {
        const samples = [
          'I prefer Rust for runtime work',
          'We decided to use SQLite for storage',
          'TODO: ship Part 5 by tomorrow',
          'I learned about BLAKE3 today',
          'My name is Milo and I work at WICloud',
          'How to optimize sqlite-vec queries',
          'Mike reports to Sameer',
          'noticed throughput drop',
        ];
        for (let i = 0; i < 50; i++) {
          const s = samples[i % samples.length] + ` (variant ${i})`;
          const c = extractFromText(s, `ce:${i}`);
          if (!Array.isArray(c)) throw new Error(`bad return at iter ${i}`);
        }
      }),

      await this.check('G5.3', 'distillBatch + watermark idempotency (20 entries)', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'g5-3-'));
        try {
          const conn = new SqliteConnection({ path: join(dir, 'g.sqlite') });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          runMigrations(conn, MEMORY_TIER_MIGRATIONS);
          const chat = new ChatStore({ conn, scopeId: SCOPE });
          const memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
          const distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: SCOPE });
          const s = chat.createSession({ scopeId: SCOPE, title: 't' });
          for (let i = 0; i < 20; i++) {
            await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: `I decided to use approach-${i}`, metadata: {} });
          }
          const first = distiller.distillBatch();
          if (first.entriesScanned === 0) throw new Error('first batch empty');
          const rest = distiller.distillAll(10);
          let extraScanned = 0;
          for (let i = 0; i < rest.length; i++) {
            if (i === 0) continue;
            extraScanned += rest[i].entriesScanned;
          }
          const subsequent = distiller.distillBatch();
          if (subsequent.entriesScanned !== 0) throw new Error('watermark not advanced');
          conn.close();
        } finally { await rm(dir, { recursive: true, force: true }); }
      }),

      await this.check('G5.4', 'idempotent across content_hash (no duplicate memories)', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'g5-4-'));
        try {
          const conn = new SqliteConnection({ path: join(dir, 'g.sqlite') });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          runMigrations(conn, MEMORY_TIER_MIGRATIONS);
          const chat = new ChatStore({ conn, scopeId: SCOPE });
          const memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
          const distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: SCOPE });
          const s = chat.createSession({ scopeId: SCOPE, title: 't' });
          for (let i = 0; i < 5; i++) {
            await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'I prefer Rust for runtime', metadata: {} });
          }
          distiller.distillAll(10);
          const prefs = memStore.listByType('preference');
          if (prefs.length !== 1) throw new Error(`expected 1 dedup-ed preference, got ${prefs.length}`);
          conn.close();
        } finally { await rm(dir, { recursive: true, force: true }); }
      }),

      await this.check('G5.5', 'minConfidence filter respected', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'g5-5-'));
        let conn: SqliteConnection | undefined;
        try {
          conn = new SqliteConnection({ path: join(dir, 'g.sqlite') });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          runMigrations(conn, MEMORY_TIER_MIGRATIONS);
          const chat = new ChatStore({ conn, scopeId: SCOPE });
          const memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
          const distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: SCOPE, config: { minConfidence: 0.95 } });
          const s = chat.createSession({ scopeId: SCOPE, title: 't' });
          await chat.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'maybe I should consider X', metadata: {} });
          distiller.distillBatch();
          if (memStore.countByTier().working + memStore.countByTier().episodic !== 0) {
            throw new Error('low-confidence extraction was admitted despite filter');
          }
        } finally {
          if (conn) conn.close();
          await new Promise((r) => setTimeout(r, 100));
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G5-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G5();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G5 crashed:', e); process.exit(2); });
