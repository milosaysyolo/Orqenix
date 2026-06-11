$packages = @("mesh-observability","transport-security","mesh-transport-http","mesh-transport-libp2p","mesh-router","mesh-discovery")
$root = "C:\Users\vnet-1-vm-c1\Documents\GitHub\Orqenix\packages"
foreach ($pkg in $packages) {
  $path = "$root/$pkg/package.json"
  $content = Get-Content -Path $path -Raw -Encoding UTF8
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
  $hasBom = ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  try {
    $null = $content | ConvertFrom-Json
    Write-Host "$pkg`: BOM=$hasBom JSON=valid"
  } catch {
    $msg = $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
    Write-Host "$pkg`: BOM=$hasBom JSON=INVALID - $msg"
  }
}
