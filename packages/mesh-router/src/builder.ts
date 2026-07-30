// SPDX-License-Identifier: Apache-2.0
import type { ObservabilityHooks } from "@orqenix/mesh-observability";
import type { ScopeId, TransportRegistry } from "@orqenix/mesh-transport-core";
import { MeshRouter, type AddressResolver, type MeshRouterOptions } from "./router.js";
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker.js";
import { CrossTransportDedup, type CrossTransportDedupOptions } from "./dedup.js";
import { DEFAULT_PRIORITY, priorityList, type PriorityList } from "./priority.js";
import type { AppHandler, StructuralCapabilityVerifier } from "./inbound.js";

export class MeshRouterBuilder {
  private localScopeId?: ScopeId;
  private registry?: TransportRegistry;
  private verifier?: StructuralCapabilityVerifier;
  private addressResolver?: AddressResolver;
  private priority: PriorityList = DEFAULT_PRIORITY;
  private breakerOpts?: CircuitBreakerOptions;
  private dedupOpts?: CrossTransportDedupOptions;
  private hooks?: ObservabilityHooks;
  private handler?: AppHandler;

  withLocalScope(id: ScopeId): this {
    this.localScopeId = id;
    return this;
  }
  withRegistry(r: TransportRegistry): this {
    this.registry = r;
    return this;
  }
  withVerifier(v: StructuralCapabilityVerifier): this {
    this.verifier = v;
    return this;
  }
  withAddressResolver(fn: AddressResolver): this {
    this.addressResolver = fn;
    return this;
  }
  withPriority(order: ReadonlyArray<string>): this {
    this.priority = priorityList(order);
    return this;
  }
  withBreaker(opts: CircuitBreakerOptions): this {
    this.breakerOpts = opts;
    return this;
  }
  withDedup(opts: CrossTransportDedupOptions): this {
    this.dedupOpts = opts;
    return this;
  }
  withHooks(h: ObservabilityHooks): this {
    this.hooks = h;
    return this;
  }
  withHandler(h: AppHandler): this {
    this.handler = h;
    return this;
  }

  build(): MeshRouter {
    if (!this.localScopeId) throw new Error("MeshRouterBuilder: localScopeId required");
    if (!this.registry) throw new Error("MeshRouterBuilder: registry required");
    if (!this.verifier) throw new Error("MeshRouterBuilder: verifier required");
    if (!this.addressResolver) throw new Error("MeshRouterBuilder: addressResolver required");

    const breaker = new CircuitBreaker({
      ...(this.breakerOpts ?? {}),
      scopeId: this.localScopeId,
      hooks: this.hooks,
    });
    const dedup = new CrossTransportDedup(this.dedupOpts);

    const opts: MeshRouterOptions = {
      localScopeId: this.localScopeId,
      registry: this.registry,
      verifier: this.verifier,
      addressResolver: this.addressResolver,
      priority: this.priority,
      breaker,
      dedup,
      hooks: this.hooks,
      handler: this.handler,
    };
    const router = new MeshRouter(opts);
    if (this.handler) router.bindInboundToAllTransports();
    return router;
  }
}
