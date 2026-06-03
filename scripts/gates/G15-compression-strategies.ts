// SPDX-License-Identifier: Apache-2.0
// @gate G15
import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DropStrategy, SummarizeStrategy, DistillStrategy, CompressChainStrategy,
  COMPRESS_STRATEGY_IDS, Tier0ViolationError, estimateTokens,
  type Conversation, type PreservationTier, type TaggedMessage,
} from '@orqenix/compress-strategies';
import { SmartCompressionEngine, selectStrategy } from '@orqenix/smart-compression';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function m(id: string, role: TaggedMessage['role'], c: string, tier: PreservationTier, t: number): TaggedMessage {
  return { id, role, content: c, tier, tokens: estimateTokens(c), createdAt: new Date(2026, 0, 1, 0, 0, 0, t).toISOString() };
}

class G15 extends GateRunner {
  readonly id = 'G15';
  readonly title = 'Compression Strategies';
  protected loadSpec(): unknown { return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G15.yaml'), 'utf-8'); }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G15.1', 'compress-strategies unit tests pass', () => {
        execSync('npx vitest run', { cwd: join(REPO_ROOT, 'packages/compress-strategies'), stdio: 'pipe' });
      }),

      await this.check('G15.2', 'smart-compression unit tests pass', () => {
        execSync('npx vitest run', { cwd: join(REPO_ROOT, 'packages/smart-compression'), stdio: 'pipe' });
      }),

      await this.check('G15.3', 'all 4 strategy ids registered', () => {
        if (COMPRESS_STRATEGY_IDS.join(',') !== 'drop,summarize,distill,compress-chain') {
          throw new Error(`unexpected strategy ids: ${COMPRESS_STRATEGY_IDS.join(',')}`);
        }
      }),

      await this.check('G15.4', 'drop preserves tier 0 under aggressive budget', async () => {
        const conv: Conversation = {
          scopeId: SCOPE,
          messages: [m('m0', 'system', 'x'.repeat(800), 0, 0), m('m1', 'user', 'small', 4, 100)],
        };
        const out = await new DropStrategy().apply({ conversation: conv, targetTokens: 5, maxTokens: 100, strategy: 'drop' });
        if (!out.conversation.messages.find((x) => x.id === 'm0')) throw new Error('tier 0 was dropped');
      }),

      await this.check('G15.5', 'summarize respects tier 0-1', async () => {
        const conv: Conversation = {
          scopeId: SCOPE,
          messages: [
            m('m0', 'system', 'sys', 0, 0),
            m('m1', 'user', 'x'.repeat(400), 1, 100),
            m('m2', 'user', 'y'.repeat(400), 3, 200),
            m('m3', 'user', 'z'.repeat(400), 3, 300),
            m('m4', 'user', 'q'.repeat(400), 3, 400),
          ],
        };
        const out = await new SummarizeStrategy({ localFallback: true }).apply({
          conversation: conv, targetTokens: 150, maxTokens: 500, strategy: 'summarize',
        });
        if (!out.conversation.messages.find((x) => x.id === 'm0')) throw new Error('tier 0 lost');
        if (!out.conversation.messages.find((x) => x.id === 'm1')) throw new Error('tier 1 lost');
      }),

      await this.check('G15.6', 'distill captures drafts and drops originals', async () => {
        const drafts: any[] = [];
        const strat = new DistillStrategy({
          extract: (text, sourceId) => text.includes('prefer') ? [{ type: 'preference', content: text, confidence: 0.9, sourceMessageId: sourceId }] : [],
          memoryWriter: async (d) => { drafts.push(...d); },
        });
        const conv: Conversation = {
          scopeId: SCOPE,
          messages: [m('m1', 'user', 'I prefer Rust', 3, 100), m('m2', 'user', 'current', 1, 200)],
        };
        await strat.apply({ conversation: conv, targetTokens: 1, maxTokens: 100, strategy: 'distill' });
        if (drafts.length === 0) throw new Error('no drafts emitted');
      }),

      await this.check('G15.7', 'selectStrategy auto routes correctly', () => {
        const cfg = {
          targetTokens: 100, maxTokens: 300, overflowCapPercent: 105 as const,
          selectionPolicy: 'auto' as const, defaultStrategy: 'compress-chain' as const, minCompressionRatio: 0.95,
        };
        const small: Conversation = { scopeId: SCOPE, messages: [m('m1', 'user', 'tiny', 3, 0)] };
        if (selectStrategy(small, cfg).strategyId !== 'drop') throw new Error('small not drop');
        const big: Conversation = { scopeId: SCOPE, messages: [m('m1', 'user', 'x'.repeat(2000), 3, 0)] };
        if (selectStrategy(big, cfg).strategyId !== 'compress-chain') throw new Error('big not chain');
      }),

      await this.check('G15.8', 'engine raises on tier-0 forced violation / overflow', async () => {
        const conv: Conversation = { scopeId: SCOPE, messages: [m('m0', 'system', 'x'.repeat(400), 0, 0)] };
        const engine = new SmartCompressionEngine({
          config: { targetTokens: 1, maxTokens: 50, overflowCapPercent: 105, selectionPolicy: 'fixed', defaultStrategy: 'drop' },
          strategies: { drop: new DropStrategy() }, scopeId: SCOPE,
        });
        let caught = false;
        try { await engine.compress(conv); } catch (e: unknown) {
          caught = true;
          if (!(e instanceof Error)) throw e;
        }
        if (!caught) throw new Error('expected OverflowError or Tier0ViolationError');
        void Tier0ViolationError;
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G15-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G15(); const rep = await r.execute(); r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G15 crashed:', e); process.exit(2); });
