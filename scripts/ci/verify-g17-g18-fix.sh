#!/usr/bin/env bash
set -euo pipefail
log() { echo "[verify-g17-g18] $*"; }
err() { echo "[verify-g17-g18][ERROR] $*" >&2; }

[ -f "package.json" ] || { err "Run from repo root"; exit 1; }

log "1: Gate runners exist"
for f in \
  "scripts/gates/G17-detach-roundtrip.ts" \
  "scripts/gates/G18-audit-log-tamper-detection.ts"; do
  [ -f "$f" ] || { err "Missing $f"; exit 1; }
  log "  OK $f"
done

log "2: run.sh G17/G18 delegate to gate runners (no stale CLI calls)"
if grep -qE 'cli/dist/index\.js (init|attach)' charter/run.sh; then
  err "  run.sh still calls removed CLI commands (init/attach)"
  exit 1
fi
if grep -q "audit append" charter/run.sh; then
  err "  run.sh still calls non-existent 'audit append'"
  exit 1
fi
grep -q "G17-detach-roundtrip.ts" charter/run.sh || { err "  G17 not delegating"; exit 1; }
grep -q "G18-audit-log-tamper-detection.ts" charter/run.sh || { err "  G18 not delegating"; exit 1; }
log "  OK delegation wired"

log "3: Gate runners pass standalone"
pnpm exec tsx scripts/gates/G17-detach-roundtrip.ts
pnpm exec tsx scripts/gates/G18-audit-log-tamper-detection.ts
log "  OK both gate runners green"

if [ -f "charter/lib/check-cli-surface.mjs" ]; then
  log "4: CLI surface smoke (optional G21)"
  pnpm --filter @orqenix/cli build >/dev/null 2>&1 || true
  node charter/lib/check-cli-surface.mjs
  log "  OK CLI smoke green"
fi

log "5: Prettier"
pnpm exec prettier --check charter/lib/check-cli-surface.mjs .orqenix/prompts/fix-charter-g17-g18.md 2>/dev/null || {
  err "Prettier failed. Run: pnpm exec prettier --write charter/lib/check-cli-surface.mjs"
  exit 1
}

log ""
log "All G17/G18 fix checks passed. Safe to commit."
