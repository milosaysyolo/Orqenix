# Lockfile Autofix Bot and Guard

## What it does

When a PR modifies `package.json`, `pnpm-lock.yaml`, `.npmrc`, or any workspace `package.json`, three workflows coordinate:

1. **Lockfile Guard** (read-only) verifies `pnpm-lock.yaml` is in sync with `package.json` and the `onlyBuiltDependencies` allowlist is unchanged.
2. **Lockfile Autofix Bot** (write, conditional) automatically regenerates and pushes a fix commit when drift is detected on same-repo PRs.
3. **Manual Lockfile Sync** (workflow_dispatch fallback) lets maintainers regenerate the lockfile from the GitHub Actions UI with full cross-repo (OSS + Pro) checkout.

## Important: ignore-scripts policy distinction

The repo has 2 distinct install modes with different `ignore-scripts` requirements:

| Mode                  | Where used                                                               | `ignore-scripts`                                       | Why                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`--lockfile-only`** | Lockfile Guard, Lockfile Autofix, Manual Lockfile Sync, sync-lockfile.sh | `true` (default + enforced via env)                    | Only resolves dependency tree and writes `pnpm-lock.yaml`. Does NOT install native modules or run install scripts. Safe and fast.                  |
| **Full install**      | CI test matrix, Phase 5 Baseline, Cross-Repo Integration                 | `false` (explicit via `--config.ignore-scripts=false`) | Needs to build native bindings (better-sqlite3, sharp, zstd, etc.) for tests to load `.node` files. Allowlist enforces which deps may run scripts. |

**Do not** change lockfile workflows to `--config.ignore-scripts=false`. They run with `--lockfile-only` which does not install or build anything. Adding the flag would slow down sync without any safety benefit.

**Do not** change CI/Baseline workflows to `ignore-scripts=true` at install time. They need native bindings; the `onlyBuiltDependencies` allowlist is what provides safety.

## Canonical allowlist (Phase 5)

Defined in 2 places that MUST match:

1. Root `package.json` field `pnpm.onlyBuiltDependencies`
2. `scripts/release/verify-only-built-deps.mjs` constant `EXPECTED_ALLOWLIST`

Current canonical set:

- `@mongodb-js/zstd` (storage-diff zstd compression)
- `@swc/core` (build tooling)
- `better-sqlite3` (Phase 5 SQLite storage)
- `esbuild` (build tooling)
- `sharp` (embedding-local image preprocessing)

If you need to add a native dep: update BOTH files in the same commit. CI will refuse to merge if they drift.

## Security model

- **Same-repo PRs**: Bot regenerates lockfile and pushes a commit signed as `orqenix-autofix[bot]`. Diff is restricted to `pnpm-lock.yaml` only; any other file modification aborts the autofix.
- **Fork PRs**: Bot does NOT push by default. Instead, it comments instructions for the contributor to fix locally. Maintainers can opt-in by setting repo variable `ALLOW_FORK_AUTOFIX=true` (not recommended without manual diff review).
- **Race protection**: Bot verifies the PR head SHA matches the SHA that triggered the guard. If the PR was updated mid-flight, autofix aborts cleanly.
- **Script integrity**: Bot runs `sync-lockfile.sh` with `NPM_CONFIG_IGNORE_SCRIPTS=true`, preventing any package install scripts from executing during lockfile regeneration.
- **Allowlist enforcement**: After sync, `verify-only-built-deps.mjs` confirms `pnpm.onlyBuiltDependencies` matches the canonical set exactly. Drift (either missing or extra) blocks merge.

## When autofix will NOT run

- PR is from a fork and `ALLOW_FORK_AUTOFIX` is not enabled
- PR head SHA moved during the guard-to-autofix handoff
- Sync would modify files other than `pnpm-lock.yaml`
- `packageManager` field is missing in root `package.json`
- `pnpm.onlyBuiltDependencies` drifted from canonical set

In all of these cases, the bot posts a comment explaining what happened and how to fix manually.

## Manual fix (fallback)

```bash
pnpm run lockfile:sync
git add pnpm-lock.yaml
git commit -m "chore: sync pnpm-lock.yaml"
git push
```

Or trigger from GitHub UI: Actions tab > Manual Lockfile Sync > Run workflow.

## Disabling the bot

To disable autofix entirely, delete `.github/workflows/lockfile-autofix.yml`. `lockfile-guard.yml` will still block bad PRs from merging.
