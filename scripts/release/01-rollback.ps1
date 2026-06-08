#requires -Version 7.0
<#
  Phase 1 of 3: ROLLBACK
  Unpublishes all 25 packages at 2.0.0 within npm's 72h window.
  Rate-limit resilient: delay + exponential backoff on E429.
#>
param(
  [string]$OldVersion = "2.0.0",
  [int]$BaseDelaySec = 5,
  [int]$MaxRetries = 6,
  [switch]$SkipConfirm
)
$ErrorActionPreference = "Stop"

function Log($m){ Write-Host "[01-rollback] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m){ Write-Host "  !   $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "  X   $m" -ForegroundColor Red }

# All 25 packages currently live at 2.0.0
$PUBLISHED = @(
  "config","core","embedding-cloud","embedding-local","file-watcher",
  "gate-runner-core","hooks","kb-decisions","kb-docs","lifecycle",
  "llm-adapter-ollama","mcp-client","mcp-server","opencode-plugin",
  "plugin-compress-input","plugin-detach","plugin-marketplace",
  "plugin-sandbox","plugin-snapshot","plugin-versioning","schema",
  "sdk","security","teams-built-in","testing"
)

if(-not (Test-Path "package.json")){ Err "Run from repo root"; exit 1 }

# Invoke an npm command with E429 backoff
function Invoke-NpmWithBackoff([string[]]$NpmArgs, [string]$Label){
  for($attempt=1; $attempt -le $MaxRetries; $attempt++){
    $out = & npm @NpmArgs 2>&1
    $code = $LASTEXITCODE
    $text = $out -join "`n"
    if($code -eq 0){ return @{ ok=$true; out=$text } }
    if($text -match "E429|Too Many Requests|rate.?limit"){
      $wait = [Math]::Min(300, $BaseDelaySec * [Math]::Pow(2, $attempt-1))
      $jitter = Get-Random -Minimum 0 -Maximum 5
      $wait = $wait + $jitter
      Warn "$Label E429 (attempt $attempt/$MaxRetries). Backoff ${wait}s"
      Start-Sleep -Seconds $wait
      continue
    }
    # Non-rate-limit error: return immediately
    return @{ ok=$false; out=$text }
  }
  return @{ ok=$false; out="exhausted $MaxRetries retries (rate limited)" }
}

Log "Will unpublish $($PUBLISHED.Count) packages at $OldVersion"
Warn "This is within npm's 72h window. After window closes, unpublish is denied."
if(-not $SkipConfirm){
  $a = Read-Host "Type 'ROLLBACK' to proceed"
  if($a -ne "ROLLBACK"){ Log "Aborted."; exit 1 }
}

$results = @()
foreach($p in $PUBLISHED){
  $spec = "@orqenix/$p@$OldVersion"

  # Skip if already gone
  $exists = & npm view "@orqenix/$p" version 2>$null
  if(-not $exists){ Ok "already gone: @orqenix/$p"; $results += [PSCustomObject]@{Package=$spec;Result="ALREADY_GONE"}; continue }

  Log "Unpublishing $spec"
  $r = Invoke-NpmWithBackoff @("unpublish", $spec, "--force") $spec
  if($r.ok){
    Ok $spec
    $results += [PSCustomObject]@{Package=$spec;Result="UNPUBLISHED"}
  } else {
    Err "$spec :: $($r.out -split "`n" | Select-Object -First 1)"
    $results += [PSCustomObject]@{Package=$spec;Result="FAILED"}
  }
  Start-Sleep -Seconds $BaseDelaySec   # gentle pacing between calls
}

$results | Export-Csv "orqenix-rollback-log.csv" -NoTypeInformation -Encoding utf8
$ok = ($results | Where-Object Result -in @("UNPUBLISHED","ALREADY_GONE")).Count
Log "Done: $ok / $($PUBLISHED.Count) removed. Log: orqenix-rollback-log.csv"

Log "Verifying (waiting 30s for npm propagation)..."
Start-Sleep -Seconds 30
$stillLive = 0
foreach($p in $PUBLISHED){
  $v = & npm view "@orqenix/$p" version 2>$null
  if($v){ Err "STILL LIVE: @orqenix/$p = $v"; $stillLive++ }
}
if($stillLive -eq 0){ Ok "All 25 removed from registry" }
else { Warn "$stillLive still live. Re-run 01-rollback.ps1 (skips already-gone)." }

Log "PHASE 1 COMPLETE. Next: pwsh ./scripts/release/02-fix.ps1"
