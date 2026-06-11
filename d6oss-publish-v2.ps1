$auditLog = "d6oss-deps-fix-audit.log"
$root = "C:\Users\vnet-1-vm-c1\Documents\GitHub\Orqenix"
$pkgs = @(
  @{Name="mesh-observability"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
  @{Name="transport-security"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
  @{Name="mesh-transport-http"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
  @{Name="mesh-transport-libp2p"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
  @{Name="mesh-router"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
  @{Name="mesh-discovery"; OldVer="0.6.0-phase-6"; NewVer="0.6.0"}
)

foreach ($pkg in $pkgs) {
  $name = $pkg.Name
  $old = $pkg.OldVer
  $new = $pkg.NewVer
  $dir = "$root\packages\$name"

  "===== $name $old -> $new =====" | Add-Content $auditLog

  # Read and bump via temp file to avoid here-string BOM issues
  $jsonPath = "$dir\package.json"
  $jsonBytes = [System.IO.File]::ReadAllBytes($jsonPath)
  $json = [System.Text.Encoding]::UTF8.GetString($jsonBytes).TrimStart("$([char]0xFEFF)")

  $psobj = $json | ConvertFrom-Json
  if ($psobj.version -ne $old) {
    "FAIL: expected $old got $($psobj.version)" | Add-Content $auditLog
    exit 1
  }
  $psobj.version = $new
  $psobj.publishConfig = $psobj.publishConfig | ForEach-Object { $_ } 2>$null
  if (-not $psobj.publishConfig) { $psobj.publishConfig = @{} }
  $psobj.publishConfig.access = "public"
  $psobj.publishConfig.provenance = $false

  # Update inter-deps
  $deps = @{}
  if ($psobj.dependencies) { $deps = $psobj.dependencies }
  $updated = @()
  foreach ($dep in $deps.PSObject.Properties) {
    if ($dep.Name -like "@orqenix/*" -and $dep.Value -eq "^0.6.0-phase-6") {
      $deps.$($dep.Name) = "^0.6.0"
      $updated += $dep.Name
    }
  }
  if ($updated.Count -gt 0) {
    "  Updated inter-deps: $($updated -join ', ')" | Add-Content $auditLog
  }
  $psobj.dependencies = $deps

  # Write back
  $newJson = $psobj | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($jsonPath, $newJson + "`n", [System.Text.Encoding]::UTF8)
  "Bumped to $new" | Add-Content $auditLog

  # Build
  "" | Add-Content $auditLog
  "## Build $name" | Add-Content $auditLog
  Set-Location $root
  pnpm -F "@orqenix/$name" build 2>&1 | Add-Content $auditLog
  if ($LASTEXITCODE -ne 0) { "FAIL: build" | Add-Content $auditLog; exit 1 }

  # Pack dry-run
  "" | Add-Content $auditLog
  "## Pack dry-run" | Add-Content $auditLog
  Set-Location $dir
  npm pack --dry-run 2>&1 | Add-Content $auditLog
  Set-Location $root

  # Publish
  "" | Add-Content $auditLog
  "## Publishing $name@$new" | Add-Content $auditLog
  Set-Location $dir
  npm publish --access public 2>&1 | Add-Content $auditLog
  $exitCode = $LASTEXITCODE
  Set-Location $root
  if ($exitCode -ne 0) { "FAIL: publish exit $exitCode" | Add-Content $auditLog; exit 1 }
  "PASS: published" | Add-Content $auditLog

  # Verify
  $tries = 0
  $pub = ""
  while ($tries -lt 10) {
    $pub = npm view "@orqenix/$name@$new" version 2>$null
    if ($pub -eq $new) { break }
    $tries++
    "Waiting 30s..." | Add-Content $auditLog
    Start-Sleep -Seconds 30
  }
  if ($pub -ne $new) { "FAIL: $name@$new not visible" | Add-Content $auditLog; exit 1 }
  $sha = npm view "@orqenix/$name@$new" dist.shasum
  "PASS: @orqenix/$name@$new (shasum: $sha)" | Add-Content $auditLog
}

# Summary
"" | Add-Content $auditLog
"## Phase C Summary" | Add-Content $auditLog
foreach ($pkg in @("mesh-transport-core","mesh-observability","transport-security","mesh-transport-http","mesh-transport-libp2p","mesh-router","mesh-discovery")) {
  $actual = npm view "@orqenix/$pkg@0.6.0" version 2>$null
  if ($actual) { "PASS: @orqenix/$pkg@0.6.0" | Add-Content $auditLog }
  else { "FAIL: @orqenix/$pkg@0.6.0" | Add-Content $auditLog }
}
