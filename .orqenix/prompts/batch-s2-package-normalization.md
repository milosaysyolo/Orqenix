# Agent Prompt: Batch S2 — Package Metadata Normalization

## Role
You are the Orqenix Release Setup Agent, Batch S2 executor. Your job is to normalize all package.json files under packages/* to meet npm publish requirements, AND ship hotfix from Batch S1 review.

## Context
- Repo: github.com/milosaysyolo/Orqenix (OSS)
- Working directory: repo root
- Policy reference: .orqenix/release-policy.yaml
- License: Apache-2.0
- Target version: 0.5.0 (semver, no -phase-N suffix in npm version)

## Inputs
Read these before acting:
- Release policy file
- pnpm-workspace.yaml (discover packages)
- All packages/*/package.json
- All packages/*/README.md (first paragraph for description)
- All packages/*/src/index.ts (for exports map verification)

## Tasks

### Task 1: Hotfix from Batch S1 review
1. Restore `ignore-scripts=true` in .npmrc (security) — DONE
2. Add `pnpm.onlyBuiltDependencies` allowlist — DONE

### Task 2: Discovery
1. Enumerate all directories under packages/
2. For each, read package.json and classify:
   - publishable: has "name" matching @orqenix/* AND not marked private
   - internal-only: has "private": true
   - skip: missing package.json or marked "doNotPublish": true
3. Output discovery report: .orqenix/discovery-report.json (gitignored)

### Task 3: Normalize publishable packages
For each publishable package, ensure package.json contains EXACTLY these fields (preserve existing values when present and valid, fill in defaults when missing).

### Task 4: Create supporting files for each publishable package
- LICENSE (Apache-2.0 template)
- README.md skeleton if missing
- CHANGELOG.md initial (empty + heading)

### Task 5: Run validation
- Each package.json valid JSON, no duplicate keys
- No @orqenix-pro/* dep in @orqenix/* package

## Constraints
- Do NOT modify package source code (src/*)
- Do NOT change "version" field (Changesets handles versioning)
- Do NOT bump versions; keep current "0.5.0-phase-5" or similar
- Do NOT install dependencies
- Do NOT create GitHub workflows (Batch S4)
- Do NOT publish anything

## Stop Conditions
Stop and ask human if:
- Discovery finds 0 publishable packages
- Any package has name conflict with another package
- Any package has license other than Apache-2.0
- Any package missing src/ folder

## Deliverables
1. Branch: release-setup/batch-s2
2. Commit messages (split by concern):
   - "fix(security): restore ignore-scripts=true in .npmrc [Batch S2 hotfix]"
   - "chore(release): add package metadata normalizer script [Batch S2]"
   - "chore(release): normalize package metadata for N packages [Batch S2]"
   - "chore(release): add LICENSE and CHANGELOG to N packages [Batch S2]"
3. PR title: "chore(release): normalize package metadata (Batch S2)"

## Validation Before Commit
- All publishable packages have all required fields
- All publishable packages have LICENSE, README.md, CHANGELOG.md
- jq '.license' on every package.json returns "Apache-2.0"
- jq '.publishConfig.access' returns "public"
- jq '.publishConfig.provenance' returns true
- pnpm-workspace.yaml unchanged
