# Changelog

## v0.1.0-phase-1 (2026-05-21)

### Phase 1 — Core Scaffold + CLI

- **Monorepo scaffold**: pnpm workspace + turbo + TypeScript project references
- **`@orqenix/core`**: sync engine, config loader, scope detection, SQLite KV store, skill compiler, watcher, git-info, session detection
- **`orqenix` (CLI)**: `init`, `config`, `doctor`, `team` (list/show/create/edit/install/uninstall/validate), `sync`, `scope`
- **`@orqenix/teams-built-in`**: dev-team with 6 agents (lead, builder, inspector, navigator, debugger, researcher)
- **Testing**: 30 passing tests (vitest) across 7 test suites
- **TypeScript**: full typecheck passes for all 3 packages
- **Build**: ESM + CJS + DTS bundles via tsup for both core and CLI
- **Platform**: Windows + Node 24.15.0 compatible (better-sqlite3 native build)
