// SPDX-License-Identifier: Apache-2.0
// @bc CS-015 Engine
// @gate G14.4, G15.6, G22.2

import { HookBus, nowIso } from '@orqenix/hooks';
import { MetricsRegistry, METRIC_NAMES } from '@orqenix/telemetry';
import {
  type CompressOutput, type CompressStrategy, type CompressStrategyId,
  type Conversation, totalTokens,
} from '@orqenix/compress-strategies';
import {
  OverflowError, SmartCompressionConfigSchema,
  type EngineDecision, type SmartCompressionConfig,
} from './contracts.js';
import { selectStrategy } from './selector.js';

export interface SmartCompressionEngineOptions {
  config: Partial<SmartCompressionConfig> & Pick<SmartCompressionConfig, 'targetTokens' | 'maxTokens'>;
  strategies: Partial<Record<CompressStrategyId, CompressStrategy>>;
  bus?: HookBus;
  metrics?: MetricsRegistry;
  scopeId: string;
  now?: () => string;
}

export class SmartCompressionEngine {
  private cfg: SmartCompressionConfig;
  private readonly strategies: Partial<Record<CompressStrategyId, CompressStrategy>>;
  private readonly bus?: HookBus;
  private readonly metrics?: MetricsRegistry;
  private readonly scopeId: string;
  private readonly now: () => string;

  constructor(opts: SmartCompressionEngineOptions) {
    this.cfg = SmartCompressionConfigSchema.parse(opts.config);
    this.strategies = opts.strategies;
    this.bus = opts.bus;
    this.metrics = opts.metrics;
    this.scopeId = opts.scopeId;
    this.now = opts.now ?? nowIso;
  }

  getConfig(): SmartCompressionConfig { return this.cfg; }

  setConfig(partial: Partial<SmartCompressionConfig>): void {
    this.cfg = SmartCompressionConfigSchema.parse({ ...this.cfg, ...partial });
  }

  getDecision(conv: Conversation): EngineDecision {
    return selectStrategy(conv, this.cfg);
  }

  async compress(conv: Conversation): Promise<CompressOutput> {
    const decision = selectStrategy(conv, this.cfg);
    const strategy = this.strategies[decision.strategyId];
    if (!strategy) throw new Error(`strategy not registered: ${decision.strategyId}`);

    const inputTokens = totalTokens(conv.messages);
    if (this.bus) {
      await this.bus.emit('preCompress', {
        event: 'preCompress', scopeId: this.scopeId, timestamp: this.now(),
        inputTokens, contextSize: conv.messages.length, strategyId: decision.strategyId,
      });
    }

    const out = await strategy.apply({
      conversation: conv, targetTokens: this.cfg.targetTokens,
      maxTokens: this.cfg.maxTokens, strategy: decision.strategyId,
    });

    const capTokens = Math.ceil(this.cfg.targetTokens * (this.cfg.overflowCapPercent / 100));
    if (out.outputTokens > capTokens) {
      throw new OverflowError(out.outputTokens, capTokens);
    }

    if (this.bus) {
      await this.bus.emit('postCompress', {
        event: 'postCompress', scopeId: this.scopeId, timestamp: this.now(),
        inputTokens, outputTokens: out.outputTokens, ratio: out.ratio,
        strategyId: out.strategyId,
        preservedTier0Count: out.preservedTier0Count,
        durationMs: out.durationMs,
      });
    }

    if (this.metrics) {
      const labels = { scope: this.scopeId, strategy: out.strategyId };
      this.metrics.counter(METRIC_NAMES.COMPRESS_TOKENS_IN, labels).inc(inputTokens);
      this.metrics.counter(METRIC_NAMES.COMPRESS_TOKENS_OUT, labels).inc(out.outputTokens);
      this.metrics.histogram(METRIC_NAMES.COMPRESS_RATIO, labels).observe(out.ratio);
      this.metrics.histogram(METRIC_NAMES.COMPRESS_DURATION_MS, labels).observe(out.durationMs);
      this.metrics.gauge(METRIC_NAMES.COMPRESS_TIER0_PRESERVED, labels).set(out.preservedTier0Count);
    }

    return out;
  }
}
