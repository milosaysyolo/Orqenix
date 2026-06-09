// packages/mesh-transport-http/src/retry.ts
/**
 * Bounded retry helper for the HTTP client.
 * Agent note: max 2 retries, expo backoff base 100ms jitter [0.5x,1.5x];
 * retry on timeout/error; never retry denied; honor Retry-After; stop at deadline.
 */
import type { MeshResponse, MeshStatus } from '@orqenix/mesh-transport-core';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  deadlineMs: number;
  signal?: AbortSignal;
  rand?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type AttemptResult =
  | { kind: 'response'; resp: MeshResponse }
  | { kind: 'retry'; retryAfterMs?: number }
  | { kind: 'timeout' }
  | { kind: 'fatal'; resp: MeshResponse };

export function shouldRetry(status: MeshStatus): boolean {
  return status === 'timeout' || status === 'error';
}

export async function runWithRetry(
  attempt: (attemptIndex: number) => Promise<AttemptResult>,
  opts: RetryOptions,
): Promise<MeshResponse> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 100;
  const rand = opts.rand ?? Math.random;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((res) => setTimeout(res, ms)));
  let lastResp: MeshResponse | undefined;

  for (let i = 0; i <= maxRetries; i++) {
    if (opts.signal?.aborted) return { id: '', status: 'timeout' };
    if (Date.now() >= opts.deadlineMs) return lastResp ?? { id: '', status: 'timeout' };

    const result = await attempt(i);

    if (result.kind === 'response') {
      lastResp = result.resp;
      if (result.resp.status === 'ok' || result.resp.status === 'denied') return result.resp;
      if (!shouldRetry(result.resp.status)) return result.resp;
    } else if (result.kind === 'fatal') {
      return result.resp;
    } else if (result.kind === 'timeout') {
      lastResp = { id: '', status: 'timeout' };
    }

    if (i === maxRetries) break;

    const explicit = result.kind === 'retry' ? result.retryAfterMs : undefined;
    const expo = baseDelayMs * Math.pow(2, i);
    const jitter = 0.5 + rand();
    const computed = Math.floor(expo * jitter);
    const delay = explicit ?? computed;

    const remaining = opts.deadlineMs - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(delay, Math.max(0, remaining)));
  }
  return lastResp ?? { id: '', status: 'timeout' };
}
