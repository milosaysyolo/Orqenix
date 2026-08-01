# Architecture Overview

Orqenix is structured as a **6-layer local-first mesh**. Each layer is a thin
set of packages with explicit contracts. This document gives you the mental
model; the authoritative spec lives in
[CR v7.1](https://github.com/milosaysyolo/Orqenix/blob/main/docs/cr/CR-v7.1.md).

## The 6 layers

```
┌──────────────────────────────────────────────┐
│ L6  Application (agents, CLI, editors)       │
├──────────────────────────────────────────────┤
│ L5  Memory (working, episodic, semantic,     │
│             global) + ChatKB + CodeKB        │
├──────────────────────────────────────────────┤
│ L4  Mesh + Identity (scopes, links,          │
│             capabilities, provenance)        │
├──────────────────────────────────────────────┤
│ L3  Knowledge (4 KBs × adapters)             │
├──────────────────────────────────────────────┤
│ L2  Storage (SQLite default; LMDB / Kuzu /   │
│             LanceDB Pro; diff-only)          │
├──────────────────────────────────────────────┤
│ L1  Platform (Node, native bindings, fs)     │
└──────────────────────────────────────────────┘
```

## Key concepts

### Scope

A scope is **one Git repository + one `.orqenix/` folder**. Each scope has a
cryptographic identity (Ed25519 keypair + BLAKE3 scope_id) and owns its own
knowledge bases. Scopes never share state implicitly.

### Mesh

A mesh is a set of **directional, capability-scoped links** between scopes.
Links carry tokens that grant narrow permissions (for example
`read:kb-code`). There is no DHT, no P2P discovery in Phase 5. Mesh queries
fan out only to explicitly linked scopes.

### Capability

A capability is a verifiable claim (`read:kb-chat`, `write:kb-code`,
`delegate:mesh`, etc.) signed by the granting scope. Pro adds delegation
chains up to depth 8 with cap narrowing.

### Compress-as-Memorize

Compression is part of memorization, not a separate step. Working memory
overflow triggers distillation into episodic memory, which compresses into
semantic memory, which folds into global memory.

### Polyglot storage

SQLite (with `sqlite-vec`) is the default and ships in OSS. Pro adds:

- **LMDB** for the token store (low-latency K/V)
- **Kuzu** for the code graph (multi-hop queries)
- **LanceDB** for embeddings (large-scale ANN)

All adapters share a common contract so projects can upgrade per-KB.

## Where to read more

- [Memory model deep dive](./architecture/memory.md)
- [Mesh routing internals](./architecture/mesh.md)
- [Polyglot adapter contract](./architecture/polyglot.md)
- [Capability token format](./architecture/capabilities.md)
- [Diff-only storage and reconstruction](./architecture/diff-storage.md)
