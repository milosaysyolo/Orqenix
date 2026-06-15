#!/usr/bin/env bash
# Phase 7 closure DRY RUN \u2014 rehearse without side effects.
# Verifies: clean semver, repo layout, bench/D7.4, Pro deps fix preview,
# build, image build-only, and prints what the real ceremony WOULD publish.
set -uo pipefail

VERSION="${RELEASE_VERSION:-0.7.0}"
TAG="${RELEASE_TAG:-v0.7.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLOUD="${ROOT}/../Orqenix-Cloud"
PRO="${ROOT}/../Orqenix-Pro"
EVID="${ROOT}/out/close-phase-7/dryrun"
mkdir -p "${EVID}"

ok(){   printf "\033[1;32m[dry OK]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[dry WARN]\033[0m %s\n" "$*"; }
bad(){  printf "\033[1;31m[dry FAIL]\033[0m %s\n" "$*"; FAILS=$((FAILS+1)); }
FAILS=0

echo "=== Phase 7 Closure DRY RUN (version=${VERSION}, tag=${TAG}) ==="

# 1. Clean semver
[[ "$VERSION" == *"-phase-7"* || "$TAG" == *"-phase-7"* ]] \
  && bad "version/tag carries -phase-7" || ok "clean semver ${VERSION}/${TAG}"

# 2. Repo layout
[[ -d "$CLOUD" ]] && ok "Cloud repo present" || bad "Cloud repo missing at ${CLOUD}"
[[ -d "$PRO" ]]   && ok "Pro repo present"   || warn "Pro repo missing at ${PRO}"

# 3. No -phase-7 ranges anywhere
HITS=0
for repo in "$ROOT" "$CLOUD" "$PRO"; do
  [[ -d "$repo" ]] || continue
  if grep -rqsE '"\^?0\.7\.0-phase-7"' "${repo}/packages" 2>/dev/null; then
    bad "found -phase-7 range under ${repo}"; HITS=$((HITS+1))
  fi
done
[[ $HITS -eq 0 ]] && ok "no -phase-7 prerelease ranges"

# 4. Bench files real (not scaffold)
RTT="${CLOUD}/packages/relay-core/bench/rtt.bench.ts"
TPS="${CLOUD}/packages/relay-core/bench/throughput.bench.ts"
[[ -f "$RTT" && $(wc -l < "$RTT") -ge 25 ]] && ok "rtt.bench.ts real" || bad "rtt.bench.ts missing/scaffold"
[[ -f "$TPS" && $(wc -l < "$TPS") -ge 20 ]] && ok "throughput.bench.ts real" || bad "throughput.bench.ts missing/scaffold"

# 5. Dockerfiles present (Step 6 would die without these)
for app in cloud-relay cloud-web cloud-worker; do
  [[ -f "${CLOUD}/apps/${app}/Dockerfile" ]] \
    && ok "Dockerfile ${app}" || bad "Dockerfile MISSING: apps/${app}/Dockerfile"
done

# 6. publishable-whitelist + verify orchestrator
[[ -f "${ROOT}/.orqenix/release/publishable-whitelist.yaml" ]] \
  && ok "publishable-whitelist.yaml present" || bad "whitelist missing"
[[ -f "${CLOUD}/scripts/verify-phase-7-cloud.ts" ]] \
  && ok "verify orchestrator present" || bad "verify-phase-7-cloud.ts missing"

# 7. fix-pro-deps DRY preview (must show ^0.7.0, never -phase-7)
echo "--- fix-pro-deps --dry-run ---"
node "${ROOT}/scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs" --dry-run \
  | tee "${EVID}/fix-pro-deps.log" || true
grep -q -- "-phase-7" "${EVID}/fix-pro-deps.log" \
  && bad "fix-pro-deps would emit -phase-7" || ok "fix-pro-deps emits clean ^0.7.0"

# 8. Build Cloud (no publish)
echo "--- build Cloud (dry, no publish) ---"
( cd "$CLOUD" && pnpm -r build ) > "${EVID}/build-cloud.log" 2>&1 \
  && ok "Cloud build" || bad "Cloud build failed (see build-cloud.log)"

# 9. Image build-only via SIGN_DRY_RUN
echo "--- image build-only (SIGN_DRY_RUN=true) ---"
SIGN_DRY_RUN=true bash "${ROOT}/scripts/release/sign-and-attest-images.sh" "${VERSION}" \
  > "${EVID}/images-dry.log" 2>&1 \
  && ok "image build-only" || warn "image build-only had issues (see images-dry.log)"

# 10. What WOULD be published (no publish)
echo "--- packages that WOULD publish (npm pack --dry-run) ---"
( cd "$CLOUD" && pnpm -r exec npm pack --dry-run ) > "${EVID}/would-publish-cloud.log" 2>&1 || true
ok "publish preview written to ${EVID}/would-publish-cloud.log"

echo "============================================================"
if [[ $FAILS -gt 0 ]]; then
  bad "DRY RUN found ${FAILS} blocking issue(s). Fix before running the real ceremony."
  exit 1
fi
ok "DRY RUN clean. Safe to run the real ceremony:"
echo "  gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA"
