#!/usr/bin/env bash
# Phase 4 Charter Runner
# Runs all 20 gates inside a Linux container so Unix tooling (grep, wc, jq) is guaranteed.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

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

# Install deps once
pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1

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

# G12: CI matrix 6 jobs
run_gate G12 "CI matrix 6 jobs" bash -c '
  grep -E "node-version: \\[.\x2720.\x27.*.\x2722.\x27\\]" .github/workflows/ci.yml >/dev/null &&
  grep -E "ubuntu-latest" .github/workflows/ci.yml >/dev/null &&
  grep -E "macos-latest"  .github/workflows/ci.yml >/dev/null &&
  grep -E "windows-latest" .github/workflows/ci.yml >/dev/null
'

# G13: smoke passes locally
run_gate G13 "smoke passes locally" pnpm smoke

# G14: no high/critical CVE
run_gate G14 "no high/critical CVE" node charter/lib/check-cve.mjs

# G15: bundle size budget
run_gate G15 "bundle size budget" pnpm bundle:check

# G16: perf budget
run_gate G16 "perf budget" pnpm bench:phase-4

# G17: detach round-trip clean (real CLI, no wrapper)
run_gate G17 "detach round-trip clean" bash -c '
  TMP=$(mktemp -d)
  cd "$TMP"
  node "$REPO_ROOT/packages/cli/dist/index.js" init
  node "$REPO_ROOT/packages/cli/dist/index.js" detach --commit
  node "$REPO_ROOT/packages/cli/dist/index.js" attach
  ! git diff --quiet 2>/dev/null && exit 1
  exit 0
'

# G18: audit tamper detection (real CLI, no wrapper)
run_gate G18 "audit tamper detection" bash -c '
  TMP=$(mktemp -d)
  cd "$TMP"
  node "$REPO_ROOT/packages/cli/dist/index.js" init
  node "$REPO_ROOT/packages/cli/dist/index.js" audit append --action test --actor charter
  # Tamper
  sed -i "s/test/TAMPER/" .orqenix/audit/*.log
  ! node "$REPO_ROOT/packages/cli/dist/index.js" audit verify
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

echo
echo "==================================="
echo "Charter Result: ${PASS}/20 GREEN  ${FAIL}/20 RED"
echo "==================================="
if [ $FAIL -gt 0 ]; then
  echo "RED gates:"
  for g in "${RED_GATES[@]}"; do echo "  - $g"; done
  exit 1
fi
exit 0
