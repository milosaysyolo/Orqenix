// SPDX-License-Identifier: Apache-2.0
// @bc CS-014 Summarize Strategy
// @gate G15.2

import type { LlmAdapter } from '@orqenix/llm-adapter-ollama';
import {
  type CompressInput, type CompressOutput, type CompressStrategy,
  type TaggedMessage, type PreservationTier,
  estimateTokens, totalTokens, Tier0ViolationError,
} from './contracts.js';

const SUMMARIZE_MIN_RUN = 3;
const SUMMARIZE_LOCAL_BUDGET = 400;

function findRuns(messages: TaggedMessage[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < messages.length) {
    if (messages[i]!.tier >= 2 && messages[i]!.tier <= 4 && !messages[i]!.sticky) {
      const start = i;
      while (
        i < messages.length &&
        messages[i]!.tier >= 2 && messages[i]!.tier <= 4 &&
        !messages[i]!.sticky
      ) i++;
      const end = i - 1;
      if (end - start + 1 >= SUMMARIZE_MIN_RUN) runs.push({ start, end });
    } else {
      i++;
    }
  }
  return runs;
}

function localSummary(messages: TaggedMessage[]): string {
  const parts = messages.map((m) => `[${m.role}] ${m.content.slice(0, 200)}`);
  let out = `Summary of ${messages.length} messages:\n` + parts.join('\n');
  while (estimateTokens(out) > SUMMARIZE_LOCAL_BUDGET && out.length > 100) {
    out = out.slice(0, Math.floor(out.length * 0.9));
  }
  return out;
}

export interface SummarizeStrategyOptions {
  adapter?: LlmAdapter;
  localFallback?: boolean;
}

export class SummarizeStrategy implements CompressStrategy {
  readonly id = 'summarize' as const;
  private readonly adapter?: LlmAdapter;
  private readonly localFallback: boolean;

  constructor(opts: SummarizeStrategyOptions = {}) {
    this.adapter = opts.adapter;
    this.localFallback = opts.localFallback ?? true;
  }

  async apply(input: CompressInput): Promise<CompressOutput> {
    const started = Date.now();
    const all: TaggedMessage[] = [...input.conversation.messages];
    const inputTokens = totalTokens(all);
    const tier0Set = new Set(all.filter((m) => m.tier === 0).map((m) => m.id));

    const runs = findRuns(all);
    const droppedIds: string[] = [];
    let result: TaggedMessage[] = [...all];
    let summaryText: string | undefined;

    for (let r = runs.length - 1; r >= 0; r--) {
      if (totalTokens(result) <= input.targetTokens) break;
      const run = runs[r]!;
      const runMsgs = all.slice(run.start, run.end + 1);
      if (runMsgs.some((m) => m.tier === 0)) throw new Tier0ViolationError(runMsgs.find((m) => m.tier === 0)!.id);

      let summary = '';
      if (this.adapter) {
        try {
          const r2 = await this.adapter.complete({
            messages: [
              { role: 'system', content: 'Summarize the following conversation fragment into one tight paragraph preserving every fact, decision, and instruction. Output only the summary.' },
              { role: 'user', content: runMsgs.map((m) => `[${m.role}] ${m.content}`).join('\n') },
            ],
            temperature: 0.2, maxTokens: 600,
          });
          summary = r2.content.trim();
        } catch {
          summary = this.localFallback ? localSummary(runMsgs) : '';
        }
      } else {
        summary = this.localFallback ? localSummary(runMsgs) : '';
      }
      if (!summary) continue;

      const maxTierInRun = Math.max(...runMsgs.map((m) => m.tier)) as PreservationTier;
      const summarized: TaggedMessage = {
        id: `sum:${runMsgs[0]!.id}-${runMsgs[runMsgs.length - 1]!.id}`,
        role: 'assistant',
        content: summary,
        tier: maxTierInRun,
        tokens: estimateTokens(summary),
        createdAt: runMsgs[runMsgs.length - 1]!.createdAt,
      };
      summaryText = summary;
      droppedIds.push(...runMsgs.map((m) => m.id));
      result.splice(run.start, run.end - run.start + 1, summarized);
    }

    for (const id of tier0Set) {
      if (!result.find((m) => m.id === id)) throw new Tier0ViolationError(id);
    }

    const outputTokens = totalTokens(result);
    return {
      conversation: { ...input.conversation, messages: result },
      inputTokens, outputTokens,
      ratio: inputTokens === 0 ? 1 : outputTokens / inputTokens,
      preservedTier0Count: tier0Set.size,
      droppedMessageIds: droppedIds,
      summary: summaryText,
      strategyId: this.id,
      durationMs: Date.now() - started,
    };
  }
}
