import {
  toMeshResponse,
  type MeshAddress,
  type MeshRequest,
  type MeshResponse,
  type MeshTransport,
  type ScopeId,
  type SendOpts,
  type TransportRegistry,
} from "@orqenix/mesh-transport-core";
import type { ObservabilityHooks } from "@orqenix/mesh-observability";
import { onFailover } from "@orqenix/mesh-observability";
import { CircuitBreaker } from "./circuit-breaker.js";
import { CrossTransportDedup } from "./dedup.js";
import { DEFAULT_PRIORITY, sortByPriority, type PriorityList } from "./priority.js";
import {
  makeInboundDispatch,
  type AppHandler,
  type StructuralCapabilityVerifier,
} from "./inbound.js";

export type AddressResolver = (kind: string, scopeId: ScopeId) => MeshAddress | undefined;

export interface MeshRouterOptions {
  localScopeId: ScopeId;
  registry: TransportRegistry;
  verifier: StructuralCapabilityVerifier;
  addressResolver: AddressResolver;
  priority?: PriorityList;
  breaker?: CircuitBreaker;
  dedup?: CrossTransportDedup;
  hooks?: ObservabilityHooks;
  handler?: AppHandler;
}

export class MeshRouter {
  readonly localScopeId: ScopeId;
  private readonly registry: TransportRegistry;
  private readonly verifier: StructuralCapabilityVerifier;
  private readonly addressResolver: AddressResolver;
  private readonly priority: PriorityList;
  private readonly breaker: CircuitBreaker;
  private readonly dedup: CrossTransportDedup;
  private readonly hooks?: ObservabilityHooks;
  private handler?: AppHandler;

  constructor(opts: MeshRouterOptions) {
    this.localScopeId = opts.localScopeId;
    this.registry = opts.registry;
    this.verifier = opts.verifier;
    this.addressResolver = opts.addressResolver;
    this.priority = opts.priority ?? DEFAULT_PRIORITY;
    this.breaker =
      opts.breaker ?? new CircuitBreaker({ hooks: opts.hooks, scopeId: opts.localScopeId });
    this.dedup = opts.dedup ?? new CrossTransportDedup();
    this.hooks = opts.hooks;
    this.handler = opts.handler;
  }

  attachHandler(handler: AppHandler): void {
    this.handler = handler;
    this.bindInboundToAllTransports();
  }

  bindInboundToAllTransports(): void {
    if (!this.handler) return;
    const dispatch = makeInboundDispatch({
      localScopeId: this.localScopeId,
      verifier: this.verifier,
      hooks: this.hooks,
      dedup: this.dedup,
      handler: this.handler,
    });
    for (const t of this.registry.all()) {
      t.onRequest(dispatch);
    }
  }

  async send(req: MeshRequest, opts?: SendOpts): Promise<MeshResponse> {
    const all = this.registry.reachable(req.toScope);
    const ordered = sortByPriority(all, this.priority);

    if (ordered.length === 0) {
      return toMeshResponse(req.id, new Error("no transports reachable for target scope"));
    }

    const candidates = ordered.filter((t) => this.breaker.canAttempt(t.kind));
    if (candidates.length === 0) {
      return toMeshResponse(req.id, new Error("all transports open by circuit breaker"));
    }

    let lastResponse: MeshResponse | undefined;

    for (let i = 0; i < candidates.length; i++) {
      const t = candidates[i]!;
      const remaining = Math.max(0, req.deadlineMs - Date.now());
      if (remaining <= 0) break;
      const candidatesLeft = candidates.length - i;
      const perAttempt = Math.max(1, Math.floor(remaining / Math.max(1, candidatesLeft)));

      const addr = this.addressResolver(t.kind, req.toScope);
      if (!addr) {
        this.breaker.recordFailure(t.kind);
        continue;
      }

      const attempt = await this.sendOne(t, addr, req, { ...opts, timeoutMs: perAttempt });
      lastResponse = attempt;

      if (attempt.status === "denied" || attempt.status === "ok") {
        this.breaker.recordSuccess(t.kind);
        return attempt;
      }

      this.breaker.recordFailure(t.kind);

      const next = candidates[i + 1];
      if (next && Date.now() < req.deadlineMs) {
        if (this.hooks)
          onFailover(this.hooks, { scopeId: this.localScopeId, from: t.kind, to: next.kind });
        continue;
      }
      break;
    }

    return lastResponse ?? { id: req.id, status: "timeout" };
  }

  private async sendOne(
    t: MeshTransport,
    addr: MeshAddress,
    req: MeshRequest,
    opts: SendOpts,
  ): Promise<MeshResponse> {
    try {
      return await t.send(addr, req, opts);
    } catch (e) {
      return toMeshResponse(req.id, e);
    }
  }

  breakerStateOf(kind: string): ReturnType<CircuitBreaker["stateOf"]> {
    return this.breaker.stateOf(kind);
  }

  dedupHas(id: string): boolean {
    return this.dedup.hasUnexpired(id);
  }
}
