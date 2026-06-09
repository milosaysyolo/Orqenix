#!/usr/bin/env bash
set -euo pipefail

# ───────────────────────────────────────────────────────
# Orqenix Phase 6 — Dev Environment Setup (Linux / macOS)
# ───────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Orqenix Phase 6 — Dev Setup ==="
echo ""

# ── Prerequisites ──────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required. Install >=22."; exit 1; }
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ERROR: Node >=22 required (found $NODE_MAJOR). Upgrade Node.js."
  exit 1
fi
echo "[ok] Node $(node --version)"

if command -v pnpm >/dev/null 2>&1; then
  echo "[ok] pnpm $(pnpm --version)"
else
  echo "[..] Installing pnpm via corepack…"
  corepack enable
  corepack prepare --activate
fi

# ── Install dependencies ───────────────────────────────
echo ""
echo "=== Installing dependencies ==="
pnpm install

# ── Build all packages ─────────────────────────────────
echo ""
echo "=== Building all packages (Phase 6 scope) ==="
pnpm build 2>&1 | tail -5

# ── Option A: Orqenix-Pro as sibling ──────────────────
PRO_SIBLING="../Orqenix-Pro"
if [ -d "$PRO_SIBLING" ]; then
  echo ""
  echo "[ok] Orqenix-Pro sibling found at $PRO_SIBLING"
  (cd "$PRO_SIBLING" && pnpm install && pnpm build) || echo "[warn] Pro setup skipped (not critical for OSS dev)"
fi

# ── Option B: Scaffold local config directory ──────────
CONFIG_DIR=".orqenix"
if [ ! -d "$CONFIG_DIR/identity" ]; then
  echo ""
  echo "=== Scaffolding local config ($CONFIG_DIR) ==="
  mkdir -p "$CONFIG_DIR/identity" "$CONFIG_DIR/mesh"

  # Default scope.yaml (placeholder)
  if [ ! -f "$CONFIG_DIR/identity/scope.yaml" ]; then
    cat > "$CONFIG_DIR/identity/scope.yaml" <<- 'YAML'
scope: "local-dev"
description: "Dev identity — replace with real scope for production"
YAML
    echo "  created $CONFIG_DIR/identity/scope.yaml"
  fi

  # Default transports.yaml
  if [ ! -f "$CONFIG_DIR/mesh/transports.yaml" ]; then
    cat > "$CONFIG_DIR/mesh/transports.yaml" <<- 'YAML'
http:
  enabled: true
  port: 0
libp2p:
  enabled: true
  adapters: ["tcp", "memory"]
discovery:
  mdns: true
  bootstrap: ["/ip4/127.0.0.1/tcp/0/p2p/placeholder"]
YAML
    echo "  created $CONFIG_DIR/mesh/transports.yaml"
  fi
else
  echo "[skip] $CONFIG_DIR already exists"
fi

# ── Summary ────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo ""
echo "Quick start:"
echo "  cd $REPO_ROOT"
echo "  pnpm -F @orqenix/local-node run start"
echo ""
echo "Or generate identity keys and run:"
echo "  mkdir -p .orqenix/identity .orqenix/mesh"
echo "  pnpm -F @orqenix/local-node run start"
echo ""
echo "Run all Phase 6 gates:"
echo "  pnpm tsx scripts/gates/verify-phase-6.ts"
echo ""
