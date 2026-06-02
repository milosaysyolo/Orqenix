// SPDX-License-Identifier: Apache-2.0
// @bc CS-016 v2 Facade
// @gate G16.2, G16.3

import {
  type Conversation, type TaggedMessage, type PreservationTier,
  estimateTokens,
} from '@orqenix/compress-strategies';
import type { SmartCompressionEngine } from '@orqenix/smart-compression';
import type { V1Message } from './v1.js';

export interface V2Input {
  context: V1Message[];
  threshold: number;
  scopeId?: string;
  sessionId?: string;
}

export interface V2Output {
  context: V1Message[];
  compressed: boolean;
  metrics: {
    tokensIn: number;
    tokensOut: number;
    ratio: number;
    preservedTier0Count: number;
    strategyId: string;
    durationMs: number;
  };
  droppedMessageIds: string[];
  decisionReason: string;
}

export interface CreateV2PluginOptions {
  engine: SmartCompressionEngine;
  tagger?: (msg: V1Message, idx: number, all: V1Message[]) => PreservationTier;
}

function defaultTagger(msg: V1Message, idx: number, all: V1Message[]): PreservationTier {
  if (idx === 0 && msg.role === 'system') return 0;
  if (idx === all.length - 1 && msg.role === 'user') return 1;
  if (idx >= all.length - 4) return 2;
  return 3;
}

export function createV2Plugin(opts: CreateV2PluginOptions) {
  const tagger = opts.tagger ?? defaultTagger;
  return {
    async run(input: V2Input): Promise<V2Output> {
      const role = (r: string) =>
        (r === 'system' || r === 'user' || r === 'assistant' || r === 'tool') ? r : 'assistant';
      const tagged: TaggedMessage[] = input.context.map((m, i) => ({
        id: `v2:${i}:${m.role}`,
        role: role(m.role),
        content: m.content,
        tier: tagger(m, i, input.context),
        tokens: estimateTokens(m.content),
        createdAt: new Date(2026, 0, 1, 0, 0, 0, i).toISOString(),
      }));
      const conv: Conversation = {
        scopeId: input.scopeId ?? 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sessionId: input.sessionId,
        messages: tagged,
      };

      const cfg = opts.engine.getConfig();
      if (cfg.targetTokens !== input.threshold) {
        opts.engine.setConfig({
          targetTokens: input.threshold,
          maxTokens: Math.max(cfg.maxTokens, input.threshold * 3),
        });
      }

      const decision = opts.engine.getDecision(conv);
      const out = await opts.engine.compress(conv);
      const compressed = out.outputTokens < out.inputTokens;
      const restored: V1Message[] = out.conversation.messages.map((m) => ({ role: m.role, content: m.content }));

      return {
        context: restored,
        compressed,
        metrics: {
          tokensIn: out.inputTokens,
          tokensOut: out.outputTokens,
          ratio: out.ratio,
          preservedTier0Count: out.preservedTier0Count,
          strategyId: out.strategyId,
          durationMs: out.durationMs,
        },
        droppedMessageIds: out.droppedMessageIds,
        decisionReason: decision.reason,
      };
    },
  };
}
