# Agent Task: Fix Charter G17/G18 (stale gates, not CLI bugs)

## Context

Charter (Phase 4) Docker workflow is 15/20 GREEN. G17 (detach round-trip)
and G18 (audit tamper detection) are RED.

CONFIRMED via packages/cli/src/commands.ts: these are NOT CLI bugs. The
charter run.sh gates were written for a pre-D5.12 CLI. The Phase 5 CLI has
no `init` (it's `scope init`), no `attach` (detach is one-way), no `audit
append` (audit entries are side-effects), and audit is a SQLite store, not
.orqenix/audit/\*.log flat files.

The real detach/audit functionality is correct and tested: Phase 5 gate
runners scripts/gates/G17-detach-roundtrip.ts (6/6) and
scripts/gates/G18-audit-log-tamper-detection.ts (5/5) pass.

## Goal

Make G17/G18 delegate to the Phase 5 gate runners. Optionally add a CLI
surface smoke (G21) that exercises the real binary.

## Constraints

1. DO NOT modify any CLI source (packages/cli/\*\*). The CLI is correct.
2. DO NOT modify the gate runners (scripts/gates/G17*, G18*).
3. DO NOT remove G17/G18; replace their bodies to delegate.
4. Use `pnpm exec tsx` (not `pnpm tsx`) for reliability inside Docker.
5. Keep all other gates (G1-G16, G19, G20) untouched.

## Steps

1. In charter/run.sh, replace the G17 block body with:
   `pnpm exec tsx scripts/gates/G17-detach-roundtrip.ts`
2. Replace the G18 block body with:
   `pnpm exec tsx scripts/gates/G18-audit-log-tamper-detection.ts`
3. (Optional) Create charter/lib/check-cli-surface.mjs (provided in spec)
   and add gate G21 wiring in run.sh.
4. Run: bash scripts/ci/verify-g17-g18-fix.sh
5. If green, commit and push (message provided in spec).

## Verify locally (Docker, optional but recommended)

```bash
cd Orqenix
docker build -t orqenix-charter -f charter/Dockerfile .
mkdir -p ../charter-hf-cache && chmod 777 ../charter-hf-cache
docker run --rm \
  -v "$(pwd):/repo" \
  -v "$(pwd)/../Orqenix-Pro:/Orqenix-Pro" \
  -v "$(pwd)/../charter-hf-cache:/root/.cache/huggingface" \
  -e ORQENIX_PRO_PATH=/Orqenix-Pro -e CHARTER_VERBOSE=1 \
  orqenix-charter
# Expect: G17 GREEN, G18 GREEN -> Charter Result: 17/20 GREEN
```

## Denied Actions

- Do not touch packages/cli source or the gate runners.
- Do not bypass charter or mark gates as skipped.
- Do not change the Pro ref or Docker mount mode.

## Report

Create .orqenix/reports/charter-g17-g18-fix-2026-06-04.md with the
gate-by-gate before/after and the docker Charter Result line.
