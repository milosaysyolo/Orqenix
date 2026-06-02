// SPDX-License-Identifier: Apache-2.0
// @bc CS-015 Smart Compression Contracts
// @gate G14, G15, G16

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { COMPRESS_STRATEGY_IDS, type CompressStrategyId } from '@orqenix/compress-strategies';

export const SmartCompressionConfigSchema = z.object({
  targetTokens: z.number().int().positive().max(1_000_000),
  maxTokens: z.number().int().positive().max(1_000_000),
  overflowCapPercent: z.number().min(100).max(150).default(105),
  selectionPolicy: z.enum(['auto', 'fixed']).default('auto'),
  defaultStrategy: z.enum(COMPRESS_STRATEGY_IDS).default('compress-chain'),
  minCompressionRatio: z.number().min(0.01).max(1).default(0.95),
}).strict().refine((c) => c.maxTokens >= c.targetTokens, {
  message: 'maxTokens must be >= targetTokens',
});
export type SmartCompressionConfig = z.infer<typeof SmartCompressionConfigSchema>;

export interface EngineDecision {
  strategyId: CompressStrategyId;
  reason: string;
  overflowAccepted: boolean;
}

export class OverflowError extends OrqenixError {
  constructor(outputTokens: number, capTokens: number) {
    super(`compression overflow: ${outputTokens} tokens exceeds 105% cap of ${capTokens}`, 'COMPRESS_OVERFLOW');
  }
}
