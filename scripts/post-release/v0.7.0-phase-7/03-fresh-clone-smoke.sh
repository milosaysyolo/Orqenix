#!/usr/bin/env bash
set -e
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
EVIDENCE="${REPO_ROOT}/out/v0.7.0-phase-7/evidence/item-3"
mkdir -p "${EVIDENCE}"

SMOKE_DIR=$(mktemp -d -t orqenix-smoke-XXXXXX)
trap 'rm -rf "${SMOKE_DIR}"' EXIT

echo "[03] Smoke dir: ${SMOKE_DIR}"
cd "${SMOKE_DIR}"

cat > package.json << 'EOF'
{
  "name": "orqenix-smoke-consumer",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
EOF

PACKAGES=(
  "@orqenix-cloud/relay-protocol@0.7.0-phase-7"
  "@orqenix-cloud/relay-transport@0.7.0-phase-7"
)

echo "[03] Installing packages..."
npm install --no-audit --no-fund --loglevel=error "${PACKAGES[@]}" \
  > "${EVIDENCE}/install.log" 2>&1 || true

if grep -r "workspace:" node_modules/@orqenix-cloud 2>/dev/null | head -5 > "${EVIDENCE}/workspace-leak.log"; then
  if [[ -s "${EVIDENCE}/workspace-leak.log" ]]; then
    echo "[03] FAIL: workspace:^ leakage detected"
    cat "${EVIDENCE}/workspace-leak.log"
    exit 1
  fi
fi

cat > test-import.mjs << 'EOF'
const packages = [
  '@orqenix-cloud/relay-protocol',
  '@orqenix-cloud/relay-transport',
];
for (const pkg of packages) {
  try {
    const mod = await import(pkg);
    const keys = Object.keys(mod);
    if (keys.length === 0) {
      console.error('FAIL: ' + pkg + ' exports nothing');
      process.exit(1);
    }
    console.log('OK: ' + pkg + ' exports ' + keys.length + ' symbol(s)');
  } catch (e) {
    console.error('FAIL: ' + pkg + ': ' + e.message);
    process.exit(1);
  }
}
console.log('All imports OK');
EOF

node test-import.mjs > "${EVIDENCE}/import.log" 2>&1
cat "${EVIDENCE}/import.log"

echo "[03] Fresh-clone smoke test (offline variant): PASS"
exit 0
