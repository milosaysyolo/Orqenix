#Requires -PSEdition Core
# ───────────────────────────────────────────────────────
# Orqenix Phase 6 — Dev Environment Setup (Windows)
# ───────────────────────────────────────────────────────
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location -LiteralPath $RepoRoot

Write-Host "=== Orqenix Phase 6 — Dev Setup ===" -Foreground Cyan
Write-Host ""

# ── Prerequisites ──────────────────────────────────────
try {
  $nodeVer = node --version
  Write-Host "[ok] Node $nodeVer"
  $major = [int]($nodeVer -replace 'v','' -split '\.')[0]
  if ($major -lt 22) {
    Write-Host "ERROR: Node >=22 required (found $major)." -Foreground Red
    exit 1
  }
} catch {
  Write-Host "ERROR: Node.js is required. Install >=22." -Foreground Red
  exit 1
}

try {
  $pnpmVer = pnpm --version
  Write-Host "[ok] pnpm $pnpmVer"
} catch {
  Write-Host "[..] Installing pnpm via corepack…"
  corepack enable
  corepack prepare --activate
}

# ── Install dependencies ───────────────────────────────
Write-Host ""
Write-Host "=== Installing dependencies ===" -Foreground Cyan
pnpm install; if (-not $?) { exit 1 }

# ── Build all packages ─────────────────────────────────
Write-Host ""
Write-Host "=== Building all packages (Phase 6 scope) ===" -Foreground Cyan
pnpm build 2>&1 | Select-Object -Last 5; if (-not $?) { exit 1 }

# ── Option A: Orqenix-Pro as sibling ──────────────────
$ProSibling = Join-Path $RepoRoot "..\Orqenix-Pro"
if (Test-Path -LiteralPath $ProSibling) {
  Write-Host ""
  Write-Host "[ok] Orqenix-Pro sibling found at $ProSibling" -Foreground Green
  try {
    Push-Location -LiteralPath $ProSibling
    pnpm install; pnpm build
    Pop-Location
  } catch {
    Write-Host "[warn] Pro setup skipped (not critical for OSS dev)" -Foreground Yellow
  }
}

# ── Option B: Scaffold local config directory ──────────
$ConfigDir = ".orqenix"
if (-not (Test-Path -LiteralPath "$ConfigDir\identity")) {
  Write-Host ""
  Write-Host "=== Scaffolding local config ($ConfigDir) ===" -Foreground Cyan
  New-Item -ItemType Directory -Path "$ConfigDir\identity" -Force | Out-Null
  New-Item -ItemType Directory -Path "$ConfigDir\mesh" -Force | Out-Null

  if (-not (Test-Path -LiteralPath "$ConfigDir\identity\scope.yaml")) {
    @"
scope: "local-dev"
description: "Dev identity — replace with real scope for production"
"@ | Set-Content -Path "$ConfigDir\identity\scope.yaml" -NoNewline
    Write-Host "  created $ConfigDir\identity\scope.yaml"
  }

  if (-not (Test-Path -LiteralPath "$ConfigDir\mesh\transports.yaml")) {
    @"
http:
  enabled: true
  port: 0
libp2p:
  enabled: true
  adapters: ["tcp", "memory"]
discovery:
  mdns: true
  bootstrap: ["/ip4/127.0.0.1/tcp/0/p2p/placeholder"]
"@ | Set-Content -Path "$ConfigDir\mesh\transports.yaml" -NoNewline
    Write-Host "  created $ConfigDir\mesh\transports.yaml"
  }
} else {
  Write-Host "[skip] $ConfigDir already exists" -Foreground Yellow
}

# ── Summary ────────────────────────────────────────────
Write-Host ""
Write-Host "=== Setup complete ===" -Foreground Green
Write-Host ""
Write-Host "Quick start:"
Write-Host "  cd $RepoRoot"
Write-Host '  pnpm -F @orqenix/local-node run start'
Write-Host ""
Write-Host "Run all Phase 6 gates:"
Write-Host '  pnpm tsx scripts/gates/verify-phase-6.ts'
Write-Host ""
