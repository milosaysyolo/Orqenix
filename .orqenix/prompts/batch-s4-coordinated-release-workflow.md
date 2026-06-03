# Agent Prompt: Batch S4 — Coordinated Release Workflow

## Role
You are the Orqenix Release Setup Agent, Batch S4 executor. Ship coordinated GitHub Actions workflows to publish OSS and Pro safely, with manual trigger for Pro on first publish (safety first).

## Context
- OSS repo: github.com/milosaysyolo/Orqenix
- Pro repo: github.com/milosaysyolo/Orqenix-Pro
- Whitelist (Milo-reviewed): OSS 27 packages, Pro 7 packages
- Cross-scope deps: 26 workspace:* deps from Pro to OSS (must convert before Pro publish)
- First publish strategy: Publish OSS, verify manually, then trigger Pro manually
- After first publish: Anh can enable auto-trigger by changing default

## Tasks

### OSS Repo Files (apply in github.com/milosaysyolo/Orqenix)
1. .github/workflows/release.yml
2. .github/workflows/pre-flight.yml
3. .github/workflows/trigger-pro.yml
4. .github/actions/wait-for-npm/action.yml
5. .orqenix/schemas/pre-publish-report.schema.json
6. .orqenix/schemas/release-trigger.schema.json
7. docs/operator-guide/first-publish-runbook.md
8. .orqenix/prompts/batch-s4-coordinated-release-workflow.md (this file)

### Pro Repo Files (apply in github.com/milosaysyolo/Orqenix-Pro)
1. .github/workflows/release.yml
2. .github/workflows/pre-flight.yml
3. .github/actions/wait-for-npm/action.yml
4. scripts/convert-cross-scope-deps.ts
5. scripts/__tests__/convert-cross-scope-deps.test.ts
6. .orqenix-pro/schemas/pre-publish-report.schema.json
7. .orqenix-pro/prompts/batch-s4-coordinated-release-workflow.md

## Constraints
- trigger_pro_after default = false (anh manual trigger for first publish)
- NPM_TOKEN never logged (use ::add-mask:: where needed)
- Coordinator PAT scoped minimum (contents:write + actions:write on both repos)
- Concurrency control prevents two simultaneous releases
- All workflow files must pass actionlint
- All scripts must have unit tests
- No actual publish in this PR (dry-run only)
- Pro release.yml accepts both repository_dispatch and workflow_dispatch
- workflow_dispatch in Pro accepts manual oss_version input

## Deliverables
- Branch (both repos): release-setup/batch-s4
- Commit messages:
  - "ci(release): add OSS release workflow [Batch S4]"
  - "ci(release): add PR pre-flight workflow [Batch S4]"
  - "ci(release): add manual Pro trigger workflow [Batch S4]"
  - "ci(release): add wait-for-npm composite action [Batch S4]"
  - "feat(release): add cross-scope dep converter script [Batch S4]"
  - "docs(release): add first-publish runbook [Batch S4]"

## Validation Before Commit
- actionlint on all .github/workflows/*.yml
- pnpm vitest run scripts/__tests__/convert-cross-scope-deps.test.ts (Pro)
- jq . on all .orqenix/schemas/*.json (valid JSON)
- Sample payload validates against release-trigger.schema.json
- Manual review: no NPM_TOKEN echoed in step outputs

## Stop Conditions
Stop and ask Milo if:
- .github/workflows/ already contains a release.yml with different structure
- Required secrets are missing (NPM_TOKEN, ORQENIX_COORDINATOR_PAT)
- Whitelist file missing
- pre-publish-check.ts not yet in repo (Batch S3 prerequisite)
