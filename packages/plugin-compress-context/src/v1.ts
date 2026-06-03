// SPDX-License-Identifier: Apache-2.0
// @bc CS-016 Phase 4 v1 Compat
// @gate G16.1
//
// NOTE: This file preserves the exact Phase 4 v1 public surface so the
// contract snapshot test in tests/integration/phase4-contract-snapshot.test.ts
// continues to pass. DO NOT modify shapes here without bumping G16 explicitly.

import { z } from 'zod';

export const ConfigSchema = z.object({
  threshold: z.number().int().nonnegative().default(1000),
  targetRatio: z.number().min(0.05).max(1).default(0.5),
}).strict();
export type Config = z.infer<typeof ConfigSchema>;

export interface V1Message { role: string; content: string }
export interface V1Input { context: V1Message[]; threshold: number }
export interface V1Output {
  context: V1Message[];
  compressed: boolean;
  metrics: { tokensIn: number; tokensOut: number };
}

function estimateTokens(s: string): number { return Math.max(1, Math.ceil(s.length / 4)); }

function totalTokens(ms: V1Message[]): number {
  return ms.reduce((a, m) => a + estimateTokens(m.content), 0);
}

export const plugin = {
  async run(input: V1Input): Promise<V1Output> {
    const tokensIn = totalTokens(input.context);
    if (tokensIn <= input.threshold) {
      return { context: input.context, compressed: false, metrics: { tokensIn, tokensOut: tokensIn } };
    }
    const kept: V1Message[] = [...input.context];
    while (kept.length > 1 && totalTokens(kept) > input.threshold) kept.shift();
    return {
      context: kept,
      compressed: true,
      metrics: { tokensIn, tokensOut: totalTokens(kept) },
    };
  },
};

export default plugin;
