// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { OllamaAdapter, LlmProviderError, LlmTimeoutError } from "../src";

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

describe("OllamaAdapter", () => {
  it("completes a chat request", async () => {
    const a = new OllamaAdapter({
      fetchImpl: mockFetch(
        async () =>
          new Response(
            JSON.stringify({
              message: { content: "hello back" },
              done_reason: "stop",
              prompt_eval_count: 12,
              eval_count: 4,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });
    const r = await a.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(r.content).toBe("hello back");
    expect(r.finishReason).toBe("stop");
    expect(r.tokensIn).toBe(12);
    expect(r.tokensOut).toBe(4);
    expect(r.provider).toBe("ollama");
  });

  it("estimates tokens when Ollama omits counts", async () => {
    const a = new OllamaAdapter({
      fetchImpl: mockFetch(
        async () =>
          new Response(
            JSON.stringify({
              message: { content: "aaaaaaaa" },
              done_reason: "stop",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    });
    const r = await a.complete({ messages: [{ role: "user", content: "abcdefgh" }] });
    expect(r.tokensIn).toBeGreaterThan(0);
    expect(r.tokensOut).toBeGreaterThan(0);
  });

  it("maps non-200 to LlmProviderError", async () => {
    const a = new OllamaAdapter({
      fetchImpl: mockFetch(async () => new Response("server down", { status: 500 })),
    });
    await expect(a.complete({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      LlmProviderError,
    );
  });

  it("maps AbortError to LlmTimeoutError", async () => {
    const a = new OllamaAdapter({
      timeoutMs: 10,
      fetchImpl: mockFetch(
        () =>
          new Promise<Response>((_, rej) => {
            setTimeout(() => rej(Object.assign(new Error("aborted"), { name: "AbortError" })), 30);
          }),
      ),
    });
    await expect(a.complete({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      LlmTimeoutError,
    );
  });

  it("isHealthy returns true on 200", async () => {
    const a = new OllamaAdapter({
      fetchImpl: mockFetch(async () => new Response("{}", { status: 200 })),
    });
    expect(await a.isHealthy()).toBe(true);
  });

  it("isHealthy returns false on network error", async () => {
    const a = new OllamaAdapter({
      fetchImpl: mockFetch(async () => {
        throw new Error("econnrefused");
      }),
    });
    expect(await a.isHealthy()).toBe(false);
  });
});
