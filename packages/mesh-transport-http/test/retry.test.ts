// packages/mesh-transport-http/test/retry.test.ts
import { describe, it, expect } from "vitest";
import { runWithRetry, type AttemptResult } from "../src/retry.js";
import type { MeshResponse } from "@orqenix/mesh-transport-core";

describe("runWithRetry", () => {
  it("retries on timeout up to maxRetries", async () => {
    let calls = 0;
    const resp = await runWithRetry(
      async (): Promise<AttemptResult> => {
        calls++;
        return { kind: "timeout" };
      },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        deadlineMs: Date.now() + 1000,
        rand: () => 0.5,
        sleep: async () => {},
      },
    );
    expect(calls).toBe(3); // initial + 2 retries
    expect(resp.status).toBe("timeout");
  });

  it("never retries denied", async () => {
    let calls = 0;
    const denied: MeshResponse = {
      id: "x",
      status: "denied",
      error: { code: "E_CAP_MISSING", message: "no cap" },
    };
    const resp = await runWithRetry(
      async (): Promise<AttemptResult> => {
        calls++;
        return { kind: "fatal", resp: denied };
      },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        deadlineMs: Date.now() + 1000,
        rand: () => 0.5,
        sleep: async () => {},
      },
    );
    expect(calls).toBe(1);
    expect(resp.status).toBe("denied");
  });

  it("respects deadline", async () => {
    const resp = await runWithRetry(async (): Promise<AttemptResult> => ({ kind: "timeout" }), {
      maxRetries: 5,
      baseDelayMs: 1,
      deadlineMs: Date.now() - 1,
      rand: () => 0.5,
      sleep: async () => {},
    });
    expect(resp.status).toBe("timeout");
  });

  it("aborts early on signal", async () => {
    const ac = new AbortController();
    ac.abort();
    const resp = await runWithRetry(async (): Promise<AttemptResult> => ({ kind: "timeout" }), {
      maxRetries: 5,
      baseDelayMs: 1000,
      deadlineMs: Date.now() + 10000,
      signal: ac.signal,
      rand: () => 0.5,
      sleep: async () => {},
    });
    expect(resp.status).toBe("timeout");
  });

  it("stops retrying after ok response", async () => {
    let calls = 0;
    const resp = await runWithRetry(
      async (): Promise<AttemptResult> => {
        calls++;
        return { kind: "response", resp: { id: "x", status: "ok" } };
      },
      {
        maxRetries: 5,
        baseDelayMs: 1,
        deadlineMs: Date.now() + 1000,
        rand: () => 0.5,
        sleep: async () => {},
      },
    );
    expect(calls).toBe(1);
    expect(resp.status).toBe("ok");
  });

  it("shouldRetry returns true for timeout and error", async () => {
    const { shouldRetry } = await import("../src/retry.js");
    expect(shouldRetry("timeout")).toBe(true);
    expect(shouldRetry("error")).toBe(true);
    expect(shouldRetry("ok")).toBe(false);
    expect(shouldRetry("denied")).toBe(false);
  });
});
