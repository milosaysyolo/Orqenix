import type { Connection, Libp2p } from "@libp2p/interface";

export interface ConnectionManagerOptions {
  idleTimeoutMs?: number;
  stopGracePeriodMs?: number;
  tickIntervalMs?: number;
  now?: () => number;
}

interface ConnState {
  lastActivityAt: number;
}

type EventHandler = (evt: CustomEvent<Connection>) => void;

export class ConnectionManager {
  private readonly idleTimeoutMs: number;
  private readonly stopGracePeriodMs: number;
  private readonly tickIntervalMs: number;
  private readonly now: () => number;
  private node?: Libp2p;
  private timer?: ReturnType<typeof setInterval>;
  private connStates = new WeakMap<Connection, ConnState>();
  private connSet = new Set<Connection>();
  private listenersInstalled = false;
  private boundOnConnect?: EventHandler;
  private boundOnDisconnect?: EventHandler;

  constructor(opts: ConnectionManagerOptions = {}) {
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 300_000;
    this.stopGracePeriodMs = opts.stopGracePeriodMs ?? 1_000;
    this.tickIntervalMs = opts.tickIntervalMs ?? Math.min(this.idleTimeoutMs / 5, 30_000);
    this.now = opts.now ?? Date.now;
  }

  attach(node: Libp2p): void {
    this.node = node;
    if (this.listenersInstalled) return;
    this.boundOnConnect = (evt) => {
      const conn = evt.detail;
      this.connSet.add(conn);
      this.touch(conn);
    };
    this.boundOnDisconnect = (evt) => {
      const conn = evt.detail;
      this.connSet.delete(conn);
      this.connStates.delete(conn);
    };
    node.addEventListener(
      "connection:open",
      this.boundOnConnect as (evt: CustomEvent<Connection>) => void,
    );
    node.addEventListener(
      "connection:close",
      this.boundOnDisconnect as (evt: CustomEvent<Connection>) => void,
    );
    this.listenersInstalled = true;

    this.timer = setInterval(() => void this.sweep(), this.tickIntervalMs);
    if (typeof (this.timer as { unref?: () => void }).unref === "function") {
      (this.timer as unknown as { unref: () => void }).unref();
    }
  }

  touch(conn: Connection): void {
    const state = this.connStates.get(conn);
    if (state) {
      state.lastActivityAt = this.now();
    } else {
      this.connStates.set(conn, { lastActivityAt: this.now() });
    }
  }

  private async sweep(): Promise<void> {
    if (!this.node) return;
    const cutoff = this.now() - this.idleTimeoutMs;
    const victims: Connection[] = [];
    for (const conn of this.connSet) {
      const state = this.connStates.get(conn);
      if (state && state.lastActivityAt < cutoff) victims.push(conn);
    }
    for (const conn of victims) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
      this.connSet.delete(conn);
      this.connStates.delete(conn);
    }
  }

  async drain(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (!this.node) return;

    const deadline = this.now() + this.stopGracePeriodMs;
    while (this.connSet.size > 0 && this.now() < deadline) {
      await new Promise((res) => setTimeout(res, 25));
    }
    for (const conn of [...this.connSet]) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connSet.clear();

    if (this.listenersInstalled && this.node && this.boundOnConnect && this.boundOnDisconnect) {
      this.node.removeEventListener(
        "connection:open",
        this.boundOnConnect as (evt: CustomEvent<Connection>) => void,
      );
      this.node.removeEventListener(
        "connection:close",
        this.boundOnDisconnect as (evt: CustomEvent<Connection>) => void,
      );
      this.listenersInstalled = false;
    }
    this.node = undefined;
  }

  size(): number {
    return this.connSet.size;
  }
}
