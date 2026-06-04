# Agent Task: Ship Phase B (CI charter Docker + Release OSS Recovery)

## Mission

Apply Phase B recovery to milosaysyolo/Orqenix. Phase A (composite action + policy) already shipped. Phase B fixes 2 RED workflows:

1. CI charter (Docker) — caused by broken `$@` shell expansion in git clone
2. Release OSS — caused by skeleton workflow without real publish logic

After this task, expected status:

- CI charter Docker: GREEN
- Release OSS: GREEN on dry-run; on tag push, publishes to npm with provenance
- All other workflows: stay GREEN

## Pre-flight

1. Confirm Phase A composite action exists:
   ```bash
   ls -la .github/actions/checkout-orqenix-repo/action.yml
   ```

If missing, STOP and report.

2. Confirm cross-repo-refs.json v1.1.0:

   ```bash
   node -p "require('./.orqenix/cross-repo-refs.json').version"
   ```

   Should print 1.1.0.

3. Confirm policy guard workflow exists:
   ```bash
   ls -la .github/workflows/policy-credential-guard.yml
   ```

## Constraints (do not violate)

1. DO NOT publish to live npm registry. All publish runs must be `--dry-run` until user explicitly approves first publish.
2. DO NOT modify NPM_TOKEN or NPM_TOKEN_PRO secrets.
3. DO NOT change npm package scopes or version numbers.
4. DO NOT remove provenance signing.
5. DO NOT change `ORQENIX_COORDINATOR_PAT` secret name.
6. DO NOT delete the broken `ORQENIX_PRO_READ_TOKEN` references without confirming no other workflow needs it.
7. MUST follow `.orqenix/policy/credential-handling.md`.
8. MUST use composite action `.github/actions/checkout-orqenix-repo` for any Pro checkout.

## Step 1: Replace charter.yml

Replace `.github/workflows/charter.yml` entirely with the Phase B spec content.

Verify:

```bash
grep -c "x-access-token" .github/workflows/charter.yml
# Should be 0 (composite action handles auth internally)

grep -c "ORQENIX_COORDINATOR_PAT" .github/workflows/charter.yml
# Should be 1 (unified token)
```

## Step 2: Replace ci.yml

Replace `.github/workflows/ci.yml` entirely with the Phase B spec content.

Verify:

```bash
grep -c "actions/checkout@v4" .github/workflows/ci.yml
# Should be 2 (OSS in test job + OSS in charter job)

grep -c "checkout-orqenix-repo" .github/workflows/ci.yml
# Should be 2 (composite action used in both jobs for Pro)

grep -c "path: \.\./Orqenix-Pro" .github/workflows/ci.yml
# Should be 2 (composite action input, NOT raw actions/checkout)
```

## Step 3: Replace release.yml

Replace `.github/workflows/release.yml` entirely with the Phase B spec content (full publish pipeline).

Verify:

```bash
grep -c "changesets/action" .github/workflows/release.yml
# Should be 1 (real publish action)

grep -c "provenance" .github/workflows/release.yml
# Should be at least 1 (provenance signing enabled)
```

## Step 4: Create helper scripts

Create the following if they don't exist:

```bash
mkdir -p scripts/release scripts/release/checks
# Create scripts/release/run-prepublish-checks.mjs from spec
# Create scripts/release/convert-cross-scope-deps.mjs from spec
```

## Step 5: Update cross-repo-refs.json consumers

Update `.orqenix/cross-repo-refs.json` "consumers" array to include release.yml and charter.yml. Do not remove any existing entries.

## Step 6: Validate locally

```bash
# Lint YAML
pnpm exec prettier --check .github/workflows/charter.yml .github/workflows/ci.yml .github/workflows/release.yml

# Run policy guard locally (mimics CI)
grep -rn "git clone.*://[a-zA-Z0-9_]\+:" .github/workflows/ .github/actions/ | grep -v "checkout-orqenix-repo/action.yml"
# Should output nothing (no token-injected URLs outside composite action)

# Verify allowlist still passes
node scripts/release/verify-only-built-deps.mjs

# Verify Pro ref reader works
node scripts/ci/get-pro-ref.mjs --validate
```

If any check fails, STOP and report.

## Step 7: Commit and push

```bash
git add .github/workflows/charter.yml
git add .github/workflows/ci.yml
git add .github/workflows/release.yml
git add scripts/release/run-prepublish-checks.mjs
git add scripts/release/convert-cross-scope-deps.mjs
git add .orqenix/cross-repo-refs.json

git commit -m "fix(ci): recover CI charter (Docker) and Release OSS workflows

CI charter (Docker):
- Replace broken git clone with composite action
  (variable expansion \$PRO_TOKEN was corrupted to \$@, causing auth fail)
- Unify token to ORQENIX_COORDINATOR_PAT (was ORQENIX_PRO_READ_TOKEN)
- Stage Pro at workspace path for Docker volume mount safety
- Charter job in ci.yml now runs only on push to main

Release OSS:
- Replace skeleton workflow with full publish pipeline
- Add pre-flight validation (NPM_TOKEN, lockfile, allowlist, changesets)
- Add build-and-verify with native rebuild and tests
- Use changesets/action@v1 for version + publish with SLSA provenance
- Add post-publish smoke test (install from npm + verify import)
- Preserve original notify logic with safer JSON parsing
- Default dry_run=true on workflow_dispatch for safety

Adds:
- scripts/release/run-prepublish-checks.mjs (stub, runs C01-C24 if present)
- scripts/release/convert-cross-scope-deps.mjs (file: link to npm version)
- cross-repo-refs.json consumers list updated

No npm publish triggered by this commit; first real publish still requires
manual workflow_dispatch with dry_run=false."

git push
```

## Step 8: Verify CI on push commit

Monitor:

| Workflow                 | Expected after this push                                             |
| ------------------------ | -------------------------------------------------------------------- |
| Lockfile Guard           | GREEN (unchanged by this PR)                                         |
| Cross-Repo Integration   | GREEN (uses composite action)                                        |
| CI (test matrix)         | GREEN (composite action)                                             |
| CI (charter Docker job)  | GREEN (composite action + cp staging)                                |
| Phase 5 Baseline         | GREEN (unchanged)                                                    |
| Policy Credential Guard  | GREEN (no policy violations)                                         |
| Release OSS              | GREEN as dry-run (no .changeset/\*.md files)                         |
| Charter (Phase 4 weekly) | Will run on Monday cron, OR can be triggered manually for smoke test |

## Step 9: Manual smoke test of Release OSS

After CI green:

```bash
gh workflow run release.yml -f dry_run=true -f skip_charter_gates=false
```

Verify it runs through all 5 jobs (pre-flight, build-and-verify, no publish because dry_run, no notify because nothing published).

## Step 10: Report

Create `.orqenix/reports/phase-b-recovery-2026-06-04.md` with:

- Files changed
- CI results
- Smoke test result
- Outstanding items (e.g., first live publish still pending user approval)

## Denied Actions

- Do not run `gh workflow run release.yml -f dry_run=false` without explicit user approval.
- Do not change provenance signing to optional.
- Do not modify .changeset/ contents.
- Do not pin pnpm to a version other than what packageManager field specifies.
- Do not bypass charter gates (skip_charter_gates=true) without explicit user approval.

## Escalation

If charter Docker build fails (e.g., charter/Dockerfile missing or broken), STOP and report. Phase A unblocked everything else; charter Dockerfile is independent and may need separate fix.

If Release OSS pre-flight fails because no changesets exist, that's expected on first run after this fix. The workflow will just exit cleanly with `verdict=no-go`, not RED.
