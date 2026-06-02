// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 Fallback Chain
// @gate G12.1, G12.2

import {
  type LlmAdapter, type LlmRequest, type LlmResponse,
  LlmProviderError, LlmRateLimitError, LlmTimeoutError, LlmAuthError,
} from '@orqenix/llm-adapter-ollama';

export interface FallbackChainOptions {
  adapters: LlmAdapter[];
  retryOnRateLimit?: boolean;
}

export class FallbackChain implements LlmAdapter {
  readonly provider: string;
  readonly model: string;
  private readonly adapters: LlmAdapter[];

  constructor(opts: FallbackChainOptions) {
    if (opts.adapters.length === 0) throw new Error('FallbackChain requires at least one adapter');
    this.adapters = opts.adapters;
    this.provider = `chain(${opts.adapters.map((a) => a.provider).join(',')})`;
    this.model = opts.adapters[0]!.model;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const errors: Array<{ provider: string; error: string }> = [];
    for (const a of this.adapters) {
      try {
        return await a.complete(req);
      } catch (e) {
        const recoverable =
          e instanceof LlmAuthError ||
          e instanceof LlmProviderError ||
          e instanceof LlmTimeoutError ||
          e instanceof LlmRateLimitError;
        if (!recoverable) throw e;
        errors.push({ provider: a.provider, error: (e as Error).message });
        continue;
      }
    }
    throw new LlmProviderError(
      this.provider,
      `all ${this.adapters.length} adapters failed: ${errors.map((x) => `${x.provider}:${x.error}`).join(' | ')}`,
    );
  }

  async isHealthy(): Promise<boolean> {
    for (const a of this.adapters) {
      if (await a.isHealthy()) return true;
    }
    return false;
  }
}
