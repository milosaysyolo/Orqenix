// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 OpenAI Adapter
// @gate G8.2, G12

import {
  type LlmAdapter, type LlmRequest, type LlmResponse,
  LlmAuthError, LlmProviderError, LlmRateLimitError, LlmTimeoutError, LlmRequestSchema,
} from '@orqenix/llm-adapter-ollama';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { message?: string };
}

export interface OpenAiAdapterOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  providerLabel?: string;
}

export class OpenAiAdapter implements LlmAdapter {
  readonly provider: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAiAdapterOptions) {
    if (!opts.apiKey) throw new Error('apiKey is required for OpenAiAdapter');
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'gpt-4o-mini';
    this.baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.provider = opts.providerLabel ?? 'openai';
  }

  async complete(rawReq: LlmRequest): Promise<LlmResponse> {
    const req = LlmRequestSchema.parse(rawReq);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const started = Date.now();

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: req.model ?? this.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1024,
          stop: req.stop,
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
      const data = (await res.json()) as OpenAiResponse;
      if (data.error) throw new LlmProviderError(this.provider, data.error.message ?? 'unknown');

      const choice = data.choices?.[0];
      const finish = choice?.finish_reason === 'length' ? 'length' : 'stop';
      return {
        content: choice?.message?.content ?? '',
        finishReason: finish,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
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
        method: 'GET', headers: { authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch { return false; }
  }
}
