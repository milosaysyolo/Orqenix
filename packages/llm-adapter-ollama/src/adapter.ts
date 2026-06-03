// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 Ollama Adapter
// @gate G8.1, G13.1

import {
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
  LlmProviderError,
  LlmTimeoutError,
  LlmRequestSchema,
} from "./contracts.js";

interface OllamaChatResponse {
  message?: { content?: string };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaAdapterOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class OllamaAdapter implements LlmAdapter {
  readonly provider = "ollama";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaAdapterOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = opts.model ?? "qwen2.5:7b";
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(rawReq: LlmRequest): Promise<LlmResponse> {
    const req = LlmRequestSchema.parse(rawReq);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const started = Date.now();

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: req.model ?? this.model,
          messages: req.messages,
          stream: false,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: req.maxTokens ?? 1024,
            stop: req.stop,
          },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        throw new LlmProviderError(this.provider, `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as OllamaChatResponse;
      const content = data.message?.content ?? "";
      const latencyMs = Date.now() - started;
      const estimate = (s: string) => Math.max(1, Math.ceil(s.length / 4));

      return {
        content,
        finishReason: data.done_reason === "length" ? "length" : "stop",
        tokensIn: data.prompt_eval_count ?? estimate(req.messages.map((m) => m.content).join("\n")),
        tokensOut: data.eval_count ?? estimate(content),
        model: req.model ?? this.model,
        provider: this.provider,
        latencyMs,
      };
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") throw new LlmTimeoutError(this.timeoutMs);
      if (e instanceof LlmProviderError) throw e;
      throw new LlmProviderError(this.provider, (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
