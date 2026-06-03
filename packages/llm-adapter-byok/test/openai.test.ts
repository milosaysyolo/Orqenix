// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { OpenAiAdapter } from "../src";
import { LlmAuthError, LlmRateLimitError, LlmProviderError } from "@orqenix/llm-adapter-ollama";

const mockFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) =>
  fn as unknown as typeof fetch;

describe("OpenAiAdapter", () => {
  it("completes with usage", async () => {
    const a = new OpenAiAdapter({
      apiKey: "sk-test",
      fetchImpl: mockFetch(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 10, completion_tokens: 2 },
              model: "gpt-4o-mini",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });
    const r = await a.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(r.tokensIn).toBe(10);
    expect(r.tokensOut).toBe(2);
    expect(r.provider).toBe("openai");
  });

  it("maps 401 to LlmAuthError", async () => {
    const a = new OpenAiAdapter({
      apiKey: "bad",
      fetchImpl: mockFetch(async () => new Response("{}", { status: 401 })),
    });
    await expect(a.complete({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      LlmAuthError,
    );
  });

  it("maps 429 to LlmRateLimitError", async () => {
    const a = new OpenAiAdapter({
      apiKey: "k",
      fetchImpl: mockFetch(
        async () => new Response("{}", { status: 429, headers: { "retry-after": "5" } }),
      ),
    });
    await expect(a.complete({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      LlmRateLimitError,
    );
  });

  it("throws if apiKey missing", () => {
    expect(() => new OpenAiAdapter({ apiKey: "" } as any)).toThrow();
  });
});
