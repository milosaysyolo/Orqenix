# Orqenix Roadmap

This roadmap is intentionally high-level and may change as we learn from
adopters. Detailed phase plans live in `docs/architecture/phase-*/`.

> Last updated: 2026-06-03

## Now — Phase 5: Memory Foundation Refactor ✅ SHIPPED

- Local-first mesh architecture, scope identity (Ed25519, BLAKE3 scope_id)
- 6-layer architecture with explicit Mesh + Identity layer
- Capability-based permissions, directional cross-scope links
- Polyglot knowledge backends, SQLite default, LMDB / Kuzu / LanceDB opt-in
- ChatKB with diff-only storage (BLAKE3 + zstd deltas)
- Compress-as-Memorize with 4 strategies and controlled overflow
- Memory Distiller (OSS heuristic, Pro LLM-based)
- 27 OSS packages, 7 Pro packages, ~32K LOC, 35 charter gates

**Status**: tagged `v0.5.0-phase-5`. First npm publish in progress.

## Next — Phase 6: Mesh Transports + Pro CLI

- HTTP and libp2p mesh transports for cross-scope queries
- Native binding CI matrix (better-sqlite3, sqlite-vec) for Linux / macOS / Windows
- Pro CLI subcommands: `mesh delegate`, `blast-radius set`, `polyglot migrate`
- First-class VS Code extension surface for capability prompts
- Quality target: cross-scope query p95 < 300 ms over LAN

**Target**: 2026 Q3.

## Soon — Phase 7: Cloud Tier

- `@orqenix-cloud/*` packages for multi-machine mesh
- Hosted relay for NAT-traversal scenarios
- Web UI inspector for scopes, links, capabilities, audit log
- Team workspace primitives (shared scope catalog, role mapping)
- Separate commercial license, free tier for individuals

**Target**: 2026 Q4 / 2027 Q1.

## Later — Exploration

- Browser-only adapter (WASM SQLite, OPFS storage)
- Mobile capture client for ChatKB
- First-party MCP server bridging Orqenix scopes
- Distillation policies tuned per language / framework

## What is NOT on the roadmap

- A hosted "Orqenix Inc." managed cloud at parity with self-host. Cloud tier
  will always be opt-in and never gate basic mesh, scope identity, or
  provenance features.
- Closed-source forks of OSS packages.
- Telemetry on by default. Any telemetry will be opt-in, documented, and
  shippable as a separate package.

## How to influence the roadmap

- Open a [Discussion under "Ideas"](https://github.com/milosaysyolo/Orqenix/discussions/categories/ideas)
- Upvote existing issues, we look at reactions when prioritizing
- Sponsor a milestone via GitHub Sponsors (coming with Phase 6)
