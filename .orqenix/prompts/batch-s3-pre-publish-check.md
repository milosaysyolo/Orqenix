# Agent Prompt: Batch S3 — Pre-publish Validation

## Role
You are the Orqenix Release Setup Agent, Batch S3 executor. Your job is to build a comprehensive deterministic validation script that gates publish attempts.

## Context
- Repo: github.com/milosaysyolo/Orqenix (OSS) or Orqenix-Pro
- Working directory: repo root
- Outputs: scripts/pre-publish-check.ts + supporting modules + unit tests
- Discovery counts so far: 61 OSS publishable, 10 Pro publishable
- Critical concern from Batch S2 review: package count discrepancy (memory expected 27 OSS / 7 Pro)

## Inputs
- .orqenix/release-policy.yaml
- .orqenix/discovery-report.json
- packages/*/package.json (post-normalization)

## Tasks

### Task 1: Build pre-publish-check.ts orchestrator
Create scripts/pre-publish-check.ts that:
1. Loads release-policy.yaml
2. Loads all packages (via discovery)
3. Runs 24 checks in parallel where independent
4. Outputs JSON report to .orqenix/pre-publish-report.json
5. Outputs human-readable summary to stdout
6. Exits 0 if all blocking checks pass, 1 otherwise
7. Supports --json-only flag (no stdout text, only JSON for CI)
8. Supports --check <name> flag to run single check
9. Supports --allow-warn flag (treats warnings as info, not fail)

### Task 2: Implement 24 atomic checks
Each check is a TypeScript file under scripts/checks/. Each exports a Check object with:
- id: string (e.g., "C01-git-clean")
- severity: "blocking" | "warning" | "info"
- description: string
- run(context): Promise<CheckResult>

### Task 3: Address Batch S2 review concerns
Specifically implement:
- C09: publishability-confirmation (whitelist subset OR confirm all)
- C10: cross-scope-deps-resolved (workspace:* must be resolvable)
- C11: orphan-license-detection
- C12: readme-content-quality

### Task 4: Unit tests
Each check must have a unit test in scripts/checks/__tests__/. Use vitest.
Total target: 50+ test cases, covering happy path, failure modes, edge cases.

### Task 5: Documentation
- docs/operator-guide/pre-publish-check.md: human-readable guide
- scripts/checks/README.md: index of all checks with severity and rationale

## Constraints
- No actual publish, no npm calls that mutate state
- Each check must be < 5 seconds to run (parallelizable)
- Total runtime target: < 60 seconds for full repo
- No external API calls except npm registry read

## Deliverables
1. Branch: release-setup/batch-s3
2. Commit messages:
   - "feat(release): add pre-publish-check orchestrator [Batch S3]"
   - "feat(release): add 24 deterministic checks [Batch S3]"
   - "test(release): add unit tests for pre-publish checks [Batch S3]"
   - "docs(release): add pre-publish-check operator guide [Batch S3]"
3. PR title: "feat(release): add pre-publish validation (Batch S3)"

## Validation Before Commit
- pnpm vitest run scripts/checks/ (all pass)
- pnpm tsx scripts/pre-publish-check.ts --json-only (valid JSON)
- pnpm tsx scripts/pre-publish-check.ts (human-readable output)
- Manual test: all checks complete < 60s

## Stop Conditions
Stop and ask human if:
- Any check requires write access to npm registry (only read allowed)
- Any check requires real credentials (only env var detection allowed)
- Check duration exceeds 60s for repo with 100 packages
