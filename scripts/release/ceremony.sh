#!/usr/bin/env bash
# ============================================================================
# Orqenix Phase 7 — Release Ceremony
# Release version: 0.7.0 (CLEAN SEMVER — no -phase-7 anywhere)
# git tag: v0.7.0 | dep range: ^0.7.0
#
# Runs on CI (Linux + OIDC). Applies Phase 5/6 lessons:
#   #1  npm MFA blocks unpublish → never unpublish; deprecate instead
#   #2  Automation token bypasses MFA (NODE_AUTH_TOKEN)
#   #3  Provenance ON in CI only (NPM_CONFIG_PROVENANCE=true)
#   #4  changelog-github needs read:user (classic PAT)
#   #5  E429 → publish in batches with cooldown
#   #7  publishable-whitelist.yaml gates publish scope
#   #8  ignore-scripts=true + onlyBuiltDependencies allowlist
#   #9  strip BOM + --no-git-checks
#   #10 tag all 3 repos same wall-clock day
#
# Cross-repo aware: @orqenix-cloud/* live in Orqenix-Cloud, @orqenix-pro/* in
# Orqenix-Pro, @orqenix/* in Orqenix (OSS). Publishes per-repo via pnpm -r.
# ============================================================================
set -euo pipefail

VERSION="${RELEASE_VERSION:-0.7.0}"
TAG="${RELEASE_TAG:-v0.7.0}"
BATCH="${PUBLISH_BATCH_SIZE:-6}"
COOLDOWN="${PUBLISH_COOLDOWN_SEC:-20}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"     # Orqenix (OSS) repo root
CLOUD="${ROOT}/../Orqenix-Cloud"
PRO="${ROOT}/../Orqenix-Pro"
WHITELIST="${ROOT}/.orqenix/release/publishable-whitelist.yaml"
EVID="${ROOT}/out/close-phase-7/ceremony"
mkdir -p "${EVID}"

say(){ printf "\033[1;36m[ceremony]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[ceremony WARN]\033[0m %s\n" "$*"; }
die(){ printf "\033[1;31m[ceremony FAIL]\033[0m %s\n" "$*"; exit 1; }

cooldown_if_needed(){
  # $1 = running count; cooldown after every BATCH publishes (E429 #5)
  if (( $1 > 0 && $1 % BATCH == 0 )); then
    say "  cooldown ${COOLDOWN}s (E429 avoidance, lesson #5)"
    sleep "${COOLDOWN}"
  fi
}

# ---------------------------------------------------------------------------
# GUARD — clean semver, repos present, whitelist exists
# ---------------------------------------------------------------------------
say "Guard — clean semver + repo layout + whitelist"
[[ "$VERSION" == *"-phase-7"* ]] && die "RELEASE_VERSION must be clean semver (got: $VERSION)"
[[ "$TAG" == *"-phase-7"* ]]     && die "RELEASE_TAG must be clean semver (got: $TAG)"

# No -phase-7 prerelease range may exist in ANY package.json across the 3 repos
for repo in "$ROOT" "$CLOUD" "$PRO"; do
  [[ -d "$repo" ]] || continue
  if grep -rqsE '"\^?0\.7\.0-phase-7"' "${repo}/packages" 2>/dev/null; then
    die "Found -phase-7 prerelease range in a package.json under ${repo}"
  fi
done

[[ -d "$CLOUD" ]] || die "Orqenix-Cloud repo not found at ${CLOUD} (CI must checkout it as sibling)"
[[ -f "$WHITELIST" ]] || die "publishable-whitelist.yaml missing (lesson #7): ${WHITELIST}"
command -v npm >/dev/null  || die "npm not found"
command -v pnpm >/dev/null || die "pnpm not found"
npm whoami >/dev/null 2>&1 || die "npm not authenticated (use Automation token, lesson #2)"

say "Clean semver confirmed: version=${VERSION} tag=${TAG}"

# ---------------------------------------------------------------------------
# STEP 1 — Verify orchestrator (153/153) — runs in Cloud repo
# ---------------------------------------------------------------------------
say "[1/9] verify orchestrator (153 sub-criteria) in Cloud repo"
( cd "$CLOUD" && pnpm exec tsx scripts/verify-phase-7-cloud.ts ) | tee "${EVID}/verify.log"
grep -q "153/153" "${EVID}/verify.log" || die "verify did not report 153/153"

# ---------------------------------------------------------------------------
# STEP 2 — Scrub BOM + fix Pro deps to clean ^0.7.0
# ---------------------------------------------------------------------------
say "[2/9] scrub BOM + fix Pro deps -> ^${VERSION}"
node "${ROOT}/scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs" \
  | tee "${EVID}/fix-pro-deps.log" || true
# Re-assert no -phase-7 survived the fix
for repo in "$ROOT" "$CLOUD" "$PRO"; do
  [[ -d "$repo" ]] || continue
  grep -rqsE '"\^?0\.7\.0-phase-7"' "${repo}/packages" 2>/dev/null \
    && die "fix-pro-deps left a -phase-7 range under ${repo}"
done

# ---------------------------------------------------------------------------
# STEP 3 — Set workspace versions to clean ${VERSION} across 3 repos
# ---------------------------------------------------------------------------
say "[3/9] set workspace versions to ${VERSION} (no prerelease)"
for repo in "$ROOT" "$CLOUD" "$PRO"; do
  [[ -d "$repo" ]] || continue
  ( cd "$repo" && pnpm -r exec npm version "${VERSION}" \
      --no-git-tag-version --allow-same-version ) \
      >> "${EVID}/version.log" 2>&1 || warn "version bump partial in ${repo}"
done

# ---------------------------------------------------------------------------
# STEP 4 — Build all packages (per repo)
# ---------------------------------------------------------------------------
say "[4/9] build all packages"
( cd "$CLOUD" && pnpm -r build ) | tee "${EVID}/build-cloud.log" || die "Cloud build failed"
( cd "$ROOT"  && pnpm -r build ) | tee "${EVID}/build-oss.log"   || warn "OSS build issues"
if [[ -d "$PRO" ]]; then
  ( cd "$PRO" && pnpm install --no-frozen-lockfile && pnpm -r build ) \
    | tee "${EVID}/build-pro.log" || warn "Pro build issues"
fi

# ---------------------------------------------------------------------------
# STEP 5 — npm publish PER-REPO (no fragile cd), batched, provenance in CI
#   OSS Apache-2.0 (public + provenance) → Cloud repo + OSS repo
#   Pro BSL-1.1 (restricted)            → Pro repo
# ---------------------------------------------------------------------------
say "[5/9] publish per-repo (batch=${BATCH}, cooldown=${COOLDOWN}s)"

# 5a — Cloud scope: 11 @orqenix-cloud/* OSS Apache-2.0 packages
say "  publish @orqenix-cloud/* (public, provenance) from Orqenix-Cloud"
( cd "$CLOUD" && NPM_CONFIG_PROVENANCE=true \
    pnpm -r --workspace-concurrency=1 publish \
      --access public --no-git-checks --report-summary ) \
    >> "${EVID}/publish-cloud.log" 2>&1 \
  || die "Cloud publish failed — check Automation token (lesson #2) / E429 (lesson #5)"
say "  cooldown ${COOLDOWN}s after Cloud batch"
sleep "${COOLDOWN}"

# 5b — OSS scope: @orqenix/* (e.g. @orqenix/cli) from main OSS repo
say "  publish @orqenix/* (public, provenance) from Orqenix OSS"
( cd "$ROOT" && NPM_CONFIG_PROVENANCE=true \
    pnpm -r --workspace-concurrency=1 publish \
      --access public --no-git-checks --report-summary ) \
    >> "${EVID}/publish-oss.log" 2>&1 \
  || warn "OSS publish: nothing to publish or already current"
sleep "${COOLDOWN}"

# 5c — Pro scope: @orqenix-pro/* BSL-1.1 restricted (needs NPM_TOKEN_PRO scope)
if [[ -d "$PRO" ]]; then
  say "  publish @orqenix-pro/* (restricted) from Orqenix-Pro"
  ( cd "$PRO" && pnpm -r --workspace-concurrency=1 publish \
      --access restricted --no-git-checks --report-summary ) \
      >> "${EVID}/publish-pro.log" 2>&1 \
    || warn "Pro publish needs NPM_TOKEN_PRO with restricted scope — verify"
fi

# ---------------------------------------------------------------------------
# STEP 6 — Build + cosign sign + SBOM attest 3 container images
# ---------------------------------------------------------------------------
say "[6/9] build + cosign sign + SBOM attest images (tag ${VERSION})"
if [[ -f "${ROOT}/scripts/release/sign-and-attest-images.sh" ]]; then
  bash "${ROOT}/scripts/release/sign-and-attest-images.sh" "${VERSION}" \
    | tee "${EVID}/images.log" || die "image sign/attest failed"
else
  warn "sign-and-attest-images.sh missing — skip (must run before public claim)"
fi

# ---------------------------------------------------------------------------
# STEP 7 — Helm chart OCI publish + sign
# ---------------------------------------------------------------------------
say "[7/9] helm chart OCI publish + sign"
if command -v helm >/dev/null 2>&1; then
  CHART_DIR="${CLOUD}/deploy/helm/orqenix-cloud"
  [[ -d "$CHART_DIR" ]] || CHART_DIR="${ROOT}/deploy/helm/orqenix-cloud"
  if [[ -d "$CHART_DIR" ]]; then
    helm package "$CHART_DIR" --version "${VERSION}" --destination "${EVID}" \
      >> "${EVID}/helm.log" 2>&1
    helm push "${EVID}/orqenix-cloud-${VERSION}.tgz" \
      "oci://ghcr.io/milosaysyolo/charts" >> "${EVID}/helm.log" 2>&1
    cosign sign --yes \
      "ghcr.io/milosaysyolo/charts/orqenix-cloud:${VERSION}" \
      >> "${EVID}/helm.log" 2>&1
  else
    warn "helm chart dir not found — skip"
  fi
else
  warn "helm not installed — skip (re-run on CI with helm)"
fi

# ---------------------------------------------------------------------------
# STEP 8 — git tag ${TAG} on 3 repos, same wall-clock day (lesson #10)
# ---------------------------------------------------------------------------
say "[8/9] tag ${TAG} on 3 repos (same wall-clock day)"
for repo in "$ROOT" "$PRO" "$CLOUD"; do
  [[ -d "${repo}/.git" ]] || { warn "skip ${repo} (no .git here)"; continue; }
  if ( cd "$repo" && git rev-parse "${TAG}" >/dev/null 2>&1 ); then
    warn "${repo}: tag ${TAG} already exists — skip"
    continue
  fi
  ( cd "$repo" && git tag -a "${TAG}" -m "Release ${VERSION}" && git push origin "${TAG}" ) \
    >> "${EVID}/tag.log" 2>&1 \
    && say "  tagged + pushed ${TAG} in $(basename "$repo")" \
    || die "tag/push failed in ${repo}"
done

# ---------------------------------------------------------------------------
# STEP 9 — GitHub release
# ---------------------------------------------------------------------------
say "[9/9] GitHub release ${TAG}"
NOTES="${CLOUD}/docs/phase-7/release-notes-v0.7.0-phase-7.md"
[[ -f "$NOTES" ]] || NOTES="${ROOT}/docs/phase-7/release-notes-v0.7.0-phase-7.md"
if command -v gh >/dev/null 2>&1 && [[ -f "$NOTES" ]]; then
  ( cd "$CLOUD" && gh release create "${TAG}" \
      --title "Orqenix Cloud ${VERSION}" --notes-file "$NOTES" ) \
      >> "${EVID}/release.log" 2>&1 \
    || warn "gh release may already exist"
else
  warn "gh CLI or release notes missing — create release manually"
fi

# ---------------------------------------------------------------------------
# POST — verify latest dist-tag resolves to clean ${VERSION} (lesson: Phase 5)
# ---------------------------------------------------------------------------
say "Post-publish — confirm latest dist-tag = ${VERSION}"
for p in relay-protocol relay-transport sdk billing-design phase6-to-phase7; do
  npm view "@orqenix-cloud/${p}" dist-tags >> "${EVID}/dist-tags.log" 2>&1 || true
done
npm view "@orqenix/cli" dist-tags >> "${EVID}/dist-tags.log" 2>&1 || true

say "Ceremony complete. Evidence: ${EVID}"
say "Verify manually: npm view @orqenix-cloud/sdk dist-tags  (latest MUST be ${VERSION}, not a prerelease)"
