#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ORQENIX_ROOT="$(pwd)"
PRO_ROOT="$(realpath "$ORQENIX_ROOT/../Orqenix-Pro")"

echo "=== Cross-Repo Smoke Test ==="
echo "Orqenix:     $ORQENIX_ROOT"
echo "Orqenix-Pro: $PRO_ROOT"
echo "Date:        $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  echo -n "  [$name] "
  if "$@" >/dev/null 2>&1; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo "--- Step 1: Sibling layout ---"
check "Orqenix-Pro exists" test -d "$PRO_ROOT"
check "Orqenix-Pro has keys" test -f "$PRO_ROOT/keys/test-public.pem"

echo ""
echo "--- Step 2: Build state ---"
check "Orqenix core built" test -f "$ORQENIX_ROOT/packages/core/dist/index.js"
check "Orqenix CLI built" test -f "$ORQENIX_ROOT/packages/cli/dist/index.js"
check "Orqenix-Pro license built" test -f "$PRO_ROOT/packages/license/dist/index.js"

echo ""
echo "--- Step 3: Tag sync ---"
check "Orqenix tag" sh -c "cd '$ORQENIX_ROOT' && git tag --list v0.4.0-phase-4 | grep -q v0.4.0-phase-4"
check "Orqenix-Pro tag" sh -c "cd '$PRO_ROOT' && git tag --list v0.4.0-phase-4 | grep -q v0.4.0-phase-4"

echo ""
echo "--- Step 4: Pro flow ---"
check "Pro test suite" sh -c "cd '$PRO_ROOT' && pnpm test"
check "License grace driver" sh -c "cd '$PRO_ROOT' && pnpm test:license-grace"

echo ""
echo "--- Step 5: Orqenix smoke ---"
check "Orqenix smoke" sh -c "cd '$ORQENIX_ROOT' && pnpm smoke"

echo ""
echo "--- Step 6: Integration suite ---"
check "Integration tests" sh -c "cd '$ORQENIX_ROOT/integration' && pnpm test"

echo ""
echo "=== Smoke Summary ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "Cross-repo smoke FAILED"
  exit 1
fi
echo "Cross-repo smoke OK"
exit 0
