// SPDX-License-Identifier: Apache-2.0
// @bc CS-014 Compress Strategy Contracts
// @gate G15, G16

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const PRESERVATION_TIERS = [0, 1, 2, 3, 4] as const;
export type PreservationTier = (typeof PRESERVATION_TIERS)[number];

export const TaggedMessageSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(0).max(64 * 1024),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  tokens: z.number().int().nonnegative(),
  createdAt: z.string(),
  sticky: z.boolean().optional(),
}).strict();
export type TaggedMessage = z.infer<typeof TaggedMessageSchema>;

export const ConversationSchema = z.object({
  messages: z.array(TaggedMessageSchema).min(1).max(10_000),
  scopeId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
}).strict();
export type Conversation = z.infer<typeof ConversationSchema>;

export const COMPRESS_STRATEGY_IDS = ['drop', 'summarize', 'distill', 'compress-chain'] as const;
export type CompressStrategyId = (typeof COMPRESS_STRATEGY_IDS)[number];

export interface CompressInput {
  conversation: Conversation;
  targetTokens: number;
  maxTokens: number;
  strategy: CompressStrategyId;
}

export interface CompressOutput {
  conversation: Conversation;
  inputTokens: number;
  outputTokens: number;
  ratio: number;
  preservedTier0Count: number;
  droppedMessageIds: string[];
  summary?: string;
  strategyId: CompressStrategyId;
  durationMs: number;
}

export interface CompressStrategy {
  readonly id: CompressStrategyId;
  apply(input: CompressInput): Promise<CompressOutput>;
}

export class CompressionError extends OrqenixError {
  constructor(reason: string) { super(`compression error: ${reason}`, 'COMPRESSION'); }
}
export class Tier0ViolationError extends OrqenixError {
  constructor(messageId: string) { super(`tier-0 message ${messageId} cannot be dropped or summarized`, 'TIER0_VIOLATION'); }
}

export function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

export function totalTokens(messages: TaggedMessage[]): number {
  return messages.reduce((sum, m) => sum + m.tokens, 0);
}
