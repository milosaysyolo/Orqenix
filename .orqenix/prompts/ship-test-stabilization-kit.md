# Agent Task: Ship Test Stabilization Kit (Fix A+B+C)

## Mission

Stabilize the Orqenix CI so the test matrix and integration jobs are
consistently green, and decouple charter from test flakes.

After this task:
- CI test matrix: 6/6 GREEN consistently (no HuggingFace 429 flakes)
- Cross-Repo Integration: 6/6 GREEN consistently
- Charter: runs independently on push + weekly cron (no cascade SKIP)

## Constraints

1. DO NOT skip or .skip any test.
2. DO NOT weaken test assertions.
3. DO NOT remove the composite action github.action_path auto-detect.
4. DO NOT reintroduce secrets.* into the composite action.
5. DO NOT change the model ID (Xenova/all-MiniLM-L6-v2 is correct).
6. Charter Dockerfile fix is OUT OF SCOPE (separate session).

## Step 1: Fix A (HuggingFace 429)

1. Create packages/embedding-local/scripts/warm-hf-cache.mjs (from spec).
2. Add "warm-cache" script to packages/embedding-local/package.json.
3. In ci.yml test job, add: Cache HuggingFace models step, Warm cache step,
   and set HF_HUB_OFFLINE=1 + TRANSFORMERS_OFFLINE=1 on the Test step.
4. Apply same 3 changes to integration.yml (adjust working-directory to
   layout/Orqenix).

## Step 2: Fix B (semantic-cache race)

1. Create/update packages/plugin-semantic-cache/vitest.config.ts with
   singleThread + retry:3 + isolate + 15s timeouts.
2. Create .orqenix/prompts/diagnose-semantic-cache-race.md for later
   root-cause work.

## Step 3: Fix C (charter decouple)

1. Replace .github/workflows/charter.yml to trigger on push + cron +
   workflow_dispatch, with explicit Resolve Pro ref step.
2. Remove the charter job entirely from .github/workflows/ci.yml.
   ci.yml should contain only the test job after this.

## Step 4: Verify

```bash
bash scripts/ci/verify-test-stabilization.sh
```

If any check fails, STOP and report.

## Step 5: Commit and push

```bash
git add packages/embedding-local/scripts/warm-hf-cache.mjs
git add packages/embedding-local/package.json
git add packages/plugin-semantic-cache/vitest.config.ts
git add .github/workflows/ci.yml
git add .github/workflows/charter.yml
git add .github/workflows/integration.yml
git add .orqenix/prompts/diagnose-semantic-cache-race.md
git add scripts/ci/verify-test-stabilization.sh

git commit -m "fix(ci): test stabilization kit (HF 429 cache, semantic-cache race, charter decouple)

Fix A (HuggingFace 429): cache Xenova/all-MiniLM-L6-v2 via actions/cache,
warm it once with retry/backoff, then run tests with TRANSFORMERS_OFFLINE=1
so unit tests never hit HuggingFace network. Applied to ci.yml and
integration.yml.

Fix B (semantic-cache race): single-thread the plugin-semantic-cache test
pool, isolate modules, retry:3 as defense-in-depth. Added diagnose prompt
to root-cause and remove retry later.

Fix C (charter decouple): charter moved to its own workflow triggered on
push + weekly cron + manual dispatch, removed charter job from ci.yml so it
is no longer SKIPPED by test-matrix flake cascade.

Note: charter/Dockerfile build issue is a separate follow-up (not this PR)."

git push
```

## Step 6: Monitor

Wait for CI on the push commit. Expect:
- CI test matrix: 6/6 GREEN
- Cross-Repo Integration: 6/6 GREEN
- Charter (Phase 4): runs independently; may still RED if Dockerfile is
  broken (that is the separate follow-up, not a regression from this PR)
- Policy Credential Guard, Phase 5 Baseline, Lockfile Guard: GREEN

## Step 7: Report

Create .orqenix/reports/test-stabilization-2026-06-04.md with:
- Files changed
- CI results (run the matrix 2 to 3 times to confirm flakes are gone)
- Confirmation HuggingFace 429 no longer appears in logs
- Confirmation charter runs independently

## Denied Actions

- Do not modify charter/Dockerfile in this task.
- Do not change model IDs.
- Do not disable any test.
- Do not push directly to a release tag.
