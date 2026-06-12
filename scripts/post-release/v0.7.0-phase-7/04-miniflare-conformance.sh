#!/usr/bin/env bash
set -e
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
EVIDENCE="${REPO_ROOT}/out/v0.7.0-phase-7/evidence/item-4"
mkdir -p "${EVIDENCE}"

cd "${REPO_ROOT}"

ADAPTER_DIR="packages/cloud-adapter-cloudflare"
if [[ ! -d "${ADAPTER_DIR}" ]]; then
  echo "[04] Adapter dir not found: ${ADAPTER_DIR}"
  exit 2
fi

echo "[04] Checking if miniflare is available..."
if ! node -e "require('miniflare')" 2>/dev/null && ! pnpm ls -r miniflare 2>/dev/null | grep -q miniflare; then
  echo "[04] miniflare not installed — SKIP (requires npm registry access)"
  exit 2
fi

echo "[04] Running miniflare conformance suite..."
pnpm --filter @orqenix-cloud/cloud-adapter-cloudflare exec vitest \
  tests/miniflare-conformance.spec.ts --run \
  > "${EVIDENCE}/conformance.log" 2>&1 || {
  echo "[04] Miniflare conformance: FAIL"
  tail -20 "${EVIDENCE}/conformance.log"
  exit 1
}

echo "[04] Miniflare conformance: PASS"
exit 0
