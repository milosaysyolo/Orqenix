// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { HookBus } from '@orqenix/hooks';
import { MetricsRegistry, METRIC_NAMES } from '@orqenix/telemetry';
import {
  DropStrategy, SummarizeStrategy, DistillStrategy, CompressChainStrategy,
  estimateTokens,
  type TaggedMessage, type Conversation, type PreservationTier,
} from '@orqenix/compress-strategies';
import { SmartCompressionEngine, OverflowError, selectStrategy, summarizeMetrics, formatRatioBar } from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function msg(id: string, role: TaggedMessage['role'], content: string, tier: PreservationTier, t: number): TaggedMessage {
  return {
    id, role, content, tier,
    tokens: estimateTokens(content),
    createdAt: new Date(2026, 0, 1, 0, 0, 0, t).toISOString(),
  };
}

function makeStrategies() {
  return {
    drop: new DropStrategy(),
    distill: new DistillStrategy({
      extract: (text, sourceId) =>
        text.includes('prefer') ? [{ type: 'preference', content: text, confidence: 0.9, sourceMessageId: sourceId }] : [],
    }),
    summarize: new SummarizeStrategy({ localFallback: true }),
    'compress-chain': new CompressChainStrategy({
      distill: new DistillStrategy({ extract: () => [] }),
      summarize: new SummarizeStrategy({ localFallback: true }),
    }),
  };
}

describe('selectStrategy', () => {
  const baseCfg = {
    targetTokens: 100, maxTokens: 300,
    overflowCapPercent: 105 as const, selectionPolicy: 'auto' as const,
    defaultStrategy: 'compress-chain' as const, minCompressionRatio: 0.95,
  };

  it('returns "drop" no-op when under target', () => {
    const c: Conversation = { scopeId: SCOPE, messages: [msg('m1', 'user', 'tiny', 3, 0)] };
    expect(selectStrategy(c, baseCfg).reason).toContain('under target');
  });

  it('picks drop when slightly over', () => {
    const c: Conversation = {
      scopeId: SCOPE,
      messages: [msg('m1', 'user', 'x'.repeat(440), 3, 0)],
    };
    const d = selectStrategy(c, baseCfg);
    expect(d.strategyId).toBe('drop');
  });

  it('picks distill in mid range', () => {
    const c: Conversation = {
      scopeId: SCOPE,
      messages: [msg('m1', 'user', 'x'.repeat(600), 3, 0)],
    };
    const d = selectStrategy(c, baseCfg);
    expect(d.strategyId).toBe('distill');
  });

  it('picks compress-chain when far over', () => {
    const c: Conversation = {
      scopeId: SCOPE,
      messages: [msg('m1', 'user', 'x'.repeat(2000), 3, 0)],
    };
    expect(selectStrategy(c, baseCfg).strategyId).toBe('compress-chain');
  });

  it('respects fixed policy', () => {
    const c: Conversation = { scopeId: SCOPE, messages: [msg('m1', 'user', 'tiny', 3, 0)] };
    const d = selectStrategy(c, { ...baseCfg, selectionPolicy: 'fixed', defaultStrategy: 'summarize' });
    expect(d.strategyId).toBe('summarize');
  });
});

describe('SmartCompressionEngine', () => {
  it('compresses + fires hooks + emits metrics', async () => {
    const bus = new HookBus();
    const metrics = new MetricsRegistry();
    const events: string[] = [];
    bus.on('preCompress',  () => { events.push('pre'); });
    bus.on('postCompress', () => { events.push('post'); });

    const engine = new SmartCompressionEngine({
      config: { targetTokens: 50, maxTokens: 300 },
      strategies: makeStrategies(),
      bus, metrics, scopeId: SCOPE,
    });

    const conv: Conversation = {
      scopeId: SCOPE,
      messages: [
        msg('m0', 'system', 'core', 0, 0),
        msg('m1', 'user', 'x'.repeat(400), 4, 100),
        msg('m2', 'assistant', 'y'.repeat(400), 4, 200),
        msg('m3', 'user', 'current', 1, 300),
      ],
    };

    const out = await engine.compress(conv);
    expect(out.outputTokens).toBeLessThan(out.inputTokens);
    expect(out.preservedTier0Count).toBe(1);
    expect(events).toEqual(['pre', 'post']);

    const snap = metrics.snapshot();
    expect(snap.counters.find((c) => c.name === METRIC_NAMES.COMPRESS_TOKENS_IN)?.value).toBeGreaterThan(0);
    expect(snap.histograms.find((h) => h.name === METRIC_NAMES.COMPRESS_RATIO)?.count).toBe(1);
  });

  it('throws OverflowError when strategy cannot fit into 105% cap', async () => {
    const engine = new SmartCompressionEngine({
      config: { targetTokens: 50, maxTokens: 300, selectionPolicy: 'fixed', defaultStrategy: 'drop', overflowCapPercent: 105 },
      strategies: {
        drop: {
          id: 'drop',
          async apply(input) {
            return {
              conversation: input.conversation,
              inputTokens: 500, outputTokens: 500, ratio: 1,
              preservedTier0Count: 1, droppedMessageIds: [],
              strategyId: 'drop', durationMs: 1,
            };
          },
        },
      },
      scopeId: SCOPE,
    });
    const conv: Conversation = {
      scopeId: SCOPE,
      messages: [msg('m0', 'system', 'locked', 0, 0)],
    };
    await expect(engine.compress(conv)).rejects.toThrow(OverflowError);
  });

  it('setConfig validates and updates at runtime', () => {
    const engine = new SmartCompressionEngine({
      config: { targetTokens: 100, maxTokens: 300 },
      strategies: makeStrategies(), scopeId: SCOPE,
    });
    engine.setConfig({ targetTokens: 200 });
    expect(engine.getConfig().targetTokens).toBe(200);
    expect(() => engine.setConfig({ targetTokens: 5000, maxTokens: 100 })).toThrow();
  });

  it('getDecision exposes selector output for UI', () => {
    const engine = new SmartCompressionEngine({
      config: { targetTokens: 50, maxTokens: 300 },
      strategies: makeStrategies(), scopeId: SCOPE,
    });
    const conv: Conversation = {
      scopeId: SCOPE,
      messages: [msg('m1', 'user', 'x'.repeat(1500), 3, 0)],
    };
    expect(engine.getDecision(conv).strategyId).toBe('compress-chain');
  });
});

describe('summarizeMetrics + formatRatioBar', () => {
  it('summarizes per-strategy breakdown', () => {
    const r = new MetricsRegistry();
    r.counter(METRIC_NAMES.COMPRESS_TOKENS_IN, { scope: 'x', strategy: 'drop' }).inc(100);
    r.counter(METRIC_NAMES.COMPRESS_TOKENS_OUT, { scope: 'x', strategy: 'drop' }).inc(50);
    r.histogram(METRIC_NAMES.COMPRESS_RATIO, { scope: 'x', strategy: 'drop' }).observe(0.5);
    r.histogram(METRIC_NAMES.COMPRESS_DURATION_MS, { scope: 'x', strategy: 'drop' }).observe(10);
    const sum = summarizeMetrics(r);
    expect(sum.totalIn).toBe(100);
    expect(sum.totalOut).toBe(50);
    expect(sum.avgRatio).toBeCloseTo(0.5);
    expect(sum.perStrategyBreakdown[0].strategy).toBe('drop');
  });

  it('formatRatioBar renders correctly', () => {
    expect(formatRatioBar(0,    10)).toBe('[----------] 0%');
    expect(formatRatioBar(0.5,  10)).toBe('[#####-----] 50%');
    expect(formatRatioBar(1,    10)).toBe('[##########] 100%');
    expect(formatRatioBar(1.5,  10)).toBe('[##########] 100%');
  });
});
