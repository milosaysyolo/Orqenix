// SPDX-License-Identifier: Apache-2.0
// @bc CS-015 Strategy Selector
// @gate G15.5

import type { Conversation } from '@orqenix/compress-strategies';
import { totalTokens } from '@orqenix/compress-strategies';
import type { EngineDecision, SmartCompressionConfig } from './contracts.js';

export function selectStrategy(conv: Conversation, cfg: SmartCompressionConfig): EngineDecision {
  if (cfg.selectionPolicy === 'fixed') {
    return { strategyId: cfg.defaultStrategy, reason: `fixed policy -> ${cfg.defaultStrategy}`, overflowAccepted: false };
  }
  const total = totalTokens(conv.messages);
  if (total <= cfg.targetTokens) {
    return { strategyId: 'drop', reason: 'already under target', overflowAccepted: false };
  }
  const ratio = total / cfg.targetTokens;
  if (ratio <= 1.2) return { strategyId: 'drop', reason: `over by ${ratio.toFixed(2)}x -> drop`, overflowAccepted: false };
  if (ratio <= 2.0) return { strategyId: 'distill', reason: `over by ${ratio.toFixed(2)}x -> distill`, overflowAccepted: false };
  return { strategyId: 'compress-chain', reason: `over by ${ratio.toFixed(2)}x -> chain`, overflowAccepted: false };
}
