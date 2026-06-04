# Agent Task: Align Cross-Repo Infrastructure (P1)

## Context

The lockfile infrastructure (lockfile-guard, lockfile-autofix, manual-lockfile-sync) and the post-ci-repair workflows (ci.yml, phase5-baseline.yml, cross-repo-integration.yml) currently have 3 inconsistencies:

1. Cross-repo layout: lockfile workflows use `layout/Orqenix` and `layout/Orqenix-Pro`; CI/Baseline use sibling `Orqenix` and `../Orqenix-Pro`.
2. Pro ref pinning: `v0.5.0-phase-5` is hard-coded in 4 different workflows. Bumping requires touching all 4.
3. Pro checkout style: ci.yml and phase5-baseline.yml use `git clone` with token-injected URL; lockfile workflows use `actions/checkout@v4 with token`. The former can leak credentials in `.git/config` if not explicitly cleaned.

## Goal

Apply 3 alignments in a single PR titled `chore(ci): align cross-repo infrastructure (P1)`.

## Constraints (CRITICAL)

1. DO NOT change behavior of green workflows. After this PR, all currently-green workflows must remain green.
2. DO NOT modify the canonical allowlist in `verify-only-built-deps.mjs` (handled by P0 PR).
3. DO NOT change `--lockfile-only` to full install in any lockfile workflow.
4. Preserve all matrix coverage (OS, Node version).
5. Preserve `ORQENIX_COORDINATOR_PAT` as the secret name.

## Step-by-Step Procedure

### Step 1: Create single source of truth for Pro ref

```bash
mkdir -p .orqenix/schemas scripts/ci
# Create .orqenix/cross-repo-refs.json from provided content
# Create .orqenix/schemas/cross-repo-refs.schema.json from provided content
# Create scripts/ci/get-pro-ref.mjs from provided content
chmod +x scripts/ci/get-pro-ref.mjs
```

### Step 2: Validate

```bash
node scripts/ci/get-pro-ref.mjs --validate
# Expected: [get-pro-ref] OK: ref=v0.5.0-phase-5
```

### Step 3: Replace manual-lockfile-sync.yml

Replace `.github/workflows/manual-lockfile-sync.yml` entirely with the B4 content (uses sibling layout, reads ref from `get-pro-ref.mjs`).

### Step 4: Run align-pro-checkout patch script

```bash
# Create scripts/ci/align-pro-checkout.mjs from provided content
node scripts/ci/align-pro-checkout.mjs
```

Expected output: JSON report of patched files. At minimum:
- `.github/workflows/ci.yml` patched
- `.github/workflows/phase5-baseline.yml` patched

Verify diff:

```bash
git diff .github/workflows/ci.yml | head -60
git diff .github/workflows/phase5-baseline.yml | head -60
```

Each diff should:
- Remove the `git clone --branch v0.5.0-phase-5 ...` step
- Add 2 steps: `Resolve Pro ref` (uses get-pro-ref.mjs) and `Checkout Orqenix-Pro` (uses actions/checkout@v4)

### Step 5: Update package.json scripts

Add the 3 ci:* scripts from B6.

### Step 6: Trigger manual test

After commit + push:

1. Go to Actions tab > Manual Lockfile Sync > Run workflow
2. Use defaults (no pro_ref_override, also_sync_pro=false)
3. Expected: workflow green, no changes (lockfile already in sync from P0 PR)
4. Verify summary shows `Pro ref: v0.5.0-phase-5`

### Step 7: Commit and PR

```bash
git add .orqenix/cross-repo-refs.json
git add .orqenix/schemas/cross-repo-refs.schema.json
git add scripts/ci/get-pro-ref.mjs
git add scripts/ci/align-pro-checkout.mjs
git add .github/workflows/manual-lockfile-sync.yml
git add .github/workflows/ci.yml
git add .github/workflows/phase5-baseline.yml
git add package.json
git add .orqenix/backups/workflows/

git commit -m "chore(ci): align cross-repo infrastructure (P1)

- Add .orqenix/cross-repo-refs.json as single source of truth for Pro ref
- Add scripts/ci/get-pro-ref.mjs reader used by all workflows
- Convert ci.yml and phase5-baseline.yml Pro checkout from git clone
  with token-injected URL to actions/checkout@v4 (safer, auto-cleanup)
- Align manual-lockfile-sync.yml to sibling layout used by CI/Baseline
  (Orqenix and Orqenix-Pro side-by-side, matches integration's
  file:../../Orqenix-Pro/packages/license relative dep)
- Add pro_ref_override input to manual-lockfile-sync for emergency use

Pro ref bumps now require editing 1 file instead of 4.
No behavioral change for already-green workflows.
"
git push
```

## Denied Actions

- DO NOT skip the validation step (Step 2).
- DO NOT remove the backup directory.
- DO NOT modify any workspace `package.json`.
- DO NOT change Pro ref away from `v0.5.0-phase-5` in this PR (use a separate Pro release PR for bumps).
- DO NOT remove existing security guardrails (NPM_CONFIG_IGNORE_SCRIPTS, allowlist verifier).

## Failure Handling

If `align-pro-checkout.mjs` reports 0 files patched, inspect ci.yml and phase5-baseline.yml manually. The regex expects the exact pattern from ci-repair-report; if the actual pattern differs, update the regex or apply the change manually using the same target structure (Resolve Pro ref step + actions/checkout@v4 step).
