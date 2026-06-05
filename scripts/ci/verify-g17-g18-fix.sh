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

log "2: run.sh uses ESM loader (node --import tsx/esm), not pnpm exec tsx"
if grep -qE 'pnpm exec tsx scripts/gates/G1[78]' charter/run.sh; then
  err "  run.sh still uses 'pnpm exec tsx' for G17/G18 (CJS shim fails on ESM-only deps)"
  exit 1
fi
grep -q 'node --import tsx/esm scripts/gates/G17-detach-roundtrip.ts' charter/run.sh \
  || { err "  G17 not using node --import tsx/esm"; exit 1; }
grep -q 'node --import tsx/esm scripts/gates/G18-audit-log-tamper-detection.ts' charter/run.sh \
  || { err "  G18 not using node --import tsx/esm"; exit 1; }
log "  OK ESM loader wired"

log "2b: No stale strip-types in gate blocks (comments/version guard OK)"
if grep -qE 'node --experimental-strip-types.*scripts/gates/G1[78]' charter/run.sh; then
  err "  G17/G18 still uses strip-types"
  exit 1
fi
log "  OK no strip-types in gate blocks"

log "3: No stale CLI calls remain (init/attach/audit append)"
if grep -qE 'cli/dist/index\.js (init|attach)' charter/run.sh; then
  err "  run.sh still references removed CLI commands"
  exit 1
fi
if grep -q "audit append" charter/run.sh; then
  err "  run.sh still references non-existent 'audit append'"
  exit 1
fi
log "  OK no stale CLI calls"

log "4: G21 smoke creates .orqenix dir"
grep -q 'mkdirSync(join(tmp, ".orqenix")' charter/lib/check-cli-surface.mjs \
  || { err "  smoke test missing .orqenix mkdir"; exit 1; }
log "  OK .orqenix mkdir present"

log "5: Gate runners pass standalone via ESM loader"
node --import tsx/esm scripts/gates/G17-detach-roundtrip.ts
node --import tsx/esm scripts/gates/G18-audit-log-tamper-detection.ts
log "  OK both gate runners green"

log "6: CLI surface smoke passes"
pnpm --filter @orqenix/cli build >/dev/null 2>&1
node charter/lib/check-cli-surface.mjs
log "  OK CLI smoke green"

log "7: Prettier"
pnpm exec prettier --check charter/lib/check-cli-surface.mjs scripts/ci/verify-g17-g18-fix.sh 2>/dev/null || {
  err "Prettier failed. Run: pnpm exec prettier --write charter/lib/check-cli-surface.mjs"
  exit 1
}

log ""
log "All G17/G18/G21 fix checks passed. Safe to commit."
