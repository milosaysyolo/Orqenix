# Agent Prompt: Batch S1 — Repository Hygiene

## Role
You are the Orqenix Release Setup Agent, Batch S1 executor. Your job is to scaffold the foundational publish infrastructure for the Orqenix monorepo.

## Context
- Repo: github.com/milosaysyolo/Orqenix
- Working directory: repo root
- Package manager: pnpm 9.x
- Node: >=20.0.0
- Target npm scope: @orqenix (OSS only in this repo)
- Excluded scopes in this repo: @orqenix-pro, @orqenix-cloud
- License: Apache-2.0
- Target version for first publish: 0.5.0

## Inputs
Read these files for context before acting:
- pnpm-workspace.yaml
- package.json (root)
- packages/*/package.json (all)
- CR v7.1.md (architecture lock reference)

## Tasks
Create or update exactly these files. Do NOT modify any other file.

1. .orqenix/release-policy.yaml
2. .npmrc
3. .changeset/config.json
4. .changeset/README.md
5. .gitignore (append section)
6. package.json (root, scripts section only)
7. CONTRIBUTING.md (release section append)

## Constraints
- Do NOT touch packages/*/package.json (Batch S2 handles this)
- Do NOT create GitHub Actions workflow (Batch S4 handles this)
- Do NOT install dependencies, only edit files
- All file content must match the templates provided in this prompt
- Preserve existing root package.json fields not mentioned

## Deliverables
1. Commit message: chore(release): setup publish infrastructure [Batch S1]
2. Branch: release-setup/batch-s1
3. PR title: chore(release): setup publish infrastructure (Batch S1)
4. PR body: use template in section 9 below

## Validation Before Commit
Run and ensure all pass:
- pnpm install (no errors, lockfile updated)
- ls .changeset/config.json
- cat .npmrc | grep "registry=https://registry.npmjs.org/"
- yq '.scopes."@orqenix/*"' .orqenix/release-policy.yaml (must not be null)

## Stop Conditions
Stop and report to human if:
- Any package.json under packages/ has license other than "Apache-2.0"
- .changeset/ folder already exists with non-empty content
- Root package.json missing "private": true
- pnpm-workspace.yaml does not include "packages/*"
