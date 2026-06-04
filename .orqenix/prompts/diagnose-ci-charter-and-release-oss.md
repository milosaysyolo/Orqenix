# Agent Task: Diagnose and Fix CI charter (Docker) and Release OSS workflows

## Context

After P0 + P1 fixes (commit cc8f5d3) and the unified composite action rollout, the following 2 workflows remain RED on `main`:

1. **CI charter (Docker)** - likely tied to Phase 4 charter gates running inside Docker
2. **Release OSS** - npm publish workflow for OSS packages

The ci-repair-report (2026-06-03) labelled both as "pre-existing, not related". This task is to diagnose root cause and apply minimal fix.

## Constraints

1. DO NOT change any other workflow behavior.
2. DO NOT change npm scope (`@orqenix/*` for OSS, `@orqenix-pro/*` for Pro).
3. DO NOT bypass provenance signing.
4. DO NOT relax allowlist verifier.
5. MUST use the new composite action `.github/actions/checkout-orqenix-repo` for any cross-repo checkout.
6. MUST follow `.orqenix/policy/credential-handling.md`.
7. MUST NOT publish anything to npm during diagnosis (use `--dry-run` for any pnpm publish).

## Step 1: Read workflow files

```bash
cat .github/workflows/ci-charter.yml || cat .github/workflows/charter.yml
cat .github/workflows/release-oss.yml
```

Identify:
- Which Docker image is used in CI charter
- Which charter gates run (likely G1 through G17 from Phase 4 plus Phase 5 G18 to G35)
- Which packages are in the OSS publish manifest
- Whether release-oss uses changesets, semantic-release, or manual versioning

## Step 2: Pull latest failure logs

```bash
gh run list --workflow=ci-charter.yml --limit 1 --json databaseId,conclusion,url
gh run view <runId> --log-failed | head -200

gh run list --workflow=release-oss.yml --limit 1 --json databaseId,conclusion,url
gh run view <runId> --log-failed | head -200
```

Capture exact error messages.

## Step 3: Classify failures

For each workflow, identify which category the failure falls into:

### Common CI charter (Docker) failures

| Category | Symptoms | Fix |
|----------|----------|-----|
| Docker image outdated | "node:18-alpine" still pinned but pnpm requires 20+ | Bump image to node:20-bookworm-slim |
| Charter gate path mismatch | Gates importing @orqenix/gate-runner-core | Update gates to use scripts/gates/_gate-runner.ts (per ci-repair) |
| Pro deps not available in Docker | charter-report.md references Pro packages | Add Pro checkout step in Docker job using composite action with layout=sibling |
| Native bindings missing | better-sqlite3 .node missing inside Docker | Add native rebuild step in Docker context with --config.ignore-scripts=false |
| Phase 4 charter still references Phase 4 file paths | gate scripts reference deleted Phase 4 packages | Update gate manifests to Phase 5 paths |

### Common Release OSS failures

| Category | Symptoms | Fix |
|----------|----------|-----|
| NPM_TOKEN missing or expired | "401 Unauthorized" from npm registry | Rotate NPM_TOKEN in repo secrets |
| Provenance signing failure | "OIDC token unavailable" | Ensure `permissions: id-token: write` at job level |
| Package not in publishable whitelist | Pre-publish check (C01-C24) rejects | Add package to .orqenix/release/publishable-whitelist.yaml |
| Pro dep referenced as file: link | "Cannot publish file:../ links" | Use cross-scope conversion script before publish |
| Stale lockfile in release job | ERR_PNPM_OUTDATED_LOCKFILE | Add `--frozen-lockfile` consistency check; run lockfile-guard first |
| Version conflict on npm | "Cannot publish over the previously published version" | Bump version via changesets before publish |

## Step 4: Apply minimal fix

For CI charter, the most likely fix combines:
1. Update gate import path (already done in ci-repair)
2. Add Pro sibling checkout via composite action
3. Bump Docker base image if outdated

For Release OSS, the most likely fix combines:
1. Verify NPM_TOKEN is set
2. Add cross-scope dep conversion step before publish
3. Lockfile guard precondition

Apply minimal patch (1 to 5 lines per workflow). Test with workflow_dispatch on a non-publishing path before merging.

## Step 5: Report

Output a report to `.orqenix/reports/ci-charter-release-oss-recovery-YYYY-MM-DD.md` with:
- Root cause for each workflow
- Diff applied
- Workflow_dispatch test result (link to run)
- Confirmation of green status

## Denied Actions

- Do not publish to npm during diagnosis.
- Do not modify package versions to bypass version conflicts.
- Do not disable provenance signing.
- Do not skip charter gates.
- Do not bypass NPM_TOKEN by using a personal token.
