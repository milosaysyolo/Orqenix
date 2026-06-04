#!/usr/bin/env bash
# Master rollout script for unified cross-repo checkout infrastructure.
# Idempotent. Run from repo root.

set -euo pipefail

log() { echo "[ship] $*"; }
err() { echo "[ship][ERROR] $*" >&2; }

if [ ! -f "package.json" ]; then
  err "Run from repo root"
  exit 1
fi

log "Step 1: Verify all kit files exist"
REQUIRED=(
  ".orqenix/policy/credential-handling.md"
  ".orqenix/cross-repo-refs.json"
  ".orqenix/schemas/cross-repo-refs.schema.json"
  ".orqenix/prompts/diagnose-ci-charter-and-release-oss.md"
  ".github/actions/checkout-orqenix-repo/action.yml"
  ".github/workflows/policy-credential-guard.yml"
  ".github/workflows/manual-lockfile-sync.yml"
  ".github/workflows/lockfile-autofix.yml"
  "scripts/ci/get-pro-ref.mjs"
  "scripts/ci/align-pro-checkout.mjs"
  "scripts/release/verify-only-built-deps.mjs"
)

for f in "${REQUIRED[@]}"; do
  if [ ! -f "$f" ]; then
    err "Missing: $f (create from deliverable kit first)"
    exit 1
  fi
done

log "Step 2: Validate JSON files"
node -e "JSON.parse(require('fs').readFileSync('.orqenix/cross-repo-refs.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('.orqenix/schemas/cross-repo-refs.schema.json','utf8'))"

log "Step 3: Validate get-pro-ref.mjs"
node scripts/ci/get-pro-ref.mjs --validate

log "Step 4: Validate allowlist verifier"
node scripts/release/verify-only-built-deps.mjs

log "Step 5: Patch any workflows still using legacy Pro checkout"
node scripts/ci/align-pro-checkout.mjs

log "Step 6: Validate composite action YAML parses"
node -e "
const yaml = require('yaml');
const fs = require('fs');
yaml.parse(fs.readFileSync('.github/actions/checkout-orqenix-repo/action.yml','utf8'));
console.log('composite action YAML valid');
"

log "Step 7: Run policy guard checks locally (mimics CI)"
# Inline subset of policy-credential-guard.yml checks
VIOLATIONS=$(grep -rn "git clone.*://[a-zA-Z0-9_]\+:" .github/workflows/ .github/actions/ 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  # Allow only inside composite action which uses env var expansion
  ALLOWED_ONLY_COMPOSITE=$(echo "$VIOLATIONS" | grep -v "checkout-orqenix-repo/action.yml" || true)
  if [ -n "$ALLOWED_ONLY_COMPOSITE" ]; then
    err "Inline tokens in git clone URLs detected:"
    echo "$ALLOWED_ONLY_COMPOSITE"
    exit 1
  fi
fi

log "Step 8: List files ready to commit"
git status --short

log ""
log "All checks passed. To commit and push:"
log ""
log "  git add ."
log "  git commit -F .orqenix/prompts/commit-message-unified-checkout.txt"
log "  git push"
log ""
log "After push, verify in GitHub Actions tab:"
log "  - Policy Credential Guard passes on the push commit"
log "  - Lockfile Guard remains GREEN"
log "  - CI matrix and Phase 5 Baseline jobs use composite action successfully"
