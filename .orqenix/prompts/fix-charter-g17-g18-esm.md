# Agent Task: Charter G17/G18 ESM loader + G21 .orqenix dir

## Context

Charter is 15/21. G17/G18 correctly delegate to Phase 5 gate runners but
run them via `pnpm exec tsx`, whose CJS shim cannot require() the ESM-only
@orqenix/storage-sqlite (type:module) -> MODULE_NOT_FOUND. G21 (CLI smoke)
fails because the temp dir lacks a .orqenix/ directory for the SQLite DB.

Confirmed from packages/cli/src/bin.ts: DB path is
ORQENIX_DB ?? <cwd>/.orqenix/kb.sqlite. better-sqlite3 creates the .sqlite
file but NOT the parent dir.

## Goal

G17/G18 GREEN via ESM loader; G21 GREEN via .orqenix mkdir. Charter 15/21 -> 18/21.

## Constraints

1. DO NOT modify packages/cli source or scripts/gates/G17*,G18* runners.
2. Use `node --import tsx/esm <runner>` (Node 22 supports --import).
3. G21 smoke must mkdir .orqenix in the temp dir before DB-backed commands.
4. Leave all other gates untouched.

## Steps

1. charter/run.sh: G17/G18 blocks use `node --import tsx/esm scripts/gates/<runner>.ts`.
2. charter/lib/check-cli-surface.mjs: add mkdirSync(join(tmp, ".orqenix"), {recursive:true}).
3. charter/run.sh G21 block: `pnpm --filter @orqenix/cli build` then `node charter/lib/check-cli-surface.mjs`.
4. Run: bash scripts/ci/verify-g17-g18-fix.sh
5. (Recommended) Full charter in Docker, expect 18/21.
6. Commit + push (message in spec).

## Verify in Docker

```bash
cd Orqenix
docker build -t orqenix-charter -f charter/Dockerfile .
mkdir -p ../charter-hf-cache && chmod 777 ../charter-hf-cache
docker run --rm \
  -v "$(pwd):/repo" -v "$(pwd)/../Orqenix-Pro:/Orqenix-Pro" \
  -v "$(pwd)/../charter-hf-cache:/root/.cache/huggingface" \
  -e ORQENIX_PRO_PATH=/Orqenix-Pro -e CHARTER_VERBOSE=1 \
  orqenix-charter
# Expect: G17 GREEN, G18 GREEN, G21 GREEN -> Charter Result: 18/21 GREEN
```

## Denied Actions

- Do not touch CLI source or gate runners.
- Do not use pnpm exec tsx for ESM-only deps.
- Do not skip gates or change Pro ref / mount mode.

## Report

Write .orqenix/reports/charter-g17-g18-g21-esm-fix-2026-06-04.md with
gate-by-gate before/after and the docker Charter Result line.
