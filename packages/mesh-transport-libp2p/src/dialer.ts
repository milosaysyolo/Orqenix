import { multiaddr } from "@multiformats/multiaddr";
import type { Connection, Libp2p, PeerId } from "@libp2p/interface";

export interface DialBackoff {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  rand?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface DialerOptions {
  backoff?: DialBackoff;
  maxConcurrentPerPeer?: number;
}

export class Dialer {
  private inFlight = new Map<string, Promise<Connection>>();
  private readonly backoff: Required<DialBackoff>;
  private readonly maxConcurrentPerPeer: number;

  constructor(opts: DialerOptions = {}) {
    this.backoff = {
      maxAttempts: opts.backoff?.maxAttempts ?? 3,
      baseDelayMs: opts.backoff?.baseDelayMs ?? 200,
      maxDelayMs: opts.backoff?.maxDelayMs ?? 5_000,
      rand: opts.backoff?.rand ?? Math.random,
      sleep: opts.backoff?.sleep ?? ((ms) => new Promise((res) => setTimeout(res, ms))),
    };
    this.maxConcurrentPerPeer = opts.maxConcurrentPerPeer ?? 1;
  }

  async dial(
    node: Libp2p,
    target: string,
    opts: { deadlineMs: number; signal?: AbortSignal },
  ): Promise<Connection> {
    const addr = multiaddr(target);
    const peerId = addr.getPeerId();
    const key = peerId ?? target;

    if (this.maxConcurrentPerPeer === 1) {
      const existing = this.inFlight.get(key);
      if (existing) return existing;
    }

    const promise = this.runWithBackoff(node, addr.toString(), peerId, opts);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async runWithBackoff(
    node: Libp2p,
    target: string,
    _peerId: string | null,
    opts: { deadlineMs: number; signal?: AbortSignal },
  ): Promise<Connection> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.backoff.maxAttempts; attempt++) {
      if (opts.signal?.aborted) throw new Error("dial aborted");
      if (Date.now() >= opts.deadlineMs) throw new Error("dial deadline exceeded");

      try {
        const remaining = Math.max(0, opts.deadlineMs - Date.now());
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), remaining);
        if (opts.signal) {
          if (opts.signal.aborted) ac.abort();
          else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
        }
        try {
          return await node.dial(multiaddr(target), { signal: ac.signal });
        } finally {
          clearTimeout(t);
        }
      } catch (e) {
        lastErr = e;
      }

      if (attempt === this.backoff.maxAttempts - 1) break;

      const expo = this.backoff.baseDelayMs * Math.pow(2, attempt);
      const jitter = 0.5 + this.backoff.rand();
      const delay = Math.min(this.backoff.maxDelayMs, Math.floor(expo * jitter));
      const remaining = opts.deadlineMs - Date.now();
      if (remaining <= 0) break;
      await this.backoff.sleep(Math.min(delay, Math.max(0, remaining)));
    }
    throw lastErr ?? new Error("dial failed");
  }

  pendingCount(): number {
    return this.inFlight.size;
  }
}
