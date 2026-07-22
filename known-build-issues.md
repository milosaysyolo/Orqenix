# Known Build Issues

Generated: 2026-07-22

## Environment

- Node: v25.9.0
- pnpm: 9.12.0
- turbo: 2.9.14
- OS: macOS (darwin)
- `pnpm install` success
- `pnpm build` fails (exit 2)
- `pnpm typecheck` not attempted (blocked on build)
- `pnpm test` not attempted (blocked on build)

## Root Cause Packages

These packages fail to build because of **their own TypeScript code errors** (not cascade failures from missing dependencies).

### 1. `@orqenix/mesh-transport-core` (tsc --build)

- `packages/mesh-transport-core/src/envelope.ts:10:24` — TS6133: `bytesEqual` imported but never read
- `packages/mesh-transport-core/src/errors.ts:75:10` — TS2532: Object is possibly `undefined` (sanitize function regex replace on possibly-undefined string)

### 2. `@orqenix/settings-registry` (tsup)

- `packages/settings-registry/src/registry.ts:14:3` — TS6196: `SettingsValidationResult` type declared but never used
- `packages/settings-registry/src/resolver.ts:11:3` — TS6196: `SettingsLevel` type declared but never used
- `packages/settings-registry/src/persistence.ts:8:15` — TS6196: `SettingsLevel` type declared but never used

### 3. `@orqenix/local-memory-federation` (tsup)

- `packages/local-memory-federation/src/project-index.ts:49:20` — TS6133: `projectPath` parameter declared but never read

### 4. `@orqenix/instinct-promoter` (tsup)

Own code errors (not cascade):
- `src/promoter-service.ts:47:20` — TS6133: `detector` declared but never read
- `src/promoter-service.ts:111:28` — TS7006: Parameter `c` implicitly has `any` type
- `src/promoter-service.ts:220:38` — TS7006: Parameter `e` implicitly has `any` type
- `src/promoter-service.ts:225-231` — TS2339x6: Properties `id`, `timestamp`, `action_kind`, `outcome_kind`, `outcome_duration_ms`, `action_payload` don't exist on type `{}`

Also has cascade TS2307 errors (self-learning-observer, skill-genesis, self-learning-detection).

## Cascade Failures

62 of 94 packages failed. Majority are cascade failures from the root causes above. Key cascade chains:

- `@orqenix/core` depends on mesh-transport-core, settings-registry, local-memory-federation → ~40 downstream packages blocked
- `@orqenix/self-learning-observer`, `@orqenix/skill-genesis`, `@orqenix/self-learning-detection` → instinct-promoter, skill-kit blocked
- `@orqenix/mcp-server` depends on core → workbench, cli blocked

All cascade failures resolve once root cause packages are fixed.

## Successful Packages (31/94)

Packages that build successfully: armoring, bench, binding-adapters, binding-core, config, embedding-cloud, embedding-local, gate-runner-core, kb-code, kb-decisions, kb-docs, lifecycle, mesh-router, plugin-bge-embedding, plugin-bge-reranker, plugin-claude-code-binding-ref, plugin-design-kb, plugin-example-agent, plugin-example-mcp-server, plugin-git-commit-conventional, plugin-notion-source, plugin-python-analyzer, plugin-qwen-rewriter, plugin-semantic-compression, plugin-test-runner-subagent, plugin-timeline-viz, plugin-windowed-injection, registry, schema, sdk, telemetry, testing, transport-security, ui-primitives, and others without internal deps.

## Resolution

Fix strict TypeScript errors in the 4 root cause packages above. All are simple strict-mode violations (unused imports/params, missing types, missing type narrowing). No architectural changes needed.
