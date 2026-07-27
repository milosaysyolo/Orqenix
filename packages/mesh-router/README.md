# @orqenix/mesh-router

**TRANSPORT-LEVEL ROUTER for Phase 6 mesh transports. NOT query coordination.**

This package implements the L4 transport sub-layer of the Orqenix mesh: select the best transport for a given target scope, manage circuit breaker state, fail over across transports within a deadline, deduplicate across transports, and dispatch inbound requests through capability verification. It is **not** concerned with query-level concerns like parallel fan-out, provenance verification, quorum, or auto-link suggestions. Those belong to `@orqenix/mesh-routing`.

Cross-transport mesh router for Orqenix Phase 6: priority-based selection, circuit breaker, sequential failover within deadline, cross-transport dedup, capability-gated inbound dispatch.

## What it does

```text
inbound request
     |
     v
[capability verification] --> denied? --> return denied
     | ok
[dispatch to registered handler]
     |
     v
outbound request
     |
     v
[priority-sort transports] --> [circuit breaker check] --> open? --> skip
     | closed
[send over best transport] --> success? --> return ok
     | fail
[failover to next transport] --> deadline exceeded? --> return timeout
```

- **Priority-based transport selection** via `sortByPriority` against configured priority list
- **Circuit breaker** (Closed / Open / Half-Open) per transport kind, configurable thresholds and cooldown
- **Sequential failover** across candidate transports within `req.deadlineMs`, splitting remaining budget evenly per attempt
- **Cross-transport dedup** via `CrossTransportDedup` (TTL-based, in-memory)
- **Capability-gated inbound dispatch** via `StructuralCapabilityVerifier`
- **Observability hooks** for failover, circuit open/half-open/close events

## What it does NOT do

- **Query fan-out.** Parallel query to multiple scopes is in `@orqenix/mesh-routing`.
- **Provenance verification.** Chain validation and broken-chain dropping are in `@orqenix/mesh-routing`.
- **Quorum checks.** Determining whether enough scopes replied successfully is in `@orqenix/mesh-routing`.
- **Auto-link suggestions.** Failure-ratio and relevance-based scope link recommendations are in `@orqenix/mesh-routing`.
- **Transport implementation.** HTTP, libp2p, IPC transports live in their own packages (`@orqenix/mesh-transport-http`, `@orqenix/mesh-transport-libp2p`).

## Boundary: mesh-router vs mesh-routing

| Concern | `@orqenix/mesh-router` | `@orqenix/mesh-routing` |
|---------|----------------------|------------------------|
| Role | Transport router (L4 transport sub-layer) | Query coordinator (L4 query layer) |
| Fan-out | Sequential failover across transports | Parallel query to multiple scopes |
| Verification | Capability-gated inbound dispatch | Provenance chain validation |
| Resilience | Circuit breaker, deadline-aware retry | Per-target timeout, quorum check |
| Input | `MeshRequest` (toScope, id, deadlineMs) | `MeshQuery` (text, k, targetScopeIds, timeoutMs) |
| Output | `MeshResponse` (ok/denied/timeout) | `MeshQueryResponse` with aggregated hits |
| Deps | 2 (only `mesh-transport-core` + `mesh-observability`) | 9 (includes `@orqenix/core`, `provenance`, etc.) |

See `@orqenix/mesh-routing` for query-level coordination. Both packages coexist in L4: mesh-router delivers the packets, mesh-routing coordinates the query.

## Dependencies

- `@orqenix/mesh-transport-core` — transport interfaces (`MeshTransport`, `TransportRegistry`, `MeshRequest`, `MeshResponse`, etc.)
- `@orqenix/mesh-observability` — observability hooks (`onFailover`, `onCircuitOpen`, etc.)

(Notable absence: `@orqenix/core` is NOT a dependency. This package is transport-layer only and has no dependency on core query abstractions.)

## Exports

| Export | Source | Purpose |
|--------|--------|---------|
| `MeshRouter` | `./router.js` | Core router class: `send()`, `attachHandler()`, `breakerStateOf()`, `dedupHas()` |
| `MeshRouterBuilder` | `./builder.js` | Fluent builder for `MeshRouter` with optional defaults |
| `CircuitBreaker` | `./circuit-breaker.js` | Per-transport circuit breaker (Closed/Open/HalfOpen) |
| `CrossTransportDedup` | `./dedup.js` | Cross-transport request deduplication with TTL |
| `sortByPriority` | `./priority.js` | Transport sort by configured priority |
| `makeInboundDispatch` | `./inbound.js` | Inbound request handler factory with capability verification |

Charter gate: **G43 Mesh Router Wrapper**.
