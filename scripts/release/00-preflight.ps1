#requires -Version 7.0
<# Pre-flight checks before rollback/republish. #>
$ErrorActionPreference = "Stop"
function Log($m){ Write-Host "[00-preflight] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "  OK  $m" -ForegroundColor Green }
function Err($m){ Write-Host "  X   $m" -ForegroundColor Red }

if(-not (Test-Path "package.json")){ Err "Run from repo root"; exit 1 }

# Tools
foreach($t in @("npm","pnpm","git","node")){
  if(-not (Get-Command $t -ErrorAction SilentlyContinue)){ Err "Missing tool: $t"; exit 1 }
  Ok "tool: $t"
}

# npm logged in
$who = & npm whoami 2>$null
if(-not $who){ Err "npm not logged in. Run: npm login"; exit 1 }
Ok "npm user: $who"

# npm token type warning
Log "Ensure NPM token is Automation type (bypasses 2FA) for CI; for local"
Log "  publish you may be prompted for 2FA OTP. That is fine interactively."

# Current core version
$coreV = node -p "require('./packages/core/package.json').version" 2>$null
Log "Local packages/core version: $coreV"

# npm core version
$npmV = & npm view "@orqenix/core" version 2>$null
Log "npm @orqenix/core version: $($npmV ?? 'not published')"

# Confirm within window expectation
if($npmV -eq "2.0.0"){
  Ok "Confirmed: 2.0.0 is live (rollback needed, within 72h)"
} elseif(-not $npmV){
  Log "Nothing on npm — rollback may be unnecessary; go straight to fix+republish"
}

Log "PRE-FLIGHT DONE. Proceed: 01-rollback.ps1 -> 02-fix.ps1 -> commit -> 03-republish.ps1"
