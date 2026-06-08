#requires -Version 7.0
<#
  Phase 3 of 3: REPUBLISH
  Publishes the OSS set at 0.5.0, ONE package at a time, with aggressive
  npm rate-limit resilience. Fully resumable: re-run safely; already-published
  packages are skipped.

  Rate-limit strategy:
    - Long base delay between packages (default 12s)
    - Exponential backoff on E429 (up to 5 min per package)
    - Honor Retry-After if npm provides it
    - Hard stop after N consecutive rate-limit exhaustions; resume later
#>
param(
  [string]$TargetVersion = "0.5.0",
  [int]$BaseDelaySec = 12,
  [int]$MaxRetries = 7,
  [int]$MaxConsecutiveExhaustions = 3,
  [switch]$SkipBuild,
  [switch]$SkipConfirm
)
$ErrorActionPreference = "Stop"

function Log($m){ Write-Host "[03-republish] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m){ Write-Host "  !   $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "  X   $m" -ForegroundColor Red }

if(-not (Test-Path "package.json")){ Err "Run from repo root"; exit 1 }

# Build first
if(-not $SkipBuild){
  Log "Building all packages"
  $env:NPM_CONFIG_IGNORE_SCRIPTS = "true"
  pnpm install --frozen-lockfile --config.ignore-scripts=false
  pnpm rebuild '@mongodb-js/zstd' better-sqlite3 esbuild '@swc/core' sharp --pending --config.ignore-scripts=false
  pnpm -r build
  Ok "Build complete"
}

# Discover publishable (non-private @orqenix at target version)
Log "Discovering publishable packages"
$all = pnpm ls -r --depth -1 --json | ConvertFrom-Json
$pub = $all | Where-Object { -not $_.private -and $_.name -like "@orqenix/*" } | Sort-Object name
Log "Found $($pub.Count) publishable @orqenix packages"

if($pub.Count -eq 0){ Err "No publishable packages found"; exit 1 }

if(-not $SkipConfirm){
  $a = Read-Host "Publish $($pub.Count) packages LIVE at $TargetVersion? Type 'PUBLISH'"
  if($a -ne "PUBLISH"){ Log "Aborted."; exit 1 }
}

# Publish one package with E429 backoff
function Publish-One([string]$Dir, [string]$Name){
  Push-Location $Dir
  try {
    for($attempt=1; $attempt -le $MaxRetries; $attempt++){
      $out = & pnpm publish --access public --provenance --no-git-checks 2>&1
      $code = $LASTEXITCODE
      $text = $out -join "`n"

      if($code -eq 0){ return @{ status="PUBLISHED" } }

      # Already published (version exists) -> treat as done
      if($text -match "cannot publish over|previously published|EPUBLISHCONFLICT|403.*already"){
        return @{ status="ALREADY" }
      }

      # Rate limited -> backoff
      if($text -match "E429|Too Many Requests|rate.?limit"){
        # Honor Retry-After if present
        $retryAfter = $null
        if($text -match "retry-after['"":\s]+(\d+)"){ $retryAfter = [int]$Matches[1] }
        if($retryAfter){
          $wait = [Math]::Min(300, $retryAfter + 2)
        } else {
          $wait = [Math]::Min(300, $BaseDelaySec * [Math]::Pow(2, $attempt-1))
        }
        $wait = $wait + (Get-Random -Minimum 0 -Maximum 6)
        Warn "$Name E429 (attempt $attempt/$MaxRetries). Backoff ${wait}s"
        Start-Sleep -Seconds $wait
        continue
      }

      # Other error -> fail this package, continue to next
      return @{ status="FAILED"; detail=($text -split "`n" | Select-Object -First 2) -join " | " }
    }
    return @{ status="RATE_EXHAUSTED" }
  } finally {
    Pop-Location
  }
}

$results = @()
$consecExhaust = 0

foreach($p in $pub){
  # Resume: skip if already at target version
  $cur = & npm view $p.name version 2>$null
  if($cur -eq $TargetVersion){ Ok "skip $($p.name) (already $TargetVersion)"; $results += [PSCustomObject]@{Package=$p.name;Result="ALREADY"}; continue }

  Log "Publishing $($p.name)"
  $r = Publish-One $p.path $p.name

  switch($r.status){
    "PUBLISHED" { Ok $p.name; $consecExhaust=0 }
    "ALREADY"   { Ok "$($p.name) (already on registry)"; $consecExhaust=0 }
    "FAILED"    { Err "$($p.name) :: $($r.detail)"; $consecExhaust=0 }
    "RATE_EXHAUSTED" {
      Err "$($p.name) rate-limit exhausted"
      $consecExhaust++
    }
  }
  $results += [PSCustomObject]@{Package=$p.name;Result=$r.status}

  # Hard stop on repeated rate exhaustion -> resume later
  if($consecExhaust -ge $MaxConsecutiveExhaustions){
    Warn "$MaxConsecutiveExhaustions consecutive rate exhaustions. STOPPING."
    Warn "npm is heavily rate-limiting. Wait 1-2 hours, then re-run 03-republish.ps1"
    Warn "(Resumable: already-published packages are skipped.)"
    break
  }

  # Pacing delay between packages
  Start-Sleep -Seconds $BaseDelaySec
}

$results | Export-Csv "orqenix-republish-log.csv" -NoTypeInformation -Encoding utf8
$done = ($results | Where-Object Result -in @("PUBLISHED","ALREADY")).Count
Log "Published/confirmed: $done / $($pub.Count). Log: orqenix-republish-log.csv"

# Final verify
Log "Verifying on npm (waiting 45s)..."
Start-Sleep -Seconds 45
$missing = @()
foreach($p in $pub){
  $v = & npm view $p.name version 2>$null
  if($v -eq $TargetVersion){ Ok "$($p.name) = $v" }
  else { Err "$($p.name) = $($v ?? 'MISSING')"; $missing += $p.name }
}

if($missing.Count -eq 0){
  Log "============================================"
  Log "SUCCESS: all $($pub.Count) packages live at $TargetVersion"
  Log "============================================"
} else {
  Warn "$($missing.Count) packages not yet at $TargetVersion:"
  $missing | ForEach-Object { Warn "  $_" }
  Warn "Re-run 03-republish.ps1 after npm rate limit clears (it resumes)."
}
