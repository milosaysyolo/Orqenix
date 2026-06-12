#!/usr/bin/env bash
# Post-release validation orchestrator for v0.7.0-phase-7
# Usage: bash scripts/post-release/v0.7.0-phase-7/run-all.sh [--strict] [--skip-item N]

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
OUT_DIR="${REPO_ROOT}/out/v0.7.0-phase-7"
RESULTS="${OUT_DIR}/results.jsonl"
REPORT="${OUT_DIR}/report.md"
EVIDENCE="${OUT_DIR}/evidence"

STRICT=0
SKIP_ITEMS=()
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --skip-item=*) SKIP_ITEMS+=("${arg#--skip-item=}") ;;
  esac
done

mkdir -p "${OUT_DIR}" "${EVIDENCE}"
: > "${RESULTS}"

log() { printf "\033[1;36m[orchestrator]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[FAIL]\033[0m %s\n" "$*"; }
pass() { printf "\033[1;32m[PASS]\033[0m %s\n" "$*"; }

emit_result() {
  local id="$1" name="$2" status="$3" severity="$4" duration_ms="$5" evidence="$6"
  printf '{"id":"%s","name":"%s","status":"%s","severity":"%s","duration_ms":%s,"evidence":"%s","ts":"%s"}\n' \
    "$id" "$name" "$status" "$severity" "$duration_ms" "$evidence" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >> "${RESULTS}"
}

run_item() {
  local num="$1" id="$2" name="$3" severity="$4" cmd="$5"
  for skip in "${SKIP_ITEMS[@]}"; do
    if [[ "$skip" == "$num" ]]; then
      log "SKIP item ${num}: ${name} (user requested)"
      emit_result "$id" "$name" "SKIP" "$severity" 0 "user-skip"
      return 0
    fi
  done

  log "Running item ${num}/${TOTAL}: ${name}"
  local start=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
  local evidence_dir="${EVIDENCE}/item-${num}"
  mkdir -p "${evidence_dir}"

  if bash -c "${cmd}" > "${evidence_dir}/stdout.log" 2> "${evidence_dir}/stderr.log"; then
    local rc=0
  else
    local rc=$?
  fi

  local end=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
  local dur=$((end - start))

  case "$rc" in
    0) pass "Item ${num}: ${name} (${dur}ms)"; emit_result "$id" "$name" "PASS" "$severity" "$dur" "evidence/item-${num}" ;;
    2) log "Item ${num}: SKIP (${dur}ms)"; emit_result "$id" "$name" "SKIP" "$severity" "$dur" "evidence/item-${num}" ;;
    *) fail "Item ${num}: ${name} (rc=${rc}, ${dur}ms)"; emit_result "$id" "$name" "FAIL" "$severity" "$dur" "evidence/item-${num}"
       if [[ "$severity" == "P0" && "$STRICT" == "1" ]]; then
         fail "P0 failure in strict mode — stopping"
         FAILED_P0=1
         return 1
       fi
       ;;
  esac
  return 0
}

TOTAL=7
FAILED_P0=0
log "Starting post-release validation for v0.7.0-phase-7 (strict=${STRICT})"

run_item 1 "rerender-d7.4" "Re-render D7.4 report"           "P1" "node ${SCRIPT_DIR}/01-rerender-d7.4-report.mjs"
run_item 2 "benchmarks"    "Measure real benchmarks"          "P0" "bash ${SCRIPT_DIR}/02-measure-benchmarks.sh"
run_item 3 "fresh-clone"   "Fresh-clone smoke test"           "P0" "bash ${SCRIPT_DIR}/03-fresh-clone-smoke.sh"
run_item 4 "miniflare"     "Miniflare conformance"            "P0" "bash ${SCRIPT_DIR}/04-miniflare-conformance.sh"
run_item 5 "otlp-grpc"     "OTLP gRPC interop"                "P0" "bash ${SCRIPT_DIR}/05-otlp-grpc-interop.sh"
run_item 6 "provenance"    "Verify provenance + cosign"       "P0" "bash ${SCRIPT_DIR}/06-verify-provenance-cosign.sh"
run_item 7 "pro-deps"      "Pro deps republish audit"         "P1" "node ${SCRIPT_DIR}/07-pro-deps-republish-audit.mjs"

log "Generating report"
node "${SCRIPT_DIR}/generate-report.mjs" --in "${RESULTS}" --out "${REPORT}"

if [[ "$FAILED_P0" == "1" ]]; then
  fail "GO/NO-GO: NO-GO (P0 failures detected). See ${REPORT}"
  exit 1
fi

if grep -E '"status":"FAIL","severity":"P0"' "${RESULTS}" > /dev/null 2>&1; then
  fail "GO/NO-GO: NO-GO. See ${REPORT}"
  exit 1
fi

pass "GO/NO-GO: GO. See ${REPORT}"
exit 0
