# Changelog

All notable changes to the Orqenix main repo. Format based on Keep a Changelog 1.1.

## [0.5.0-phase-5] — 2026-06-03

### Summary

Phase 5: Memory Foundation Refactor. 27 packages, ~25,220 LOC, 31 charter gates,
~201 charter-gate checks, ~446 total tests, ALL GREEN. Migration tooling with
automatic rollback. CLI surface covering scope, link, workspace, audit, detach,
migrate. Phase 4 v1 plugin contract preserved end-to-end.

### Added

#### Identity, tokens, storage foundation (Parts 2 through 4)

- `@orqenix/scope-identity` — Ed25519 keypair + scope_id derivation via BLAKE3
- `@orqenix/capability-tokens` — JWT-style format, 6 permission scenarios, revocation
- `@orqenix/storage-sqlite` — better-sqlite3 wrapper with migrations + sqlite-vec
- `@orqenix/storage-diff` — BLAKE3 content hashing + zstd-delta encoding
- `@orqenix/kb-chat` — hash-chained ChatKB with capability-gated writes

#### Memory + recall (Parts 5 through 6)

- `@orqenix/memory-tiers` — 4-tier model (working/episodic/semantic/procedural)
- `@orqenix/memory-distiller` — heuristic extraction with CPU throttling
- `@orqenix/llm-adapter-ollama` — local LLM via Qwen 2.5 7B default
- `@orqenix/llm-adapter-byok` — OpenAI, Anthropic, Google, DeepSeek + FallbackChain
- `@orqenix/injection-strategies` — 5 strategies (A through E) per CR v7.1 Ch.8
- `@orqenix/prompt-rewriter` — keyword recall + injection orchestrator

#### Compression + telemetry (Part 7)

- `@orqenix/hooks` — typed event bus, 7 events, listener error isolation
- `@orqenix/telemetry` — counters, gauges, histograms, MetricSink interface
- `@orqenix/compress-strategies` — 4 strategies (Drop, Summarize, Distill, CompressChain)
- `@orqenix/smart-compression` — 105% overflow cap, Token Visibility UX helpers
- `@orqenix/plugin-compress-context` v2 — Phase 4 v1 contract preserved verbatim

#### File watcher + reindex + RTK (Part 8)

- `@orqenix/file-watcher` — chokidar wrapper with 150ms debounce + ignore defaults
- `@orqenix/reindex-incremental` — BLAKE3 content-hash-driven incremental reindex
- `@orqenix/rtk-hooks` — shell command capture with redaction + size caps + timeout

#### Mesh routing + cross-scope (Part 9)

- `@orqenix/scope-link` — bidirectional trust edges with state machine
- `@orqenix/provenance` — tamper-evident BLAKE3 chains
- `@orqenix/workspace` — owner / contributor / observer roles + transferOwnership
- `@orqenix/mesh-routing` — parallel fanout, quorum check, auto-link suggestions

#### Audit + detach + migration + CLI (Part 12)

- `@orqenix/audit-log` — append-only hash-chained log, 16 event kinds
- `@orqenix/detach` — 2-step destructive pattern with confirmation token
- `@orqenix/migration` — Phase 4 to Phase 5 migration with BLAKE3-verified rollback
- `@orqenix/cli` — `orqenix` command with 16 subcommands

### Charter Gates

G1, G2, G3, G4, G5, G7, G8, G9, G10, G11, G12, G13, G14, G15, G16, G17, G18,
G19, G20, G21, G22, G23, G24, G25, G26, G27, G28, G29, G30, G31, G32, G33,
G34, G35 — 31 gates, ~201 checks, ALL PASS.

### Breaking Changes

None at the public API surface. `@orqenix/plugin-compress-context` v1 default
export preserved verbatim and snapshot-tested by Charter Gate G16.

### Migration

Phase 4 to Phase 5 migration via `orqenix migrate up`. Automatic BLAKE3-verified
backup. Rollback via `orqenix migrate rollback --backup <path>`. All migrations
use globally unique IDs (1 chat, 2 memory-tiers, 10 reindex, 20 scope-link,
21 workspace, 30 audit-log).

### Known Artifacts

- ESM gate runners require `fileURLToPath(import.meta.url)` polyfill for `__dirname`
- Gate scripts use `pnpm vitest run` for cross-platform Windows compatibility
- Pro tier (Parts 10 through 11) ships in the separate Orqenix-Pro repo under BSL-1.1

### Phase Summary

| Metric              | Value   |
| ------------------- | ------- |
| Packages            | 27      |
| LOC                 | ~25,220 |
| Charter Gates       | 31      |
| Charter Gate Checks | ~201    |
| Total Tests         | ~446    |
