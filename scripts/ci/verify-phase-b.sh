#!/usr/bin/env bash
# Local verification after Phase B files are placed.

set -euo pipefail

log() { echo "[verify-phase-b] $*"; }
err() { echo "[verify-phase-b][ERROR] $*" >&2; }

REQUIRED_FILES=(
  ".github/workflows/charter.yml"
  ".github/workflows/ci.yml"
  ".github/workflows/release.yml"
  ".github/actions/checkout-orqenix-repo/action.yml"
  ".orqenix/cross-repo-refs.json"
  "scripts/release/run-prepublish-checks.mjs"
  "scripts/release/convert-cross-scope-deps.mjs"
  "scripts/release/verify-only-built-deps.mjs"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    err "Missing: $f"
    exit 1
  fi
done
log "All required files present."

log "Check 1: no broken \$@ expansion in workflows"
if grep -rn "x-access-token:\$@" .github/ 2>/dev/null; then
  err "Found broken \$@ shell expansion (should be \${PRO_TOKEN} or use composite action)"
  exit 1
fi

log "Check 2: no token-injected URLs outside composite action"
VIOLATIONS=$(grep -rn "git clone.*://[a-zA-Z0-9_]\+:" .github/workflows/ 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  err "Found token-injected git clone outside composite action:"
  echo "$VIOLATIONS"
  exit 1
fi

log "Check 3: charter.yml and release.yml use composite action"
for f in .github/workflows/charter.yml .github/workflows/release.yml .github/workflows/ci.yml; do
  if ! grep -q "checkout-orqenix-repo" "$f"; then
    err "$f does not use composite action"
    exit 1
  fi
done

log "Check 4: token name unified to ORQENIX_COORDINATOR_PAT"
if grep -rn "ORQENIX_PRO_READ_TOKEN" .github/workflows/ 2>/dev/null; then
  err "Found legacy ORQENIX_PRO_READ_TOKEN reference (should be ORQENIX_COORDINATOR_PAT)"
  exit 1
fi

log "Check 5: release.yml uses changesets/action"
if ! grep -q "changesets/action" .github/workflows/release.yml; then
  err "release.yml does not use changesets/action (publish step missing)"
  exit 1
fi

log "Check 6: release.yml has provenance enabled"
if ! grep -q "provenance" .github/workflows/release.yml; then
  err "release.yml does not enable provenance signing"
  exit 1
fi

log "Check 7: allowlist verifier passes"
node scripts/release/verify-only-built-deps.mjs

log "Check 8: Pro ref resolves"
node scripts/ci/get-pro-ref.mjs --validate

log ""
log "All Phase B checks passed. Ready to commit and push."
