param([switch]$Start)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$inputFolder = Join-Path $root "artifacts\sandbox-input-$version"
$resultsFolder = Join-Path $root 'artifacts\sandbox-qa'
New-Item -ItemType Directory -Force -Path $resultsFolder | Out-Null
New-Item -ItemType Directory -Force -Path $inputFolder | Out-Null
foreach ($targetName in @('Setup', 'Portable')) {
  Copy-Item -LiteralPath (Join-Path $root "release\MaquetadorDTF-$targetName-$version-x64.exe") -Destination $inputFolder
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'verify-clean-windows.ps1') -Destination (Join-Path $inputFolder 'verify-clean-windows.ps1')
$source = [Security.SecurityElement]::Escape($inputFolder)
$target = [Security.SecurityElement]::Escape($resultsFolder)
$xml = @"
<Configuration>
  <Networking>Disable</Networking>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder><HostFolder>$source</HostFolder><SandboxFolder>C:\DTF-input</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$target</HostFolder><SandboxFolder>C:\DTF-results</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\DTF-input\verify-clean-windows.ps1</Command></LogonCommand>
</Configuration>
"@
$file = Join-Path $root 'release\Comprobar-sin-Node.wsb'
Set-Content -LiteralPath $file -Value $xml -Encoding utf8
Write-Output $file
if ($Start) { Start-Process -FilePath 'WindowsSandbox.exe' -ArgumentList ('"' + $file + '"') -WindowStyle Hidden -PassThru | Select-Object Id,ProcessName }
