// SPDX-License-Identifier: Apache-2.0
// @bc CS-014 Compress Chain Strategy
// @gate G15.4

import {
  type CompressInput, type CompressOutput, type CompressStrategy,
  totalTokens,
} from './contracts.js';
import { DropStrategy } from './drop.js';
import { DistillStrategy } from './distill.js';
import { SummarizeStrategy } from './summarize.js';

export interface CompressChainOptions {
  drop?: DropStrategy;
  distill: DistillStrategy;
  summarize: SummarizeStrategy;
}

export class CompressChainStrategy implements CompressStrategy {
  readonly id = 'compress-chain' as const;
  private readonly drop: DropStrategy;
  private readonly distill: DistillStrategy;
  private readonly summarize: SummarizeStrategy;

  constructor(opts: CompressChainOptions) {
    this.drop = opts.drop ?? new DropStrategy();
    this.distill = opts.distill;
    this.summarize = opts.summarize;
  }

  async apply(input: CompressInput): Promise<CompressOutput> {
    const started = Date.now();
    const inputTokens = totalTokens(input.conversation.messages);
    const tier0Count = input.conversation.messages.filter((m) => m.tier === 0).length;
    const ran: string[] = [];
    const dropped: string[] = [];

    let current = input.conversation;

    const r1 = await this.drop.apply({ ...input, conversation: current, strategy: 'drop' });
    ran.push('drop');
    dropped.push(...r1.droppedMessageIds);
    current = r1.conversation;

    if (totalTokens(current.messages) > input.targetTokens) {
      const r2 = await this.distill.apply({ ...input, conversation: current, strategy: 'distill' });
      ran.push('distill');
      dropped.push(...r2.droppedMessageIds);
      current = r2.conversation;
    }

    if (totalTokens(current.messages) > input.targetTokens) {
      const r3 = await this.summarize.apply({ ...input, conversation: current, strategy: 'summarize' });
      ran.push('summarize');
      dropped.push(...r3.droppedMessageIds);
      current = r3.conversation;
    }

    const outputTokens = totalTokens(current.messages);
    return {
      conversation: current,
      inputTokens, outputTokens,
      ratio: inputTokens === 0 ? 1 : outputTokens / inputTokens,
      preservedTier0Count: tier0Count,
      droppedMessageIds: dropped,
      summary: `chain: ${ran.join(' -> ')}`,
      strategyId: this.id,
      durationMs: Date.now() - started,
    };
  }
}
