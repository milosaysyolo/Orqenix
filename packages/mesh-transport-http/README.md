# @orqenix/mesh-transport-http

HTTP MeshTransport for Orqenix Phase 6.

Single POST endpoint `/orqenix/mesh/v1/rpc` with msgpack envelopes (`application/vnd.orqenix.mesh+msgpack`), four mandatory security headers, bounded dedup cache, bounded retry policy, and clean teardown.

Built on `@orqenix/mesh-transport-core` (Part 1). See [CR v7.2 Chapter 3](https://github.com/milosaysyolo/Orqenix/tree/main/docs/cr-v7.2/chapter-3-http-transport.md).
