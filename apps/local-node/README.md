# @orqenix/local-node

Phase 6 local-node binary that wires HTTP + libp2p transports, discovery, security, observability, and cross-transport routing into a runnable mesh node.

## Quick start

```bash
# install + build
pnpm install
pnpm build

# start with default config
pnpm -F @orqenix/local-node run start

# or from the apps/local-node directory:
cd apps/local-node
pnpm start
```

## CLI

```
orqenix-node start   [--config <dir>]   Start the mesh node
orqenix-node status  [--config <dir>]   Print runtime status as JSON
orqenix-node verify                      Run all Phase 6 gates
orqenix-node version                     Print version
```

Config directory defaults to `.orqenix` relative to CWD.

## Config structure

```
.orqenix/
  identity/
    scope.yaml         # Scope ID + description
    private.pem        # Ed25519 private key (PKCS#8 PEM)
  mesh/
    transports.yaml    # HTTP / libp2p adapter config
    bootstrap.yaml     # Bootstrap peer multiaddrs (optional)
    peers.yaml         # Static peer address book (optional)
```

## Architecture

| Layer | Package | Role |
|-------|---------|------|
| Transport | `@orqenix/mesh-transport-http` | HTTP mesh transport (msgpack wire) |
| Transport | `@orqenix/mesh-transport-libp2p` | libp2p mesh transport (Noise + yamux) |
| Discovery | `@orqenix/mesh-discovery` | mDNS + bootstrap peer discovery |
| Security | `@orqenix/transport-security` | Ed25519 identity, capability verification |
| Observability | `@orqenix/mesh-observability` | Structured logging + metrics |
| Routing | `@orqenix/mesh-router` | Priority-aware, circuit-broken transport selection |

## Cross-repo setup (Orqenix-Pro)

When `../Orqenix-Pro` exists as a sibling directory, the setup scripts automatically install and build it. Run `scripts/setup-dev.sh` (Linux/macOS) or `scripts/setup-dev.ps1` (Windows) for automated setup.

## Test

```bash
# all tests (including e2e spawn)
pnpm test

# unit tests only (skip e2e)
pnpm test:no-e2e
```
