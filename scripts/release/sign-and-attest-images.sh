#!/usr/bin/env bash
# ============================================================================
# Orqenix Phase 7 — Build + Cosign Sign + SBOM Attest 3 container images
# Usage: bash sign-and-attest-images.sh <version>   (default 0.7.0, clean semver)
#
# Requires (CI / Linux + OIDC):
#   - docker (buildx)            image build
#   - cosign                     keyless signing (id-token: write)
#   - syft                       SBOM generation (CycloneDX)
#   - GHCR auth                  docker login ghcr.io (CI uses GITHUB_TOKEN)
#
# Keyless signing uses Figment/Sigstore OIDC — NO long-lived keys (Phase 5/6
# lesson: never persist signing keys; rely on GitHub Actions OIDC identity).
# ============================================================================
set -euo pipefail

VERSION="${1:-${RELEASE_VERSION:-0.7.0}}"
REGISTRY="${REGISTRY:-ghcr.io/milosaysyolo}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLOUD="${ROOT}/../Orqenix-Cloud"
EVID="${ROOT}/out/close-phase-7/images"
mkdir -p "${EVID}"

say(){ printf "\033[1;36m[images]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[images WARN]\033[0m %s\n" "$*"; }
die(){ printf "\033[1;31m[images FAIL]\033[0m %s\n" "$*"; exit 1; }

# ---- Guard: clean semver, tools present ----
[[ "$VERSION" == *"-phase-7"* ]] && die "Image tag must be clean semver (got: $VERSION)"
command -v docker >/dev/null || die "docker not found"
command -v cosign >/dev/null || die "cosign not found (sigstore/cosign-installer)"
[[ -d "$CLOUD" ]] || die "Orqenix-Cloud repo not found at ${CLOUD}"

SYFT_OK=1
command -v syft >/dev/null 2>&1 || { warn "syft not found — SBOM will be skipped"; SYFT_OK=0; }

# Sigstore experimental flag for keyless (older cosign); harmless on newer.
export COSIGN_EXPERIMENTAL=1

# ---- Image matrix: name -> Dockerfile context (relative to Cloud repo) ----
# 3 images per D7.18: relay, web, worker
declare -A IMAGES=(
  ["orqenix-cloud-relay"]="apps/cloud-relay"
  ["orqenix-cloud-web"]="apps/cloud-web"
  ["orqenix-cloud-worker"]="apps/cloud-worker"
)

# ---- Optional dry-run for local validation (no push/sign) ----
DRY="${SIGN_DRY_RUN:-false}"
if [[ "$DRY" == "true" ]]; then
  warn "SIGN_DRY_RUN=true — build only, no push/sign/attest (local validation)"
fi

# ============================================================================
# Build, push, sign, attest each image
# ============================================================================
SIGNED=()
for name in "${!IMAGES[@]}"; do
  ctx="${CLOUD}/${IMAGES[$name]}"
  ref="${REGISTRY}/${name}:${VERSION}"
  dockerfile="${ctx}/Dockerfile"

  say "Image: ${ref}"
  [[ -f "$dockerfile" ]] || { warn "Dockerfile missing: ${dockerfile} — skip ${name}"; continue; }

  # ---- Build ----
  say "  [build] ${name}"
  if [[ "$DRY" == "true" ]]; then
    docker build -t "${ref}" -f "${dockerfile}" "${ctx}" \
      > "${EVID}/build-${name}.log" 2>&1 || die "build failed: ${name}"
    say "  [dry-run] skip push/sign/attest for ${name}"
    continue
  fi

  # buildx with provenance + sbom attestation baked by buildkit
  docker buildx build \
    --platform linux/amd64 \
    --tag "${ref}" \
    --file "${dockerfile}" \
    --provenance=true \
    --sbom=true \
    --push \
    "${ctx}" > "${EVID}/build-${name}.log" 2>&1 \
    || die "buildx build/push failed: ${name}"

  # Resolve immutable digest (sign by digest, not mutable tag — best practice)
  digest="$(docker buildx imagetools inspect "${ref}" --format '{{json .Manifest}}' \
    | grep -oE '"digest":\s*"sha256:[a-f0-9]+"' | head -1 | grep -oE 'sha256:[a-f0-9]+')"
  [[ -n "$digest" ]] || die "could not resolve digest for ${ref}"
  ref_by_digest="${REGISTRY}/${name}@${digest}"
  say "  digest: ${digest}"

  # ---- Cosign keyless sign (OIDC) ----
  say "  [sign] cosign keyless ${name}"
  cosign sign --yes "${ref_by_digest}" \
    > "${EVID}/cosign-sign-${name}.log" 2>&1 \
    || die "cosign sign failed: ${name}"

  # ---- SBOM (CycloneDX) + attest ----
  if [[ "$SYFT_OK" == "1" ]]; then
    say "  [sbom] generate CycloneDX for ${name}"
    syft "${ref_by_digest}" -o cyclonedx-json="${EVID}/sbom-${name}.cdx.json" \
      > "${EVID}/syft-${name}.log" 2>&1 \
      || die "syft SBOM failed: ${name}"

    say "  [attest] cosign attest CycloneDX SBOM ${name}"
    cosign attest --yes \
      --predicate "${EVID}/sbom-${name}.cdx.json" \
      --type cyclonedx \
      "${ref_by_digest}" \
      > "${EVID}/cosign-attest-${name}.log" 2>&1 \
      || die "cosign attest failed: ${name}"
  else
    warn "  SBOM skipped for ${name} (syft missing) — install anchore/syft"
  fi

  # ---- Verify what we just signed (fail-closed) ----
  say "  [verify] cosign verify signature ${name}"
  cosign verify "${ref_by_digest}" \
    --certificate-identity-regexp "https://github.com/milosaysyolo/.*" \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    > "${EVID}/cosign-verify-${name}.log" 2>&1 \
    || die "cosign verify failed (signature not valid): ${name}"

  if [[ "$SYFT_OK" == "1" ]]; then
    say "  [verify] cosign verify-attestation (cyclonedx) ${name}"
    cosign verify-attestation "${ref_by_digest}" \
      --type cyclonedx \
      --certificate-identity-regexp "https://github.com/milosaysyolo/.*" \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      > "${EVID}/cosign-verify-attest-${name}.log" 2>&1 \
      || die "cosign verify-attestation failed: ${name}"
  fi

  SIGNED+=("${name}@${digest}")
  say "  ✅ ${name} built + signed + attested + verified"
done

# ============================================================================
# Summary
# ============================================================================
say "----------------------------------------------------------------------"
if [[ "$DRY" == "true" ]]; then
  say "Dry-run complete. ${#IMAGES[@]} image(s) built locally, not pushed."
  exit 0
fi

[[ ${#SIGNED[@]} -gt 0 ]] || die "No images were signed — check Dockerfile paths"

say "Signed + attested ${#SIGNED[@]} image(s):"
for s in "${SIGNED[@]}"; do say "  - ${REGISTRY}/${s}"; done

# Write machine-readable summary for the ceremony evidence
{
  echo "{"
  echo "  \"version\": \"${VERSION}\","
  echo "  \"registry\": \"${REGISTRY}\","
  echo "  \"signed\": ["
  for i in "${!SIGNED[@]}"; do
    sep=","; [[ $i -eq $((${#SIGNED[@]}-1)) ]] && sep=""
    echo "    \"${REGISTRY}/${SIGNED[$i]}\"${sep}"
  done
  echo "  ],"
  echo "  \"keyless\": true,"
  echo "  \"sbom\": $([[ "$SYFT_OK" == "1" ]] && echo true || echo false),"
  echo "  \"oidc_issuer\": \"https://token.actions.githubusercontent.com\""
  echo "}"
} > "${EVID}/summary.json"

say "Evidence: ${EVID}/summary.json"
say "Image signing complete for ${VERSION}."
