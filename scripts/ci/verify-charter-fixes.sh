#!/usr/bin/env bash
set -euo pipefail
log() { echo "[verify-charter] $*"; }
err() { echo "[verify-charter][ERROR] $*" >&2; }

[ -f "package.json" ] || { err "Run from repo root"; exit 1; }

log "Fix 1: REPO_ROOT exported in run.sh"
if ! grep -qE "^\s*export REPO_ROOT" charter/run.sh; then
  err "  run.sh missing 'export REPO_ROOT'"
  exit 1
fi
log "  OK"

log "Fix 2: count-tests uses single root vitest run"
if grep -q '"-r", "exec", "vitest"' charter/lib/count-tests.mjs; then
  err "  count-tests.mjs still uses pnpm -r exec (will fail in _meta)"
  exit 1
fi
log "  OK"

log "Fix 3: G12 uses check-ci-matrix.mjs"
if [ ! -f "charter/lib/check-ci-matrix.mjs" ]; then
  err "  check-ci-matrix.mjs missing"
  exit 1
fi
if ! grep -q "check-ci-matrix.mjs" charter/run.sh; then
  err "  run.sh G12 not wired to check-ci-matrix.mjs"
  exit 1
fi
node charter/lib/check-ci-matrix.mjs && log "  G12 check passes locally"

log "Fix 4: tmp CVE override present"
if ! grep -q '"tmp' package.json; then
  err "  package.json missing tmp override (verify pnpm audit clean)"
else
  log "  override present"
fi

log "Regression: allowlist still 5 items"
node scripts/release/verify-only-built-deps.mjs

log "Prettier"
pnpm exec prettier --check \
  charter/lib/count-tests.mjs \
  charter/lib/check-ci-matrix.mjs \
  package.json

log ""
log "All charter fix checks passed."
