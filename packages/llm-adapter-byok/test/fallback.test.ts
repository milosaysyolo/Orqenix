// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { FallbackChain } from '../src';
import {
  type LlmAdapter, type LlmRequest, type LlmResponse,
  LlmProviderError, LlmRateLimitError,
} from '@orqenix/llm-adapter-ollama';

function adapter(name: string, behavior: 'ok' | 'fail' | 'rate'): LlmAdapter {
  return {
    provider: name,
    model: 'mock',
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      if (behavior === 'fail') throw new LlmProviderError(name, 'down');
      if (behavior === 'rate') throw new LlmRateLimitError(name);
      return { content: name, finishReason: 'stop', tokensIn: 0, tokensOut: 0, model: 'mock', provider: name, latencyMs: 1 };
    },
    async isHealthy() { return behavior === 'ok'; },
  };
}

describe('FallbackChain', () => {
  it('uses first healthy adapter', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'ok'), adapter('b', 'ok')] });
    const r = await c.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(r.content).toBe('a');
  });

  it('falls through on provider error', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'fail'), adapter('b', 'ok')] });
    const r = await c.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(r.content).toBe('b');
  });

  it('falls through on rate limit', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'rate'), adapter('b', 'ok')] });
    const r = await c.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(r.content).toBe('b');
  });

  it('throws aggregated error when all fail', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'fail'), adapter('b', 'fail')] });
    await expect(c.complete({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(/all 2 adapters failed/);
  });

  it('isHealthy true if any healthy', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'fail'), adapter('b', 'ok')] });
    expect(await c.isHealthy()).toBe(true);
  });

  it('isHealthy false if all unhealthy', async () => {
    const c = new FallbackChain({ adapters: [adapter('a', 'fail'), adapter('b', 'fail')] });
    expect(await c.isHealthy()).toBe(false);
  });

  it('rejects empty adapter array', () => {
    expect(() => new FallbackChain({ adapters: [] })).toThrow();
  });
});
