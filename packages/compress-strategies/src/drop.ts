// SPDX-License-Identifier: Apache-2.0
// @bc CS-014 Drop Strategy
// @gate G15.1

import {
  type CompressInput,
  type CompressOutput,
  type CompressStrategy,
  type TaggedMessage,
  totalTokens,
  Tier0ViolationError,
} from "./contracts.js";

export class DropStrategy implements CompressStrategy {
  readonly id = "drop" as const;

  async apply(input: CompressInput): Promise<CompressOutput> {
    const started = Date.now();
    const all: TaggedMessage[] = [...input.conversation.messages];
    const inputTokens = totalTokens(all);
    const droppedIds: string[] = [];

    let kept = all;
    if (inputTokens > input.targetTokens) {
      const dropOrder = [4, 3, 2, 1] as const;
      for (const tier of dropOrder) {
        if (totalTokens(kept) <= input.targetTokens) break;
        const candidates = kept
          .filter((m) => m.tier === tier && !m.sticky)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (const c of candidates) {
          if (totalTokens(kept) <= input.targetTokens) break;
          if (c.tier === 0) throw new Tier0ViolationError(c.id);
          kept = kept.filter((m) => m.id !== c.id);
          droppedIds.push(c.id);
        }
      }
    }

    const tier0In = all.filter((m) => m.tier === 0).map((m) => m.id);
    const tier0Out = new Set(kept.filter((m) => m.tier === 0).map((m) => m.id));
    for (const id of tier0In) if (!tier0Out.has(id)) throw new Tier0ViolationError(id);

    const outputTokens = totalTokens(kept);
    return {
      conversation: { ...input.conversation, messages: kept },
      inputTokens,
      outputTokens,
      ratio: inputTokens === 0 ? 1 : outputTokens / inputTokens,
      preservedTier0Count: tier0In.length,
      droppedMessageIds: droppedIds,
      strategyId: this.id,
      durationMs: Date.now() - started,
    };
  }
}
