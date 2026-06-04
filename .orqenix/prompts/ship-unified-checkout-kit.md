# Agent Task: Ship Unified Cross-Repo Checkout Kit

## Mission

Apply the Unified Cross-Repo Checkout Kit to milosaysyolo/Orqenix (OSS repo).
This kit ships the credential handling policy, the reusable composite
action, updated workflows, and the policy guard.

## Pre-flight (verify before starting)

1. You are operating in milosaysyolo/Orqenix repo, branch `main`.
2. Commit cc8f5d3 (P0 + P1 partial) is HEAD.
3. The user wants 4 outcomes:
   a. Lockfile Guard stays GREEN
   b. Cross-Repo Integration stays GREEN
   c. CI and Phase 5 Baseline come back to GREEN (currently RED from path: ../Orqenix-Pro issue)
   d. New Policy Credential Guard runs GREEN on the rollout commit

## Constraints (do not violate)

1. DO NOT change npm scope, package names, or version numbers.
2. DO NOT publish to npm during this task.
3. DO NOT bypass allowlist verifier.
4. DO NOT use `actions/checkout@v4` with `path: ../*` (it is rejected by GitHub).
5. DO NOT change Pro ref in cross-repo-refs.json without explicit user approval.
6. DO NOT modify any workspace package.json.
7. DO NOT remove backup files in .orqenix/backups/.

## Step 1: Create kit files

Create the following files verbatim from the deliverable spec at
docs/hotfix/unified-checkout-kit-2026-06-04.md:

1. `.orqenix/policy/credential-handling.md`
2. `.orqenix/cross-repo-refs.json` (v1.1.0 with oss + cloud placeholders)
3. `.orqenix/schemas/cross-repo-refs.schema.json` (updated for v1.1.0)
4. `.orqenix/prompts/diagnose-ci-charter-and-release-oss.md`
5. `.orqenix/prompts/commit-message-unified-checkout.txt`
6. `.github/actions/checkout-orqenix-repo/action.yml`
7. `.github/workflows/policy-credential-guard.yml`
8. Replace `.github/workflows/manual-lockfile-sync.yml`
9. Replace `.github/workflows/lockfile-autofix.yml`
10. Replace `scripts/ci/align-pro-checkout.mjs`
11. New `scripts/ci/ship-unified-checkout-kit.sh` (chmod +x)

## Step 2: Patch existing workflows

Run:

```bash
node scripts/ci/align-pro-checkout.mjs
```

Expected: ci.yml, phase5-baseline.yml, cross-repo-integration.yml all
patched to use composite action. If 0 files patched, manually inspect
each workflow that references Orqenix-Pro and apply the composite action
call from the spec.

## Step 3: Validate locally

```bash
bash scripts/ci/ship-unified-checkout-kit.sh
```

If any step fails, STOP and report. Do not proceed to commit.

## Step 4: Commit and push

```bash
git add .orqenix .github scripts
git commit -F .orqenix/prompts/commit-message-unified-checkout.txt
git push origin main
```

## Step 5: Monitor CI

Wait for the following workflows to complete on the push commit:

| Workflow | Expected | Action if fails |
|----------|----------|-----------------|
| Policy Credential Guard | GREEN | If RED, inspect violation, fix, re-push |
| Lockfile Guard | GREEN | If RED, run lockfile sync via Manual Lockfile Sync workflow |
| Cross-Repo Integration | GREEN | If RED, check composite action verify-paths step |
| CI | GREEN | If RED, check sibling layout; Pro clone target must be next to GITHUB_WORKSPACE |
| Phase 5 Baseline | GREEN | Same as CI |

## Step 6: Report

Create `.orqenix/reports/unified-checkout-rollout-2026-06-04.md`:

```markdown
## Unified Checkout Kit Rollout

Commit: <sha>
Date: <ISO date>

### Files Shipped
<list with action: created/replaced/patched>

### CI Results
<table with workflow + result + link>

### Issues Encountered
<any deviations from spec, polished decisions>

### Follow-Up
<link to ci-charter and release-oss diagnose prompt>
```

## Denied Actions

- Do not push to any branch other than the configured target.
- Do not create new secrets.
- Do not request changes to GitHub repo settings (only files in repo).
- Do not skip the policy guard check.
- Do not modify the composite action `action.yml` without re-running
  the policy guard locally.

## Escalation

If any step fails twice in a row with the same error, STOP, capture
full output, and report to the user. Do not retry beyond 2 attempts
per step.
