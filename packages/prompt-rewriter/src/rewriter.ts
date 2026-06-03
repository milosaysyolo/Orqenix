// SPDX-License-Identifier: Apache-2.0
// @bc CS-011 Rewriter
// @gate G10.1, G10.2, G10.3

import type { ChatMessage, LlmAdapter } from '@orqenix/llm-adapter-ollama';
import type { MemoryId } from '@orqenix/memory-tiers';
import {
  DEFAULT_STRATEGY, STRATEGIES,
  type InjectionStrategy, type InjectionStrategyName,
} from '@orqenix/injection-strategies';
import { KeywordRecall } from './recall.js';

export interface PromptRewriterOptions {
  recall: KeywordRecall;
  strategyName?: InjectionStrategyName;
  adapter?: LlmAdapter;
  enableRewriteFn?: boolean;
}

export interface RewriteInput {
  messages: ChatMessage[];
  userQuery?: string;
  tokenBudget?: number;
  k?: number;
}

export interface RewriteOutput {
  messages: ChatMessage[];
  injectedMemoryIds: MemoryId[];
  strategy: InjectionStrategyName;
  tokensUsed: number;
  rewriteApplied: boolean;
}

export class PromptRewriter {
  private strategy: InjectionStrategy;
  private readonly recall: KeywordRecall;
  private readonly adapter?: LlmAdapter;
  private readonly enableRewriteFn: boolean;

  constructor(opts: PromptRewriterOptions) {
    this.recall = opts.recall;
    this.strategy = opts.strategyName ? STRATEGIES[opts.strategyName] : DEFAULT_STRATEGY;
    this.adapter = opts.adapter;
    this.enableRewriteFn = opts.enableRewriteFn ?? false;
  }

  setStrategy(name: InjectionStrategyName): void {
    this.strategy = STRATEGIES[name];
  }

  getStrategyName(): InjectionStrategyName {
    return this.strategy.name;
  }

  async rewrite(input: RewriteInput): Promise<RewriteOutput> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const userQuery = input.userQuery ?? lastUser?.content ?? '';
    const memories = userQuery ? this.recall.recall(userQuery, { k: input.k ?? 5 }) : [];
    const injected = this.strategy.apply({
      messages: input.messages, memories,
      tokenBudget: input.tokenBudget, k: input.k,
    });

    let messages = injected.messages;
    let rewriteApplied = false;
    if (this.enableRewriteFn && this.adapter && messages.length > 0) {
      try {
        const sys = messages.find((m) => m.role === 'system');
        if (sys && sys.content.length > 0) {
          const r = await this.adapter.complete({
            messages: [
              { role: 'system', content: 'Consolidate the following system prompt into one concise paragraph, preserving every fact, preference, and instruction. Output only the rewritten prompt.' },
              { role: 'user', content: sys.content },
            ],
            temperature: 0.2,
            maxTokens: 1024,
          });
          if (r.content.trim().length > 0) {
            messages = messages.map((m) => (m.role === 'system' ? { role: 'system', content: r.content.trim() } : m));
            rewriteApplied = true;
          }
        }
      } catch { /* graceful: keep original */ }
    }

    return {
      messages,
      injectedMemoryIds: injected.injectedMemoryIds,
      strategy: injected.strategy,
      tokensUsed: injected.tokensUsed,
      rewriteApplied,
    };
  }
}
