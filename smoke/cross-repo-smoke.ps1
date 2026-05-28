$ErrorActionPreference = "Stop"

$OrqenixRoot = (Resolve-Path "$PSScriptRoot\..").Path
$ProRoot = (Resolve-Path "$OrqenixRoot\..\Orqenix-Pro").Path

Write-Host "=== Cross-Repo Smoke Test ==="
Write-Host "Orqenix:     $OrqenixRoot"
Write-Host "Orqenix-Pro: $ProRoot"
Write-Host "Date:        $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC)"
Write-Host ""

$Pass = 0
$Fail = 0

function Check {
    param([string]$Name, [scriptblock]$Action)
    Write-Host -NoNewline "  [$Name] "
    try {
        $null = & $Action 2>&1
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) { throw "exit $LASTEXITCODE" }
        Write-Host "PASS"
        $script:Pass++
    } catch {
        Write-Host "FAIL ($_)"
        $script:Fail++
    }
}

Write-Host "--- Step 1: Sibling layout ---"
Check "Orqenix-Pro exists" { Test-Path $ProRoot }
Check "Orqenix-Pro has keys" { Test-Path "$ProRoot\keys\test-public.pem" }

Write-Host ""
Write-Host "--- Step 2: Build state ---"
Check "Orqenix core built" { Test-Path "$OrqenixRoot\packages\core\dist\index.js" }
Check "Orqenix CLI built" { Test-Path "$OrqenixRoot\packages\cli\dist\index.js" }
Check "Orqenix-Pro license built" { Test-Path "$ProRoot\packages\license\dist\index.js" }

Write-Host ""
Write-Host "--- Step 3: Tag sync ---"
Check "Orqenix tag" { Push-Location $OrqenixRoot; $r = git tag --list v0.4.0-phase-4; Pop-Location; if (-not ($r -match "v0.4.0-phase-4")) { throw "missing" } }
Check "Orqenix-Pro tag" { Push-Location $ProRoot; $r = git tag --list v0.4.0-phase-4; Pop-Location; if (-not ($r -match "v0.4.0-phase-4")) { throw "missing" } }

Write-Host ""
Write-Host "--- Step 4: Pro flow ---"
Check "Pro test suite" { Push-Location $ProRoot; pnpm test; Pop-Location }
Check "License grace driver" { Push-Location $ProRoot; pnpm test:license-grace; Pop-Location }

Write-Host ""
Write-Host "--- Step 5: Orqenix smoke ---"
Check "Orqenix smoke" { Push-Location $OrqenixRoot; pnpm smoke; Pop-Location }

Write-Host ""
Write-Host "--- Step 6: Integration suite ---"
Check "Integration tests" { Push-Location "$OrqenixRoot\integration"; pnpm test; Pop-Location }

Write-Host ""
Write-Host "=== Smoke Summary ==="
Write-Host "PASS: $Pass"
Write-Host "FAIL: $Fail"

if ($Fail -gt 0) {
    Write-Host "Cross-repo smoke FAILED"
    exit 1
}
Write-Host "Cross-repo smoke OK"
exit 0
