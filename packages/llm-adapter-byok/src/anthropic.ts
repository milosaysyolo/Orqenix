// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 Anthropic Adapter
// @gate G8.3, G12

import {
  type LlmAdapter, type LlmRequest, type LlmResponse,
  LlmAuthError, LlmProviderError, LlmRateLimitError, LlmTimeoutError, LlmRequestSchema,
} from '@orqenix/llm-adapter-ollama';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  error?: { message?: string };
}

export interface AnthropicAdapterOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class AnthropicAdapter implements LlmAdapter {
  readonly provider = 'anthropic';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicAdapterOptions) {
    if (!opts.apiKey) throw new Error('apiKey is required for AnthropicAdapter');
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'claude-haiku-4';
    this.baseUrl = (opts.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(rawReq: LlmRequest): Promise<LlmResponse> {
    const req = LlmRequestSchema.parse(rawReq);
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const restMessages = req.messages.filter((m) => m.role !== 'system');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const started = Date.now();

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: req.model ?? this.model,
          system: systemMsg?.content,
          messages: restMessages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1024,
          stop_sequences: req.stop,
        }),
        signal: ctrl.signal,
      });

      if (res.status === 401) throw new LlmAuthError(this.provider);
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10);
        throw new LlmRateLimitError(this.provider, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '<no body>');
        throw new LlmProviderError(this.provider, `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as AnthropicResponse;
      if (data.error) throw new LlmProviderError(this.provider, data.error.message ?? 'unknown');
      const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const finish = data.stop_reason === 'max_tokens' ? 'length' : 'stop';
      return {
        content: text,
        finishReason: finish,
        tokensIn: data.usage?.input_tokens ?? 0,
        tokensOut: data.usage?.output_tokens ?? 0,
        model: data.model ?? req.model ?? this.model,
        provider: this.provider,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw new LlmTimeoutError(this.timeoutMs);
      if (e instanceof LlmAuthError || e instanceof LlmRateLimitError || e instanceof LlmProviderError) throw e;
      throw new LlmProviderError(this.provider, (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: 'GET', headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      });
      return res.ok;
    } catch { return false; }
  }
}
