param([string]$AuditLog = "d6oss-deps-fix-audit.log")

$script:audit = $AuditLog

function Pkg-Publish {
  param([string]$Pkg, [string]$Dir, [string]$OldVer, [string]$NewVer)

  "===== Bump $Pkg $OldVer → $NewVer =====" | Add-Content $script:audit

  # Read with node to get clean JSON
  $json = node -e @"
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('$Dir/package.json', 'utf8'));
if (p.version !== '$OldVer') { console.error('FAIL: expected $OldVer, got ' + p.version); process.exit(1); }
p.version = '$NewVer';
// Fix provenance
p.publishConfig = p.publishConfig || {};
p.publishConfig.access = 'public';
p.publishConfig.provenance = false;
// Update inter-deps
const fields = ['dependencies', 'peerDependencies'];
for (const f of fields) {
  if (p[f]) {
    for (const [dep, ver] of Object.entries(p[f])) {
      if (dep.startsWith('@orqenix/') && ver === '^0.6.0-phase-6') {
        p[f][dep] = '^0.6.0';
        console.log('  dep ' + dep + ': ^0.6.0-phase-6 → ^0.6.0');
      }
    }
  }
}
fs.writeFileSync('$Dir/package.json', JSON.stringify(p, null, 2) + '\n');
console.log('OK: version=' + p.version);
"@ 2>&1
  $json | Add-Content $script:audit
  if ($json -notmatch 'OK: version=') { "FAIL: bump failed" | Add-Content $script:audit; exit 1 }

  # Build
  "" | Add-Content $script:audit
  "## Build $Pkg" | Add-Content $script:audit
  pnpm -F "@orqenix/$Pkg" build 2>&1 | Add-Content $script:audit
  if ($LASTEXITCODE -ne 0) { "FAIL: build exit $LASTEXITCODE" | Add-Content $script:audit; exit 1 }

  # Pack dry-run
  "" | Add-Content $script:audit
  "## Pack dry-run" | Add-Content $script:audit
  $root = (Get-Location).Path
  Set-Location $Dir
  npm pack --dry-run 2>&1 | Add-Content $script:audit
  Set-Location $root

  # Publish
  "" | Add-Content $script:audit
  "## Publishing $Pkg@$NewVer" | Add-Content $script:audit
  Set-Location $Dir
  pnpm publish --access public --tag latest --no-git-checks 2>&1 | Add-Content $script:audit
  $exit = $LASTEXITCODE
  Set-Location $root

  if ($exit -ne 0) { "FAIL: publish exit $exit" | Add-Content $script:audit; exit 1 }
  "PASS: $Pkg published" | Add-Content $script:audit

  # Verify
  $tries = 0
  $pub = ""
  while ($tries -lt 10) {
    $pub = npm view "@orqenix/$Pkg@$NewVer" version 2>$null
    if ($pub -eq $NewVer) { break }
    $tries++
    "Waiting 30s..." | Add-Content $script:audit
    Start-Sleep -Seconds 30
  }
  if ($pub -ne $NewVer) { "FAIL: $Pkg@$NewVer not visible" | Add-Content $script:audit; exit 1 }
  $sha = npm view "@orqenix/$Pkg@$NewVer" dist.shasum
  "PASS: @orqenix/$Pkg@$NewVer (shasum: $sha)" | Add-Content $script:audit
}

# Topological order
# Pkg-Publish -Pkg "mesh-transport-core" -Dir "packages/mesh-transport-core" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"  # already published
Pkg-Publish -Pkg "mesh-observability" -Dir "packages/mesh-observability" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"
Pkg-Publish -Pkg "transport-security" -Dir "packages/transport-security" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"
Pkg-Publish -Pkg "mesh-transport-http" -Dir "packages/mesh-transport-http" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"
Pkg-Publish -Pkg "mesh-transport-libp2p" -Dir "packages/mesh-transport-libp2p" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"
Pkg-Publish -Pkg "mesh-router" -Dir "packages/mesh-router" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"
Pkg-Publish -Pkg "mesh-discovery" -Dir "packages/mesh-discovery" -OldVer "0.6.0-phase-6" -NewVer "0.6.0"

# Summary
"" | Add-Content $script:audit
"## Phase C Summary" | Add-Content $script:audit
foreach ($pkg in @("mesh-transport-core","mesh-observability","transport-security","mesh-transport-http","mesh-transport-libp2p","mesh-router","mesh-discovery")) {
  $actual = npm view "@orqenix/$pkg@0.6.0" version 2>$null
  if ($actual) { "PASS: @orqenix/$pkg@0.6.0" | Add-Content $script:audit }
  else { "FAIL: @orqenix/$pkg@0.6.0" | Add-Content $script:audit }
}
