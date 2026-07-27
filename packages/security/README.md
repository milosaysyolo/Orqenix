# @orqenix/security

Convenience barrel package over three Orqenix security sub-packages.

## What it provides

| Export source | Package | Provides |
|---|---|---|
| `export * from '@orqenix/scope-identity'` | [scope-identity](../scope-identity) | Ed25519 scope identity, `scope.yaml` init/load, keypair management |
| `export * from '@orqenix/capability-tokens'` | [capability-tokens](../capability-tokens) | Ed25519-signed capability token issuance, verification, delegation, revocation |
| `export * from '@orqenix/audit-log'` | [audit-log](../audit-log) | Tamper-evident append-only audit log with BLAKE3 chain verification |

Import from this package instead of the individual sub-packages when you want all three in one import.

## API

See each sub-package's README for full API docs.
