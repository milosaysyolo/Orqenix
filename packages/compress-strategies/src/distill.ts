// SPDX-License-Identifier: Apache-2.0
// @bc CS-014 Distill Strategy
// @gate G15.3

import {
  type CompressInput, type CompressOutput, type CompressStrategy,
  type TaggedMessage,
  totalTokens, Tier0ViolationError,
} from './contracts.js';

export interface DistilledDraft {
  type: string;
  content: string;
  confidence: number;
  sourceMessageId: string;
}

export interface DistillStrategyOptions {
  extract: (text: string, sourceId: string) => DistilledDraft[];
  memoryWriter?: (drafts: DistilledDraft[]) => Promise<void>;
  minConfidence?: number;
}

export class DistillStrategy implements CompressStrategy {
  readonly id = 'distill' as const;
  private readonly extract: DistillStrategyOptions['extract'];
  private readonly memoryWriter?: DistillStrategyOptions['memoryWriter'];
  private readonly minConfidence: number;

  constructor(opts: DistillStrategyOptions) {
    this.extract = opts.extract;
    this.memoryWriter = opts.memoryWriter;
    this.minConfidence = opts.minConfidence ?? 0.5;
  }

  async apply(input: CompressInput): Promise<CompressOutput> {
    const started = Date.now();
    const all: TaggedMessage[] = [...input.conversation.messages];
    const inputTokens = totalTokens(all);
    const tier0Set = new Set(all.filter((m) => m.tier === 0).map((m) => m.id));

    const allDrafts: DistilledDraft[] = [];
    const droppedIds: string[] = [];

    let kept = [...all];
    if (inputTokens > input.targetTokens) {
      const candidates = kept
        .filter((m) => (m.tier === 3 || m.tier === 4) && !m.sticky)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const c of candidates) {
        if (totalTokens(kept) <= input.targetTokens) break;
        if (c.tier === 0) throw new Tier0ViolationError(c.id);
        const drafts = this.extract(c.content, c.id).filter((d) => d.confidence >= this.minConfidence);
        allDrafts.push(...drafts);
        kept = kept.filter((m) => m.id !== c.id);
        droppedIds.push(c.id);
      }
    }

    if (allDrafts.length > 0 && this.memoryWriter) {
      try { await this.memoryWriter(allDrafts); } catch { /* swallow per CR v7.1: distillation is best-effort */ }
    }

    for (const id of tier0Set) {
      if (!kept.find((m) => m.id === id)) throw new Tier0ViolationError(id);
    }

    const outputTokens = totalTokens(kept);
    return {
      conversation: { ...input.conversation, messages: kept },
      inputTokens, outputTokens,
      ratio: inputTokens === 0 ? 1 : outputTokens / inputTokens,
      preservedTier0Count: tier0Set.size,
      droppedMessageIds: droppedIds,
      summary: allDrafts.length > 0 ? `Distilled ${allDrafts.length} memory drafts` : undefined,
      strategyId: this.id,
      durationMs: Date.now() - started,
    };
  }
}
