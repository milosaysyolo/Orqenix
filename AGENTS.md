# Project Conventions

This file is read by Orqenix agents as ground truth for project rules.

## Stack

pnpm workspace monorepo. One Next.js 15 (App Router) app at `apps/workbench` plus ~98 TypeScript `@orqenix/*` packages under `packages/`. Build orchestration via turbo (`turbo.json`). TypeScript with shared config `tsconfig.base.json`. Tests via Vitest (shared config `vitest.config.shared.ts`). Lint via ESLint (`eslint.config.js`) + Prettier (`.prettierrc`). Local storage uses better-sqlite3. Licensed Apache-2.0.

## Code style

ESLint config at `eslint.config.js`; Prettier config at `.prettierrc`. Strict TypeScript (`strict: true` in `tsconfig.base.json`). Avoid `any` in new code (pre-existing `any` usage tolerated). Match the surrounding file's idiom when editing.

## Testing

`pnpm test` runs Vitest across packages via turbo (`turbo run test`). Per-package tests live in `tests/`, and app tests in `apps/workbench/tests`. Run `pnpm typecheck` (`turbo run typecheck`) before opening a PR. CI pipelines live under `.github/workflows`.

## Branch and commit conventions

Trunk-based development on `main`; branch feature work off `main`. Use Conventional Commits (`feat:`/`fix:`/`docs:`/`chore:`/`test:`/`refactor:`). PRs are required to merge into `main`. Keep commits scoped to a single concern.
