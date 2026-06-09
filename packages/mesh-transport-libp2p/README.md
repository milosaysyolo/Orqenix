# @orqenix/mesh-transport-libp2p

libp2p MeshTransport foundation for Orqenix Phase 6.

- HKDF peer-key derivation from scope Ed25519 seed
- Noise XX handshake with mutual auth
- yamux stream multiplexing
- Custom protocol `/orqenix/mesh/1.0.0` with capability handshake
- `Libp2pMeshTransport` implementing `MeshTransport`

See [CR v7.2 Chapter 4](../docs/CR/v7.2/chapter-4-libp2p-mesh-transport.md) for architecture.
