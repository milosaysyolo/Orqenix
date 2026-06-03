# @orqenix/mesh-routing

Cross-scope mesh query coordinator for the Orqenix local-first mesh (CR v7.1 Ch.13).

## What it does

```text
local_scope --[parallel fanout]--> remote_scope_B
                                   remote_scope_C
                                   remote_scope_D
              <----------- hits + provenance -----------
              [validate chains] [aggregate top-k] [quorum check]
```

* **Parallel fanout** via `Promise.allSettled`
* **Per-target timeout** (default 5s)
* **Provenance verification** drops hits with broken chains
* **Quorum** = `ceil(scopesQueried / 2)` successful scopes
* **Auto-link suggestions** based on failure ratios and relevance scores

## Transport agnostic

`MeshTransport` is an interface. The package ships `InMemoryMeshTransport` for tests. Production transports (HTTP, libp2p, IPC) are user-implemented.

Charter gates: **G34 Mesh Routing Quorum**, **G35 Auto-Link Suggestion**.
