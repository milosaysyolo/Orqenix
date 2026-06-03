// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 Google (Gemini) Adapter
// @gate G8.4, G12

import {
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
  LlmAuthError,
  LlmProviderError,
  LlmRateLimitError,
  LlmTimeoutError,
  LlmRequestSchema,
} from "@orqenix/llm-adapter-ollama";

interface GoogleResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; code?: number };
}

export interface GoogleAdapterOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class GoogleAdapter implements LlmAdapter {
  readonly provider = "google";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GoogleAdapterOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required for GoogleAdapter");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "gemini-flash-2.5";
    this.baseUrl = (opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(
      /\/$/,
      "",
    );
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(rawReq: LlmRequest): Promise<LlmResponse> {
    const req = LlmRequestSchema.parse(rawReq);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const started = Date.now();
    const model = req.model ?? this.model;

    const systemMsg = req.messages.find((m) => m.role === "system");
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    try {
      const res = await this.fetchImpl(
        `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
            generationConfig: {
              temperature: req.temperature ?? 0.7,
              maxOutputTokens: req.maxTokens ?? 1024,
              stopSequences: req.stop,
            },
          }),
          signal: ctrl.signal,
        },
      );

      if (res.status === 401 || res.status === 403) throw new LlmAuthError(this.provider);
      if (res.status === 429) throw new LlmRateLimitError(this.provider);
      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        throw new LlmProviderError(this.provider, `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as GoogleResponse;
      if (data.error) throw new LlmProviderError(this.provider, data.error.message ?? "unknown");
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      const finish = cand?.finishReason === "MAX_TOKENS" ? "length" : "stop";
      return {
        content: text,
        finishReason: finish,
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
        model,
        provider: this.provider,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") throw new LlmTimeoutError(this.timeoutMs);
      if (
        e instanceof LlmAuthError ||
        e instanceof LlmRateLimitError ||
        e instanceof LlmProviderError
      )
        throw e;
      throw new LlmProviderError(this.provider, (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(
        `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`,
        { method: "GET" },
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
