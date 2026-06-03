// SPDX-License-Identifier: Apache-2.0
// @bc CS-010 Injection Strategy Contracts
// @gate G9

import { z } from "zod";
import { OrqenixError } from "@orqenix/core";
import type { ChatMessage } from "@orqenix/llm-adapter-ollama";
import type { MemoryEntry, MemoryId } from "@orqenix/memory-tiers";

export const STRATEGY_NAMES = ["A", "B", "C", "D", "E"] as const;
export type InjectionStrategyName = (typeof STRATEGY_NAMES)[number];

export const InjectionInputSchema = z
  .object({
    messages: z.array(
      z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }),
    ),
    memories: z.array(z.any()),
    tokenBudget: z.number().int().positive().max(32_000).default(2048),
    k: z.number().int().positive().max(50).default(5),
  })
  .strict();
export type InjectionInput = {
  messages: ChatMessage[];
  memories: MemoryEntry[];
  tokenBudget?: number;
  k?: number;
};

export interface InjectionOutput {
  messages: ChatMessage[];
  injectedMemoryIds: MemoryId[];
  tokensUsed: number;
  strategy: InjectionStrategyName;
}

export interface InjectionStrategy {
  readonly name: InjectionStrategyName;
  apply(input: InjectionInput): InjectionOutput;
}

export class InjectionError extends OrqenixError {
  constructor(reason: string) {
    super(`injection error: ${reason}`, "INJECTION");
  }
}

export function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}
