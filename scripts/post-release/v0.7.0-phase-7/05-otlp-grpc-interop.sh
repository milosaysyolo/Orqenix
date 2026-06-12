#!/usr/bin/env bash
set -e
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
EVIDENCE="${REPO_ROOT}/out/v0.7.0-phase-7/evidence/item-5"
mkdir -p "${EVIDENCE}"

cd "${REPO_ROOT}"

if ! command -v docker > /dev/null 2>&1; then
  echo "[05] docker not available — SKIP"
  exit 2
fi

# Build the OTLP gRPC exporter
echo "[05] Building observability-otlp..."
pnpm --filter @orqenix-cloud/observability-otlp build > "${EVIDENCE}/build.log" 2>&1

# Run the vitest interop test directly — covers the grpc-native.test.ts
echo "[05] Running OTLP gRPC unit test..."
pnpm --filter @orqenix-cloud/observability-otlp exec vitest tests/grpc-native.test.ts --run \
  > "${EVIDENCE}/interop.log" 2>&1 || {
  echo "[05] FAIL: gRPC native test failed"
  cat "${EVIDENCE}/interop.log"
  exit 1
}

echo "[05] OTLP gRPC unit test: PASS (full collector interop requires otel-contrib docker)"
exit 0
