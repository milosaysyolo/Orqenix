$ErrorActionPreference = "Continue"

$PUBLISHED = @(
  "config","core","embedding-cloud","embedding-local","file-watcher",
  "gate-runner-core","hooks","kb-decisions","kb-docs","lifecycle",
  "llm-adapter-ollama","mcp-client","mcp-server","opencode-plugin",
  "plugin-compress-input","plugin-detach","plugin-marketplace",
  "plugin-sandbox","plugin-snapshot","plugin-versioning","schema",
  "sdk","security","teams-built-in","testing"
)

Write-Host "=== ROLLBACK: Unpublish 25 packages at 2.0.0 ===" -ForegroundColor Cyan
Write-Host "OTP lasts ~30s. We max 3 ops per OTP, then re-prompt."
Write-Host ""

$total = $PUBLISHED.Count
$done = 0

foreach ($p in $PUBLISHED) {
  $spec = "@orqenix/$p@2.0.0"

  $exists = npm view "@orqenix/$p" version 2>$null
  if (-not $exists) {
    Write-Host "SKIP $spec (already gone)" -ForegroundColor Gray
    continue
  }

  if (($done % 3) -eq 0) {
    $otp = Read-Host "`nEnter OTP code "
    if (-not $otp) { Write-Host "Empty OTP — abort." -ForegroundColor Red; break }
  }

  Write-Host "Unpublishing $spec ..." -ForegroundColor Yellow
  $result = npm unpublish $spec --force --otp=$otp 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK  $spec" -ForegroundColor Green
    $done++
  } else {
    $err = ($result -join "`n")
    Write-Host "  FAIL $spec" -ForegroundColor Red
    Write-Host $err -ForegroundColor DarkGray
  }

  Start-Sleep -Seconds 3
}

Write-Host "`nRemoved: $done / $total" -ForegroundColor Cyan
