## v1.0.0 - 2026-07-22

Stable v1.0.0 release. Production-hardened Workbench, real CLI commands, event bus with proper ID uniqueness, CSP headers, error boundaries, loading states, and a new `@orqenix/security` barrel package. Phase-X stubs replaced throughout. Engine init now fails loud on schema drift in production.

### Added

- `@orqenix/security` barrel package: re-exports `@orqenix/scope-identity`, `@orqenix/capability-tokens`, `@orqenix/audit-log` from one import. v0.9.0.
- CLI `init` command: real implementation using `@orqenix/scope-identity.initScope`. Generates Ed25519 keypair, writes scope.yaml and identity.key.
- CLI `doctor` command: verifies Node.js version (>=20), scope.yaml validity, identity key permissions (0600), SQLite migration readiness, and Ed25519 signing round-trip.
- CLI auto-help: `--help` flag prints usage.
- CLI version from package.json: reads `version` field, no longer hardcoded.
- Loading states: skeleton cards on dashboard, memory, sessions, settings, marketplace screens.
- Error boundary: `error.tsx` with warning icon, error message, digest, and try-again button.
- CSP report-only headers: `default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:`.
- MCP API route (`/api/agents/mcp`): wired to live `OrqenixMcpServer` backed by `MemoryEngine` + `SkillRuntime`. Lists tools, resources, prompts, and tokens.
- SSE event streaming (`/api/stream`): real-time event bus for workbench UI.
- Engine init pipeline: real MemoryEngine, Observer, Detector, PromoterService, PluginRegistry, PluginLifecycle, MarketplaceManager, and SettingsRegistry.
- DB migration: memory links table (570-memory-links), agent definitions and teams tables (580-agents), config overrides and MCP tokens tables (590-workbench-state).

### Fixed

- Event bus ID collision: IDs changed from `Math.random().toString(36).slice(2)` to `evt_${crypto.randomUUID()}`. Guarantees uniqueness across concurrent sessions.
- CLI scope ID placeholder: `ORQENIX_SCOPE` default changed from `"placeholder"` to `""`. All scoped commands now emit a clear error when no scope ID is set.
- Build errors resolved in 4 packages (stabilization for v1.0.0).
- Workbench MatrixViz: removed fake/hardcoded entry counts. Now renders real data from memory engine via API.

### Changed

- CLI `init` and `doctor` from stubs to real commands (previously "coming in v0.10.0").
- Phase-X stub markers removed from 6 packages. Stub versions, placeholder exports, and "TODO Part 12" markers cleaned out.
- Engine init defaults flipped: `failOnDrift` is `true` in production (`NODE_ENV=production` or `ORQENIX_STRICT=1`). Schema drift at startup is now fatal.
- `@orqenix/security` promoted from no barrel to full re-export at v0.9.0.

### Breaking Changes

- `@orqenix/security` now re-exports all symbols from `scope-identity`, `capability-tokens`, and `audit-log`. If you imported from sub-packages directly, your imports still work. If you had a local file named `@orqenix/security`, it now shadows the barrel.
- CLI requires `orqenix init` before any scoped command (scope info, link, workspace, audit, detach). No more `"placeholder"` default.
- Node 22 required for `@orqenix/local-node` (mesh node binary). Node 20.10+ for workbench.
- DB schema: new tables added for workbench state. Existing databases migrate automatically on first boot, but downgrade is not supported.

### Migration

See [MIGRATION-v1.0.0.md](./MIGRATION-v1.0.0.md) for step-by-step upgrade instructions.

## v0.6.1 - 2026-06-11 (clean semver republish)

### Changed
- All 7 Phase 6 packages republished with clean semver (no -phase-6 suffix)
- Inter-deps use ^0.6.0 caret semver enabling Phase 7+ forward-compat
- workspace:* protocol bug in v0.6.0 fixed by v0.6.1 republish

### Deprecated
- All @orqenix/*@0.6.0-phase-6 (use ^0.6.1)
- All @orqenix/*@0.6.0 with workspace:* bug (use ^0.6.1)
# Changelog

All notable changes to the Orqenix main repo. Format based on Keep a Changelog 1.1.

## [0.6.0-phase-6] - 2026-06-10

### Summary

Phase 6: Real Mesh, Local-First. 7 new OSS packages, ~20,000 LOC, 8 charter gates (G36-G43),
all PASS. Mesh transport layer with HTTP and libp2p implementations, capability-gated identity,
mDNS-based discovery, cross-transport routing, and observability hooks.

### npm Packages Published

All 7 OSS @orqenix/* Phase 6 packages are live on npm:
- @orqenix/mesh-transport-core@0.6.0-phase-6
- @orqenix/mesh-transport-http@0.6.0-phase-6
- @orqenix/mesh-transport-libp2p@0.6.0-phase-6
- @orqenix/mesh-discovery@0.6.0-phase-6
- @orqenix/transport-security@0.6.0-phase-6
- @orqenix/mesh-observability@0.6.0-phase-6
- @orqenix/mesh-router@0.6.0-phase-6

Pro CLI @orqenix-pro/cli@0.6.0-phase-6 also published.

See [GitHub Release](https://github.com/milosaysyolo/Orqenix/releases/tag/v0.6.0-phase-6) for full notes.

## [0.5.0-phase-5] - 2026-06-03

### Summary

Phase 5: Memory Foundation Refactor. 27 packages, ~25,220 LOC, 31 charter gates,
~201 charter-gate checks, ~446 total tests, ALL GREEN. Migration tooling with
automatic rollback. CLI surface covering scope, link, workspace, audit, detach,
migrate. Phase 4 v1 plugin contract preserved end-to-end.

### Added

#### Identity, tokens, storage foundation (Parts 2 through 4)

- `@orqenix/scope-identity` - Ed25519 keypair + scope_id derivation via BLAKE3
- `@orqenix/capability-tokens` - JWT-style format, 6 permission scenarios, revocation
- `@orqenix/storage-sqlite` - better-sqlite3 wrapper with migrations + sqlite-vec
- `@orqenix/storage-diff` - BLAKE3 content hashing + zstd-delta encoding
- `@orqenix/kb-chat` - hash-chained ChatKB with capability-gated writes

#### Memory + recall (Parts 5 through 6)

- `@orqenix/memory-tiers` - 4-tier model (working/episodic/semantic/procedural)
- `@orqenix/memory-distiller` - heuristic extraction with CPU throttling
- `@orqenix/llm-adapter-ollama` - local LLM via Qwen 2.5 7B default
- `@orqenix/llm-adapter-byok` - OpenAI, Anthropic, Google, DeepSeek + FallbackChain
- `@orqenix/injection-strategies` - 5 strategies (A through E) per CR v7.1 Ch.8
- `@orqenix/prompt-rewriter` - keyword recall + injection orchestrator

#### Compression + telemetry (Part 7)

- `@orqenix/hooks` - typed event bus, 7 events, listener error isolation
- `@orqenix/telemetry` - counters, gauges, histograms, MetricSink interface
- `@orqenix/compress-strategies` - 4 strategies (Drop, Summarize, Distill, CompressChain)
- `@orqenix/smart-compression` - 105% overflow cap, Token Visibility UX helpers
- `@orqenix/plugin-compress-context` v2 - Phase 4 v1 contract preserved verbatim

#### File watcher + reindex + RTK (Part 8)

- `@orqenix/file-watcher` - chokidar wrapper with 150ms debounce + ignore defaults
- `@orqenix/reindex-incremental` - BLAKE3 content-hash-driven incremental reindex
- `@orqenix/rtk-hooks` - shell command capture with redaction + size caps + timeout

#### Mesh routing + cross-scope (Part 9)

- `@orqenix/scope-link` - bidirectional trust edges with state machine
- `@orqenix/provenance` - tamper-evident BLAKE3 chains
- `@orqenix/workspace` - owner / contributor / observer roles + transferOwnership
- `@orqenix/mesh-routing` - parallel fanout, quorum check, auto-link suggestions

#### Audit + detach + migration + CLI (Part 12)

- `@orqenix/audit-log` - append-only hash-chained log, 16 event kinds
- `@orqenix/detach` - 2-step destructive pattern with confirmation token
- `@orqenix/migration` - Phase 4 to Phase 5 migration with BLAKE3-verified rollback
- `@orqenix/cli` - `orqenix` command with 16 subcommands

### Charter Gates

G1, G2, G3, G4, G5, G7, G8, G9, G10, G11, G12, G13, G14, G15, G16, G17, G18,
G19, G20, G21, G22, G23, G24, G25, G26, G27, G28, G29, G30, G31, G32, G33,
G34, G35 - 31 gates, ~201 checks, ALL PASS.

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
