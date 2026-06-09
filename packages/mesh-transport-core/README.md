# @orqenix/mesh-transport-core

Transport-agnostic foundation for the Orqenix mesh.

Provides the `MeshTransport` interface, canonical msgpack envelope (`MeshRequest`/`MeshResponse`), `TransportRegistry`, lifecycle state machine, typed error taxonomy, and a `LoopbackTransport` reference implementation.

Part of [Phase 6](https://github.com/milosaysyolo/Orqenix/tree/main/docs/cr-v7.2/chapter-2-transport-abstraction.md). No HTTP or libp2p code lives here; those land in subsequent parts.
