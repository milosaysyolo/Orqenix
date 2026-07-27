import type { ObservabilityHooks } from "@orqenix/mesh-observability";
import { onCircuitClose, onCircuitHalfOpen, onCircuitOpen } from "@orqenix/mesh-observability";
import type { ScopeId } from "@orqenix/mesh-transport-core";

export type BreakerState = "Closed" | "Open" | "HalfOpen";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
  scopeId?: ScopeId;
  hooks?: ObservabilityHooks;
}

interface PerTransport {
  state: BreakerState;
  consecutiveFailures: number;
  openedAt: number;
  inFlightProbes: number;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly scopeId: ScopeId;
  private readonly hooks?: ObservabilityHooks;
  private readonly byKind = new Map<string, PerTransport>();

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
    this.now = opts.now ?? Date.now;
    this.scopeId = opts.scopeId ?? ("unknown" as ScopeId);
    this.hooks = opts.hooks;
  }

  canAttempt(kind: string): boolean {
    const s = this.ensure(kind);
    if (s.state === "Closed") return true;
    if (s.state === "Open") {
      if (this.now() - s.openedAt >= this.cooldownMs) {
        this.transition(kind, "HalfOpen");
        s.inFlightProbes++;
        return true;
      }
      return false;
    }
    if (s.inFlightProbes < 1) {
      s.inFlightProbes++;
      return true;
    }
    return false;
  }

  recordSuccess(kind: string): void {
    const s = this.ensure(kind);
    if (s.state === "HalfOpen") {
      s.inFlightProbes = Math.max(0, s.inFlightProbes - 1);
      this.transition(kind, "Closed");
    }
    s.consecutiveFailures = 0;
  }

  recordFailure(kind: string): void {
    const s = this.ensure(kind);
    if (s.state === "HalfOpen") {
      s.inFlightProbes = Math.max(0, s.inFlightProbes - 1);
      this.transition(kind, "Open");
      return;
    }
    if (s.state === "Closed") {
      s.consecutiveFailures++;
      if (s.consecutiveFailures >= this.failureThreshold) {
        this.transition(kind, "Open");
      }
    }
  }

  stateOf(kind: string): BreakerState {
    return this.ensure(kind).state;
  }

  consecutiveFailures(kind: string): number {
    return this.ensure(kind).consecutiveFailures;
  }

  private ensure(kind: string): PerTransport {
    let s = this.byKind.get(kind);
    if (!s) {
      s = { state: "Closed", consecutiveFailures: 0, openedAt: 0, inFlightProbes: 0 };
      this.byKind.set(kind, s);
    }
    return s;
  }

  private transition(kind: string, next: BreakerState): void {
    const s = this.ensure(kind);
    if (s.state === next) return;
    s.state = next;
    if (next === "Open") {
      s.openedAt = this.now();
      s.consecutiveFailures = 0;
      if (this.hooks) onCircuitOpen(this.hooks, { scopeId: this.scopeId, transport: kind });
    } else if (next === "HalfOpen") {
      s.inFlightProbes = 0;
      if (this.hooks) onCircuitHalfOpen(this.hooks, { scopeId: this.scopeId, transport: kind });
    } else {
      s.consecutiveFailures = 0;
      if (this.hooks) onCircuitClose(this.hooks, { scopeId: this.scopeId, transport: kind });
    }
  }
}
