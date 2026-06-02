// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 LLM Adapter Contracts
// @gate G8

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const RoleEnum = z.enum(['system', 'user', 'assistant']);
export type Role = z.infer<typeof RoleEnum>;

export const ChatMessageSchema = z.object({
  role: RoleEnum,
  content: z.string().min(0).max(64 * 1024),
}).strict();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const LlmRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(200),
  model: z.string().min(1).max(128).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32_000).optional(),
  stop: z.array(z.string().min(1).max(64)).max(8).optional(),
}).strict();
export type LlmRequest = z.infer<typeof LlmRequestSchema>;

export interface LlmResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface LlmAdapter {
  readonly provider: string;
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
  isHealthy(): Promise<boolean>;
}

export class LlmTimeoutError extends OrqenixError {
  constructor(timeoutMs: number) { super(`LLM request timed out after ${timeoutMs}ms`, 'LLM_TIMEOUT'); }
}
export class LlmProviderError extends OrqenixError {
  constructor(provider: string, reason: string) { super(`${provider} provider error: ${reason}`, 'LLM_PROVIDER'); }
}
export class LlmAuthError extends OrqenixError {
  constructor(provider: string) { super(`${provider} authentication failed (check API key)`, 'LLM_AUTH'); }
}
export class LlmRateLimitError extends OrqenixError {
  constructor(provider: string, retryAfterMs?: number) {
    super(`${provider} rate-limited` + (retryAfterMs ? ` retry after ${retryAfterMs}ms` : ''), 'LLM_RATE_LIMIT');
  }
}
