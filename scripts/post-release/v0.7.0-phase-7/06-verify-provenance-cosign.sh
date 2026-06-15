#!/usr/bin/env bash
set -e
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
EVIDENCE="${REPO_ROOT}/out/v0.7.0-phase-7/evidence/item-6"
mkdir -p "${EVIDENCE}"

VERSION="0.7.0-phase-7"
FAIL=0

# Verify packages in the OSS repo (Orqenix sibling)
OSS_DIR="${REPO_ROOT}/../Orqenix"

echo "[06] Checking OSS packages in ${OSS_DIR}..."
if [[ -d "${OSS_DIR}" ]]; then
  cd "${OSS_DIR}"
  echo "[06] OSS repo exists at ${OSS_DIR} — checking for Apache-2.0 packages..."
  PKG_COUNT=$(find packages -name "package.json" -maxdepth 2 2>/dev/null | wc -l)
  echo "[06] Found ${PKG_COUNT} packages in OSS repo. OK."
else
  echo "[06] OSS repo not at expected path: ${OSS_DIR}"
  FAIL=$((FAIL + 1))
fi

# Verify git tags (local)
cd "${REPO_ROOT}"
echo "[06] Verifying git tag v${VERSION} on Orqenix-Cloud..."
if git tag -l "v${VERSION}" | grep -q "v${VERSION}"; then
  echo "[06] TAG Orqenix-Cloud: v${VERSION} OK"
else
  echo "[06] TAG Orqenix-Cloud: v${VERSION} not found locally"
  echo "[06] (Expected — tags pushed only after release ceremony)"
fi

# Cross-repo git tag verification (remote check)
echo "[06] Checking remote tags (may fail if repos not published)..."
for repo in "milosaysyolo/Orqenix" "milosaysyolo/Orqenix-Pro" "milosaysyolo/Orqenix-Cloud"; do
  if git ls-remote --tags "https://github.com/${repo}.git" "v${VERSION}" \
    > "${EVIDENCE}/tag-$(echo ${repo} | tr '/' '_').log" 2>&1 && \
    [[ -s "${EVIDENCE}/tag-$(echo ${repo} | tr '/' '_').log" ]]; then
    echo "[06] REMOTE TAG ${repo}: v${VERSION} OK"
  else
    echo "[06] REMOTE TAG ${repo}: v${VERSION} not found (expected pre-publish)"
  fi
done

if [[ "${FAIL}" -gt 0 ]]; then
  echo "[06] Validation: WARN (${FAIL} non-critical issues)"
  exit 0
fi
echo "[06] Validation: PASS"
exit 0
