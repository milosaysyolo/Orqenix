#!/usr/bin/env bash
# Verify Test Stabilization Kit (Fix A+B+C) before commit.
set -euo pipefail

log() { echo "[verify-stab] $*"; }
err() { echo "[verify-stab][ERROR] $*" >&2; }

if [ ! -f "package.json" ]; then
  err "Run from repo root"
  exit 1
fi

# Fix A checks
log "Fix A: HuggingFace cache + offline"
if [ ! -f "packages/embedding-local/scripts/warm-hf-cache.mjs" ]; then
  err "  Missing warm-hf-cache.mjs"
  exit 1
fi
if ! grep -q "warm-cache" packages/embedding-local/package.json; then
  err "  warm-cache script not in embedding-local package.json"
  exit 1
fi
if ! grep -q "Xenova/all-MiniLM-L6-v2" packages/embedding-local/scripts/warm-hf-cache.mjs; then
  err "  Expected model Xenova/all-MiniLM-L6-v2 not found in warm script"
  exit 1
fi
if ! grep -q "TRANSFORMERS_OFFLINE" .github/workflows/ci.yml; then
  err "  ci.yml missing TRANSFORMERS_OFFLINE env"
  exit 1
fi
if ! grep -q "actions/cache@v4" .github/workflows/ci.yml; then
  err "  ci.yml missing HuggingFace cache step"
  exit 1
fi
log "  Fix A OK"

# Fix B checks
log "Fix B: semantic-cache race mitigation"
if [ ! -f "packages/plugin-semantic-cache/vitest.config.ts" ]; then
  err "  Missing plugin-semantic-cache vitest.config.ts"
  exit 1
fi
if ! grep -q "singleThread" packages/plugin-semantic-cache/vitest.config.ts; then
  err "  vitest.config.ts missing singleThread"
  exit 1
fi
if [ ! -f ".orqenix/prompts/diagnose-semantic-cache-race.md" ]; then
  err "  Missing diagnose prompt"
  exit 1
fi
log "  Fix B OK"

# Fix C checks
log "Fix C: charter decouple"
if grep -qE "^\s+charter:" .github/workflows/ci.yml; then
  err "  ci.yml still has a charter job; it should be removed (charter is now standalone)"
  exit 1
fi
if ! grep -q "schedule:" .github/workflows/charter.yml; then
  err "  charter.yml missing schedule trigger"
  exit 1
fi
if ! grep -qE "push:" .github/workflows/charter.yml; then
  err "  charter.yml missing push trigger"
  exit 1
fi
if ! grep -q "Resolve Pro ref" .github/workflows/charter.yml; then
  err "  charter.yml missing explicit Resolve Pro ref step"
  exit 1
fi
log "  Fix C OK"

# Cross-cutting regression checks
log "Regression: composite action still clean"
if grep -q "secrets\." .github/actions/checkout-orqenix-repo/action.yml; then
  err "  composite action regressed: contains secrets.*"
  exit 1
fi
if ! grep -q "github.action_path" .github/actions/checkout-orqenix-repo/action.yml; then
  err "  composite action missing github.action_path auto-detect"
  exit 1
fi

log "Prettier check"
pnpm exec prettier --check \
  .github/workflows/ci.yml \
  .github/workflows/charter.yml \
  .github/workflows/integration.yml \
  packages/embedding-local/scripts/warm-hf-cache.mjs \
  packages/plugin-semantic-cache/vitest.config.ts

log ""
log "All Test Stabilization Kit checks passed. Ready to commit."
