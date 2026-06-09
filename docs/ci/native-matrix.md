# Native Binding CI Matrix (Phase 6)

> **Charter gate:** G41
> **Spec:** CR v7.2 Chapter 8
> **Workflow:** `.github/workflows/native-matrix.yml`
> **Smoke:** `scripts/ci/native-matrix/smoke.mjs`

This matrix proves that the three native modules Orqenix relies on (`better-sqlite3`, `blake3-wasm`, `sqlite-vec`) install, load, and execute correctly across the supported OS x arch x Node combinations.

## Scope

The matrix applies **only** to:

- `better-sqlite3`
- `blake3-wasm`
- `sqlite-vec`

The matrix does **not** apply to libp2p. Per CR v7.2 decision D1, Phase 6 uses pure JavaScript libp2p (`js-libp2p`), so libp2p has no native binaries to build.

## Tier 1, required (blocking)

| OS x arch       | Node 22       | Node 24       | Rationale                                           |
|-----------------|---------------|---------------|-----------------------------------------------------|
| `darwin-arm64`  | required      | required      | Primary developer machine (Apple Silicon)           |
| `linux-x64-gnu` | required      | required      | Standard CI runner and the vast majority of servers |
| `win32-x64`     | required      | required      | Windows developer surface, where native bugs hide   |

Total: **6 blocking jobs**. Any failure blocks merge.

## Tier 2, informational (`continue-on-error: true`)

| OS x arch          | Node 22         | Node 24         | Rationale                                |
|--------------------|-----------------|-----------------|------------------------------------------|
| `darwin-x64`       | informational   | informational   | Intel Mac, declining footprint           |
| `linux-arm64-gnu`  | informational   | informational   | ARM servers (Graviton and similar)       |

Total: **4 non-blocking jobs**. Failures produce a workflow warning but do not block merge.

## Deferred matrix (recorded, not implemented in Phase 6)

The following combinations are deliberately deferred. They are **not silently dropped**:

- `linux-x64-musl` (Alpine)
- `linux-arm64-musl`
- `win32-arm64`
- `freebsd`
- `android`
- `ios`
- `wasm`

Revisit when a concrete user request or production deployment requires one of them.

## Node version policy

| Version  | Phase 6 status   | Reason                                       |
|----------|------------------|----------------------------------------------|
| Node 20  | dropped          | Approaching EOL around April 2026            |
| Node 22  | supported (LTS)  | Current LTS, primary target                  |
| Node 24  | supported        | Current stable release, future-proofing      |

## What each job does

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` with version 9
3. `actions/setup-node@v4` with `cache: pnpm`
4. `actions/cache@v4` for the pnpm store keyed by `os_label + node + hash(pnpm-lock.yaml)`
5. `pnpm install --frozen-lockfile`
6. `node --experimental-vm-modules scripts/ci/native-matrix/smoke.mjs`

The smoke script exercises:

- **`better-sqlite3`**: opens a file DB in a tempdir, enables WAL and `foreign_keys = ON`, creates a STRICT table, transactions an insert, runs a select, asserts the result.
- **`blake3-wasm`**: hashes `UTF-8("orqenix-phase-6-native-matrix")` and compares against the committed fixture digest. The digest is pinned so a regression in `blake3-wasm` is detected.
- **`sqlite-vec`**: creates a `vec0` virtual table with `dim=384`, inserts 4 deterministic vectors, runs a `MATCH k=2` query, asserts the top two rowids in the expected order.

## Opting a deferred combination in

1. Add an entry to the `matrix.include` list in `.github/workflows/native-matrix.yml` with the desired `tier`, `os_label`, `runner`, and `node`.
2. If the combination needs additional toolchain setup (musl, cross-compile), document it in this file under a new section.
3. Run the G41 gate locally to confirm the workflow still parses and the counts still match the expected values:
   ```bash
   node --import tsx scripts/gates/G41-native-matrix.ts
   ```
4. If you intentionally change the Tier-1 or Tier-2 counts, update the G41 gate's expected values at the same time. Both the spec (CR v7.2 Chapter 8) and the gate must agree.

## Skipping the local smoke from the gate runner

Set `SKIP_LOCAL_SMOKE=1` when running the gate on a machine that lacks a native build toolchain (some sandboxed environments). The workflow-shape checks still run and still enforce all five criteria; only the local execution step is skipped.

## Caveats

- The `linux-arm64-gnu` runner (`ubuntu-22.04-arm`) is GitHub-hosted and may have variable availability. Tier-2 `continue-on-error: true` protects merge velocity.
- The fixture digest for `blake3-wasm` is committed once. If you intentionally bump the `blake3-wasm` dependency to a version with a different output for the same input (which would be a serious regression in the library, not a normal update), update the fixture by computing the new digest locally and pasting it back into `scripts/ci/native-matrix/fixtures/blake3-known.json`.
