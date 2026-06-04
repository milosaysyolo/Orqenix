#!/usr/bin/env bash
# Fix composite action resolve-ref workspace assumption (github-ci-6-4.2 residual).
# Makes the composite action auto-detect cross-repo-refs.json via github.action_path,
# and patches integration.yml + ci.yml charter job to pass ref explicitly.

set -euo pipefail

log() { echo "[fix-resolve-ref] $*"; }
err() { echo "[fix-resolve-ref][ERROR] $*" >&2; }

if [ ! -f "package.json" ]; then
  err "Run from repo root"
  exit 1
fi

BACKUP_DIR=".orqenix/backups/2026-06-04-fix-resolve-ref"
mkdir -p "$BACKUP_DIR"

log "Step 1: Backup affected files"
for f in \
  ".github/actions/checkout-orqenix-repo/action.yml" \
  ".github/workflows/integration.yml" \
  ".github/workflows/ci.yml" \
  ".github/workflows/charter.yml"; do
  if [ -f "$f" ]; then
    cp "$f" "$BACKUP_DIR/$(basename "$f").bak"
    log "  backed up $f"
  fi
done

log "Step 2: Verify composite action has github.action_path based resolve"
if grep -q "github.action_path" .github/actions/checkout-orqenix-repo/action.yml; then
  log "  Composite action already uses action_path resolve. Skipping action.yml patch."
else
  log "  Composite action needs resolve-ref upgrade."
  log "  MANUAL ACTION REQUIRED: apply Fix 1 (resolve step + refs-file input) from spec."
  log "  This script cannot safely auto-rewrite the multi-line YAML step."
fi

log "Step 3: Check integration.yml passes ref explicitly"
if [ -f ".github/workflows/integration.yml" ]; then
  if grep -q "env.PRO_REF" .github/workflows/integration.yml; then
    err "  integration.yml still references undefined env.PRO_REF"
    err "  MANUAL ACTION REQUIRED: apply Fix 2 from spec (Resolve Pro ref step + explicit ref)"
  else
    log "  integration.yml does not reference env.PRO_REF (good)"
  fi
fi

log "Step 4: Check ci.yml charter job passes ref explicitly"
if grep -q "Resolve Pro ref" .github/workflows/ci.yml; then
  log "  ci.yml has Resolve Pro ref step (good)"
else
  err "  ci.yml charter job may not resolve ref explicitly"
  err "  MANUAL ACTION REQUIRED: apply Fix 3 from spec"
fi

log "Step 5: Validate cross-repo-refs.json exists and parses"
node -e "
  const d = require('./.orqenix/cross-repo-refs.json');
  if (!d['orqenix-pro'] || !d['orqenix-pro'].ref) {
    console.error('orqenix-pro.ref missing');
    process.exit(1);
  }
  console.log('cross-repo-refs.json OK, pro ref:', d['orqenix-pro'].ref);
"

log "Step 6: Validate get-pro-ref.mjs works from repo root"
node scripts/ci/get-pro-ref.mjs --validate

log "Step 7: Prettier check on touched files"
pnpm exec prettier --check \
  .github/actions/checkout-orqenix-repo/action.yml \
  .github/workflows/ci.yml \
  .github/workflows/charter.yml \
  $([ -f .github/workflows/integration.yml ] && echo .github/workflows/integration.yml || true) \
  || {
    err "Prettier check failed. Run: pnpm exec prettier --write <files>"
    exit 1
  }

log ""
log "Verification complete. Backups in $BACKUP_DIR"
log "If any MANUAL ACTION REQUIRED above, print those patches before committing."
