#!/usr/bin/env bash
# Phase 4 Charter Runner
# Runs all 20 gates inside a Linux container so Unix tooling (grep, wc, jq) is guaranteed.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_ROOT
cd "$REPO_ROOT"

# --- Defensive: ensure git trusts mounted repos (belt-and-suspenders with Dockerfile) ---
git config --global --add safe.directory '*' 2>/dev/null || true
git config --global --add safe.directory /repo 2>/dev/null || true
git config --global --add safe.directory "${ORQENIX_PRO_PATH:-../Orqenix-Pro}" 2>/dev/null || true

# --- Verify Node supports --experimental-strip-types (>= 22.6) ---
NODE_VER=$(node -p "process.versions.node")
echo "Node version: ${NODE_VER}"
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VER" | cut -d. -f2)
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 6 ]; }; then
  echo "WARNING: Node ${NODE_VER} < 22.6; --experimental-strip-types unavailable."
  echo "G17/G18 will fail; bump charter/Dockerfile base image to node:22.12-bookworm or newer."
fi

PASS=0
FAIL=0
RED_GATES=()

run_gate() {
  local id="$1"
  local name="$2"
  shift 2
  printf "▶ %-4s %-45s ... " "$id" "$name"
  if "$@" >/tmp/gate.log 2>&1; then
    echo "GREEN"
    PASS=$((PASS + 1))
  else
    echo "RED"
    FAIL=$((FAIL + 1))
    RED_GATES+=("$id  $name")
    if [ "${CHARTER_VERBOSE:-0}" = "1" ]; then
      sed 's/^/    /' /tmp/gate.log
    fi
  fi
}

# --- Install deps once (writable mount required) ---
echo "Installing OSS dependencies..."
if ! pnpm install --frozen-lockfile --config.ignore-scripts=false; then
  echo "WARNING: frozen install failed, retrying without frozen lockfile"
  pnpm install --config.ignore-scripts=false
fi

# Rebuild allowlisted native bindings (better-sqlite3, etc.)
pnpm rebuild @mongodb-js/zstd better-sqlite3 esbuild @swc/core sharp --pending --config.ignore-scripts=false || true

# --- Build packages (G13/G17/G18 need packages/cli/dist) ---
echo "Building packages..."
pnpm build || echo "WARNING: build reported errors; dist-dependent gates may fail"

# --- Warm HuggingFace cache so G4 (pnpm test) runs offline without 429 ---
# Temporarily allow network for warming, then tests run offline (env from Dockerfile).
echo "Warming HuggingFace model cache..."
HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 \
  pnpm --filter @orqenix/embedding-local run warm-cache || \
  echo "WARNING: HF warm failed; G4 may fail if model not cached"

# G1
run_gate G1 "no @ts-expect-error in src" bash -c '
  ! grep -RIn "@ts-expect-error" packages/*/src 2>/dev/null | grep -v ".test." | grep -q .
'

# G2
run_gate G2 "no @ts-ignore in src" bash -c '
  ! grep -RIn "@ts-ignore" packages/*/src 2>/dev/null | grep -v ".test." | grep -q .
'

# G3
run_gate G3 "strict tsc clean" pnpm typecheck

# G4
run_gate G4 "tests uncached run" pnpm test -- --force

# G5: count tests via JSON reporter
run_gate G5 "test count >= 230" node charter/lib/count-tests.mjs 230

# G6: no export-only tests
run_gate G6 "no export-only tests" node charter/lib/check-export-only.mjs

# G7: kb-code uses web-tree-sitter
run_gate G7 "kb-code uses web-tree-sitter" node charter/lib/check-tree-sitter.mjs

# G8: kb-docs hybrid retrieval present (vec0 + FTS5)
run_gate G8 "kb-docs hybrid retrieval" node charter/lib/check-hybrid-retrieval.mjs

# G9: Pro tier repo present
run_gate G9 "Orqenix-Pro tier present" bash -c '
  [ -d "../Orqenix-Pro" ] || [ -n "${ORQENIX_PRO_PATH:-}" ]
'

# G10: Pro tests pass
run_gate G10 "Pro tests pass" bash -c '
  PRO="${ORQENIX_PRO_PATH:-../Orqenix-Pro}"
  cd "$PRO" && pnpm install --frozen-lockfile >/dev/null && pnpm test
'

# G11: 7 architecture docs, each >= 200 lines
run_gate G11 "7 docs present, each >= 200 lines" bash -c '
  required=("lifecycle-management" "knowledge-layer" "marketplace-system" \
            "license-gating" "embedding-providers" "why-pro" "phase-4-rollback")
  for d in "${required[@]}"; do
    f="docs/architecture/${d}.md"
    [ -f "$f" ] || { echo "missing: $f"; exit 1; }
    lines=$(wc -l < "$f")
    [ "$lines" -ge 200 ] || { echo "$f only $lines lines"; exit 1; }
  done
'

# G12: CI matrix 6 jobs (robust YAML parse)
run_gate G12 "CI matrix 6 jobs" node charter/lib/check-ci-matrix.mjs

# G13: smoke passes locally
run_gate G13 "smoke passes locally" pnpm smoke

# G14: no high/critical CVE
run_gate G14 "no high/critical CVE" node charter/lib/check-cve.mjs

# G15: bundle size budget
run_gate G15 "bundle size budget" pnpm bundle:check

# G16: perf budget
run_gate G16 "perf budget" pnpm bench:phase-4

## G17: detach round-trip — delegate to Phase 5 gate runner (ESM loader).
## storage-sqlite is type:module (ESM-only exports); tsx's default CJS shim
## cannot require() it -> MODULE_NOT_FOUND. node --import tsx/esm loads tsx in
## ESM mode (Node 22 in charter image supports --import).
run_gate G17 "detach round-trip clean" bash -c '
  node --import tsx/esm scripts/gates/G17-detach-roundtrip.ts
'

## G18: audit tamper detection — delegate to Phase 5 gate runner (ESM loader).
run_gate G18 "audit tamper detection" bash -c '
  node --import tsx/esm scripts/gates/G18-audit-log-tamper-detection.ts
'

# G19: license grace period (Pro repo)
run_gate G19 "license grace period" bash -c '
  PRO="${ORQENIX_PRO_PATH:-../Orqenix-Pro}"
  cd "$PRO" && pnpm test:license-grace
'

# G20: keystore correct
run_gate G20 "keystore correct" bash -c '
  [ -f "keys/orqenix-marketplace.pub.pem" ] &&
  head -1 keys/orqenix-marketplace.pub.pem | grep -q "BEGIN PUBLIC KEY"
'

## G21: CLI surface smoke (real binary, Phase 5 commands)
## Complements G17/G18 by exercising the built CLI binary end-to-end.
run_gate G21 "CLI surface smoke (real binary)" bash -c '
  pnpm --filter @orqenix/cli build >/dev/null 2>&1
  node charter/lib/check-cli-surface.mjs
'

echo
echo "==================================="
echo "Charter Result: ${PASS}/21 GREEN  ${FAIL}/21 RED"
echo "==================================="
if [ $FAIL -gt 0 ]; then
  echo "RED gates:"
  for g in "${RED_GATES[@]}"; do echo "  - $g"; done
  exit 1
fi
exit 0
