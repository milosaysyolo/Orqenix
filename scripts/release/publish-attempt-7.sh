#!/usr/bin/env bash
# Orqenix v0.5.0 Live Publish — Attempt 7
# Prerequisites (manual, before running):
#   1. Created npm Granular Access Token (type: Automation, scope: @orqenix)
#   2. Updated GitHub secret NPM_TOKEN with the new token
#   3. Confirmed token type is "Automation" (bypasses 2FA)
#
# Usage:
#   bash scripts/release/publish-attempt-7.sh
#   bash scripts/release/publish-attempt-7.sh --skip-confirm   (no interactive prompt)
#   bash scripts/release/publish-attempt-7.sh --dry-run        (re-run dry-run mode)

set -euo pipefail

# ---- Config ----
REPO="milosaysyolo/Orqenix"
EXPECTED_VERSION="0.5.0"
CORE_PACKAGES=("core" "cli" "audit-log" "detach" "scope-identity" "storage-sqlite")
PROPAGATION_WAIT=90  # seconds after publish before verify

# ---- Flags ----
SKIP_CONFIRM=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --skip-confirm) SKIP_CONFIRM=true ;;
    --dry-run)      DRY_RUN=true ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

# ---- Helpers ----
log()  { echo "[publish-attempt-7] $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; }
err()  { echo "[publish-attempt-7][ERROR] $*" >&2; }

confirm() {
  $SKIP_CONFIRM && return 0
  read -r -p "$1 [y/N]: " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { log "Aborted by user."; exit 1; }
}

# ---- Phase 1: Environment checks ----
log "Phase 1: Environment checks"

if [ ! -f "package.json" ]; then
  err "Run from repo root (no package.json found)"
  exit 1
fi

for tool in gh git npm jq node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    err "Required tool not found: $tool"
    exit 1
  fi
done
ok "All required tools present (gh, git, npm, jq, node)"

# Check gh authenticated
if ! gh auth status >/dev/null 2>&1; then
  err "gh not authenticated. Run: gh auth login"
  exit 1
fi
ok "gh CLI authenticated"

# Check on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  err "Not on main branch (current: $BRANCH)"
  exit 1
fi
ok "On main branch"

# Check git clean
if [ -n "$(git status --porcelain)" ]; then
  err "Git working tree dirty. Commit or stash first."
  git status --short
  exit 1
fi
ok "Git working tree clean"

# Check pushed to origin
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  err "Local main not synced with origin/main"
  err "  Local:  $LOCAL_SHA"
  err "  Remote: $REMOTE_SHA"
  err "Run: git push origin main"
  exit 1
fi
ok "Local main synced with origin (commit: $LOCAL_SHA)"

# ---- Phase 2: Secrets check ----
log "Phase 2: Secrets check"

SECRETS=$(gh secret list 2>/dev/null)

check_secret() {
  local name="$1"
  if echo "$SECRETS" | grep -q "^$name"; then
    local updated
    updated=$(echo "$SECRETS" | grep "^$name" | awk '{$1=""; print substr($0,2)}')
    ok "$name present (updated: $updated)"
    return 0
  else
    fail "$name missing"
    return 1
  fi
}

MISSING=0
check_secret "NPM_TOKEN" || MISSING=$((MISSING+1))
check_secret "ORQENIX_COORDINATOR_PAT" || MISSING=$((MISSING+1))

if [ "$MISSING" -gt 0 ]; then
  err "Required secrets missing. Setup before re-running."
  exit 1
fi

# Verify NPM_TOKEN was recently updated (likely Automation token)
NPM_TOKEN_AGE=$(echo "$SECRETS" | grep "^NPM_TOKEN" | grep -oE "[0-9]+ (minute|hour|day|second)s? ago" | head -1)
if [ -n "$NPM_TOKEN_AGE" ]; then
  log "NPM_TOKEN last updated: $NPM_TOKEN_AGE"
  if echo "$NPM_TOKEN_AGE" | grep -qE "day|month|year"; then
    fail "NPM_TOKEN last updated more than 1 hour ago"
    fail "Make sure you updated it with the new Automation token!"
    confirm "Continue anyway?"
  fi
fi

# ---- Phase 3: npm registry CLEAN check ----
log "Phase 3: npm registry CLEAN check (critical)"

REGISTRY_DIRTY=0
for pkg in "${CORE_PACKAGES[@]}"; do
  V=$(npm view "@orqenix/$pkg" version 2>/dev/null || echo "CLEAN")
  if [ "$V" = "CLEAN" ]; then
    ok "@orqenix/$pkg: not yet on registry"
  else
    fail "@orqenix/$pkg: ALREADY PUBLISHED at v$V"
    REGISTRY_DIRTY=$((REGISTRY_DIRTY+1))
  fi
done

if [ "$REGISTRY_DIRTY" -gt 0 ]; then
  err "Some packages already on registry. Investigate before re-publishing."
  err "If intended (e.g. retry after partial publish), changesets/pnpm will skip published versions."
  confirm "Continue anyway?"
fi

# ---- Phase 4: Changeset + lockfile check ----
log "Phase 4: Changeset + lockfile + allowlist check"

CHANGESETS=$(ls .changeset/*.md 2>/dev/null | grep -v README || true)
if [ -z "$CHANGESETS" ]; then
  err "No changeset files found in .changeset/"
  exit 1
fi
ok "Changeset present:"
echo "$CHANGESETS" | sed 's/^/    /'

# Verify changeset config is minimal changelog (per 6-4.14 fix)
CHANGELOG_TYPE=$(node -p "JSON.stringify(require('./.changeset/config.json').changelog)")
if echo "$CHANGELOG_TYPE" | grep -q "changesets/cli/changelog"; then
  ok "Changeset config uses minimal changelog (no GitHub API fetch)"
elif echo "$CHANGELOG_TYPE" | grep -q "changelog-github"; then
  fail "Changeset config still uses changelog-github (will fail on read:user scope)"
  fail "  Fix .changeset/config.json: \"changelog\": \"@changesets/cli/changelog\""
  exit 1
else
  log "Changeset config: $CHANGELOG_TYPE (custom, manual verify needed)"
fi

# Allowlist
if node scripts/release/verify-only-built-deps.mjs >/dev/null 2>&1; then
  ok "onlyBuiltDependencies allowlist OK (5 items)"
else
  fail "Allowlist verification failed"
  node scripts/release/verify-only-built-deps.mjs
  exit 1
fi

# Lockfile in sync (quick check)
if node scripts/release/check-lockfile-drift.mjs 2>/dev/null | grep -q "IN_SYNC"; then
  ok "Lockfile in sync"
else
  fail "Lockfile drift detected"
  exit 1
fi

# ---- Phase 5: Package count verification ----
log "Phase 5: Package count verification"

PUBLISHABLE=$(pnpm ls -r --depth -1 --json 2>/dev/null | \
  node -e "
    const pkgs = JSON.parse(require('fs').readFileSync(0,'utf8'));
    const list = Array.isArray(pkgs) ? pkgs : [pkgs];
    const pub = list.filter(p => !p.private && p.name?.startsWith('@orqenix/'));
    console.log(pub.length);
    pub.forEach(p => console.error('  ' + p.name + '@' + p.version));
  " 2>&1)

PUB_COUNT=$(echo "$PUBLISHABLE" | tail -1)
log "Publishable @orqenix packages: $PUB_COUNT"
echo "$PUBLISHABLE" | head -n -1 | head -10
[ "$PUB_COUNT" -gt 10 ] && log "  ... and $((PUB_COUNT - 10)) more (truncated)"

if [ "$PUB_COUNT" -ne 27 ] && [ "$PUB_COUNT" -ne 62 ]; then
  log "Package count is $PUB_COUNT (expected 27 or 62 per memory)"
  confirm "Continue with $PUB_COUNT packages?"
fi

# ---- Phase 6: Recent pipeline check ----
log "Phase 6: Recent CI pipeline check"

RECENT_RUNS=$(gh run list --limit 5 --json conclusion,workflowName,headSha 2>/dev/null)
RED_RUNS=$(echo "$RECENT_RUNS" | jq -r '.[] | select(.headSha == "'"$LOCAL_SHA"'" and .conclusion == "failure") | .workflowName')
if [ -n "$RED_RUNS" ]; then
  fail "Recent RED workflows on $LOCAL_SHA:"
  echo "$RED_RUNS" | sed 's/^/    /'
  confirm "Continue despite RED workflows?"
else
  ok "No recent RED workflows on current commit"
fi

# ---- Phase 7: Confirm intent ----
log "Phase 7: Final confirmation"
echo ""
log "READY TO PUBLISH v$EXPECTED_VERSION:"
log "  - Repo: $REPO"
log "  - Commit: $LOCAL_SHA"
log "  - Packages: $PUB_COUNT publishable"
log "  - Mode: $([ "$DRY_RUN" = "true" ] && echo "DRY RUN (no publish)" || echo "LIVE PUBLISH (irreversible)")"
log "  - NPM_TOKEN: should be Granular + Automation type (bypass 2FA)"
echo ""

if [ "$DRY_RUN" = "true" ]; then
  log "Triggering DRY RUN..."
  DRY_RUN_FLAG="true"
else
  confirm "Proceed with LIVE publish?"
  DRY_RUN_FLAG="false"
fi

# ---- Phase 8: Trigger workflow ----
log "Phase 8: Triggering release workflow"

gh workflow run release.yml \
  -f dry_run=$DRY_RUN_FLAG \
  -f skip_charter_gates=false

# Wait a moment for the run to register
sleep 5

RUN_ID=$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
log "Run started: $RUN_ID"
log "URL: https://github.com/$REPO/actions/runs/$RUN_ID"

# ---- Phase 9: Watch run ----
log "Phase 9: Watching workflow run (Ctrl+C to detach, run continues)"
echo ""

if ! gh run watch "$RUN_ID" --exit-status; then
  CONCLUSION=$(gh run view "$RUN_ID" --json conclusion -q '.conclusion')
  fail "Workflow ended with: $CONCLUSION"
  fail "View logs: gh run view $RUN_ID --log-failed"

  log ""
  log "Diagnosing failed jobs..."
  gh run view "$RUN_ID" --json jobs -q '.jobs[] | select(.conclusion == "failure") | .name' \
    | while read -r job; do
        fail "Failed job: $job"
      done
  exit 1
fi

ok "Workflow completed successfully"

# ---- Phase 10: Verify on npm (live only) ----
if [ "$DRY_RUN" = "true" ]; then
  log "Dry run complete. No npm verification needed."
  log "To proceed with live publish, run without --dry-run."
  exit 0
fi

log "Phase 10: Verifying packages on npm registry"
log "Waiting ${PROPAGATION_WAIT}s for npm propagation..."
sleep "$PROPAGATION_WAIT"

VERIFY_FILE=$(mktemp /tmp/orqenix-publish-verify-XXXXXX.txt)
ALL_PUBLISHED=0
MISSING_COUNT=0
WRONG_VERSION_COUNT=0

# Get list of all publishable packages
PKG_NAMES=$(pnpm ls -r --depth -1 --json 2>/dev/null | \
  node -e "
    const pkgs = JSON.parse(require('fs').readFileSync(0,'utf8'));
    const list = Array.isArray(pkgs) ? pkgs : [pkgs];
    list.filter(p => !p.private && p.name?.startsWith('@orqenix/'))
        .forEach(p => console.log(p.name));
  ")

while IFS= read -r pkg; do
  V=$(npm view "$pkg" version 2>/dev/null || echo "MISSING")
  printf "  %-50s %s\n" "$pkg" "$V" | tee -a "$VERIFY_FILE"
  if [ "$V" = "MISSING" ]; then
    MISSING_COUNT=$((MISSING_COUNT + 1))
  elif [ "$V" != "$EXPECTED_VERSION" ]; then
    WRONG_VERSION_COUNT=$((WRONG_VERSION_COUNT + 1))
  else
    ALL_PUBLISHED=$((ALL_PUBLISHED + 1))
  fi
done <<< "$PKG_NAMES"

echo ""
log "Publish verification summary:"
log "  Published at $EXPECTED_VERSION:  $ALL_PUBLISHED"
log "  Wrong version:                   $WRONG_VERSION_COUNT"
log "  Missing:                         $MISSING_COUNT"
log "  Total publishable:               $PUB_COUNT"
log "  Verify log:                      $VERIFY_FILE"

if [ "$MISSING_COUNT" -gt 0 ] || [ "$WRONG_VERSION_COUNT" -gt 0 ]; then
  fail "Not all packages published successfully"
  log "Re-running the workflow will retry only the missing packages"
  log "  gh workflow run release.yml -f dry_run=false -f skip_charter_gates=false"
  exit 1
fi

# ---- Phase 11: Provenance + fresh install smoke ----
log "Phase 11: Verifying provenance + fresh install"

# Provenance check
if npm view @orqenix/core --json 2>/dev/null | jq -e '.dist.attestations' >/dev/null 2>&1; then
  ok "Provenance attestations present on @orqenix/core"
else
  fail "Provenance not detected (may take a moment to appear on npm)"
fi

# Fresh install smoke
SMOKE_DIR=$(mktemp -d /tmp/orqenix-smoke-XXXXXX)
log "Smoke test in $SMOKE_DIR"
(
  cd "$SMOKE_DIR"
  npm init -y >/dev/null 2>&1
  if npm install @orqenix/core @orqenix/cli --no-save --silent 2>&1; then
    ok "Fresh install succeeded"
    if node -e "const c = require('@orqenix/core'); console.log('core exports:', Object.keys(c).length);"; then
      ok "Core package imports cleanly"
    fi
    if npx -y @orqenix/cli version 2>&1 | grep -q "$EXPECTED_VERSION"; then
      ok "CLI reports version $EXPECTED_VERSION"
    fi
  else
    fail "Fresh install failed"
  fi
)
rm -rf "$SMOKE_DIR"

# ---- Phase 12: GitHub issue check ----
log "Phase 12: Checking auto-generated release issue"

ISSUE=$(gh issue list --label release --limit 1 --json title,url,number -q '.[0]')
if [ -n "$ISSUE" ] && [ "$ISSUE" != "null" ]; then
  TITLE=$(echo "$ISSUE" | jq -r '.title')
  URL=$(echo "$ISSUE" | jq -r '.url')
  ok "Release issue created: $TITLE"
  ok "  $URL"
else
  log "No release issue auto-created (notify job may not have run; check workflow logs)"
fi

# ---- Done ----
echo ""
log "========================================="
log "v$EXPECTED_VERSION PUBLISHED SUCCESSFULLY"
log "========================================="
log ""
log "Summary:"
log "  - $ALL_PUBLISHED packages live on npm at v$EXPECTED_VERSION"
log "  - Commit: $LOCAL_SHA"
log "  - Workflow: $RUN_ID"
log "  - Verify log: $VERIFY_FILE"
log ""
log "Next steps (optional, not blocking):"
log "  - Delete old NPM_TOKEN (Publish type) on npmjs.com for cleanup"
log "  - Add npm badge to README"
log "  - Plan Pro repo first publish"
log "  - Phase 6 kickoff"
echo ""
