# @orqenix/mesh-routing

**QUERY COORDINATOR for cross-scope memory recall. NOT a transport router.**

This package implements the L4 query coordination layer of the Orqenix mesh: fan-out a recall query to multiple remote scopes, collect and verify results, enforce quorum, and suggest auto-links. It is **not** concerned with transport-level concerns like circuit breaking, failover across transports, or route tables. Those belong to `@orqenix/mesh-router`.

Cross-scope mesh query coordinator for the Orqenix local-first mesh (CR v7.1 Ch.13).

## What it does

```text
local_scope --[parallel fanout]--> remote_scope_B
                                   remote_scope_C
                                   remote_scope_D
              <----------- hits + provenance -----------
              [validate chains] [aggregate top-k] [quorum check]
```

- **Parallel fanout** via `Promise.allSettled`
- **Per-target timeout** (default 5s)
- **Provenance verification** drops hits with broken chains
- **Quorum** = `ceil(scopesQueried / 2)` successful scopes
- **Auto-link suggestions** based on failure ratios and relevance scores

## What it does NOT do

- **Circuit breaking.** Transport-level circuit protection is handled by `@orqenix/mesh-router`'s `CircuitBreaker`.
- **Transport failover.** Sequential failover across HTTP, libp2p, IPC transports belongs in `@orqenix/mesh-router`.
- **Route table management.** Priority-based transport selection and address resolution are in `@orqenix/mesh-router`.
- **Cross-transport dedup.** Request deduplication across multiple transports is in `@orqenix/mesh-router`.

## Transport agnostic

`MeshTransport` is an interface. The package ships `InMemoryMeshTransport` for tests. Production transports (HTTP, libp2p, IPC) are user-implemented.

## Boundary: mesh-routing vs mesh-router

| Concern | `@orqenix/mesh-routing` | `@orqenix/mesh-router` |
|---------|------------------------|----------------------|
| Role | Query coordinator (L4 query layer) | Transport router (L4 transport sub-layer) |
| Fan-out | Parallel query to multiple scopes | Sequential failover across transports |
| Verification | Provenance chain validation | Capability-gated inbound dispatch |
| Resilience | Per-target timeout, quorum check | Circuit breaker, deadline-aware retry |
| Output | `MeshQueryResponse` with aggregated hits | `MeshResponse` (ok/denied/timeout) |
| Deps | 9 (includes `@orqenix/core`, `provenance`, etc.) | 2 (only `mesh-transport-core` + `mesh-observability`) |

See `@orqenix/mesh-router` for transport-level routing. Both packages coexist in L4: mesh-routing coordinates the query, mesh-router delivers the packets.

## Dependencies

- `@orqenix/core` — base error types
- `@orqenix/scope-identity` — scope ID patterns and validation
- `@orqenix/scope-link` — scope link store for target resolution
- `@orqenix/provenance` — provenance chain verification
- `@orqenix/hooks` — hook bus for pre/post-recall events
- `@orqenix/storage-sqlite` — storage backend
- `@orqenix/telemetry` — metrics (counters, histograms)
- `zod` — query schema validation

(Notable absence: `@orqenix/mesh-router` does NOT appear in these deps. mesh-routing is a consumer of transports, not a transport router itself.)

Charter gates: **G34 Mesh Routing Quorum**, **G35 Auto-Link Suggestion**.
