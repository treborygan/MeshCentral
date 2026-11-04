<#
.SYNOPSIS
  Install/rollback the Night Shift web-only MeshCentral overlay.
.DESCRIPTION
  Copies only public/styles/custom.css and public/scripts/custom.js into
  <MeshRoot>/meshcentral-web/public; no config, database, agents or services changed.
  Backs up both pre-existing files, records SHA-256, and restores on copy failure.
.EXAMPLE
  ./scripts/Install-NightShift.ps1 -MeshRoot 'C:\MeshCentral'
.EXAMPLE
  ./scripts/Install-NightShift.ps1 -MeshRoot 'C:\MeshCentral' -ReplaceExisting
.EXAMPLE
  ./scripts/Install-NightShift.ps1 -MeshRoot 'C:\MeshCentral' -RollbackFrom 'C:\MeshCentral\meshcentral-web\.night-shift-backups\20261104-143011'
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)][string]$MeshRoot,
  [string]$SourceRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$ReplaceExisting,
  [string]$RollbackFrom
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$MeshRoot = [IO.Path]::GetFullPath($MeshRoot)
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)
$webDir = Join-Path $MeshRoot 'meshcentral-web'
$targetBase = Join-Path $webDir 'public'
$backupsDir = Join-Path $webDir '.night-shift-backups'
$assets = @(
  @{ Name = 'custom.css'; Directory = 'styles' },
  @{ Name = 'custom.js';  Directory = 'scripts' }
)

if (-not (Test-Path -LiteralPath (Join-Path $MeshRoot 'meshcentral-data') -PathType Container)) {
  throw 'MeshRoot must be the existing MeshCentral installation root containing meshcentral-data.'
}

function Get-AssetPaths([hashtable]$asset) {
  $relative = Join-Path $asset.Directory $asset.Name
  return @{
    Source = Join-Path (Join-Path $SourceRoot 'public') $relative
    Target = Join-Path $targetBase $relative
    Relative = $relative
  }
}

if ($RollbackFrom) {
  $path = [IO.Path]::GetFullPath($RollbackFrom)
  if (-not (Test-Path -LiteralPath $path -PathType Container)) { throw "Backup folder not found: $path" }
  $manifestFile = Join-Path $path 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw 'Rollback manifest missing.' }
  $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  foreach ($entry in $manifest.files) {
    if ($entry.relative -notin @('styles\custom.css','scripts\custom.js')) { throw 'Unexpected path in backup manifest.' }
    $dest = Join-Path $targetBase $entry.relative
    if ($PSCmdlet.ShouldProcess($dest, 'Restore original web override')) {
      if ($entry.existed) {
        $original = Join-Path $path $entry.relative
        if (-not (Test-Path -LiteralPath $original -PathType Leaf)) { throw "Original backup missing: $original" }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
        Copy-Item -LiteralPath $original -Destination $dest -Force
      } else {
        Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
      }
    }
  }
  Write-Host "Night Shift overrides rolled back from: $path"
  Write-Host 'Refresh browser cache to see the restored design.'
  return
}

$checked = @()
foreach ($asset in $assets) {
  $p = Get-AssetPaths $asset
  if (-not (Test-Path -LiteralPath $p.Source -PathType Leaf)) { throw "Source file missing: $($p.Source)" }
  $sourceText = Get-Content -LiteralPath $p.Source -Raw
  if ($sourceText -notmatch 'Night Shift') { throw "Source does not appear to be Night Shift: $($p.Source)" }
  $present = Test-Path -LiteralPath $p.Target -PathType Leaf
  if ($present -and -not $ReplaceExisting) {
    $existingText = Get-Content -LiteralPath $p.Target -Raw
    if ($existingText.Trim().Length -gt 0 -and $existingText -notmatch 'Night Shift') {
      throw "An unrelated web customization already exists at $($p.Target). Review it first; rerun with -ReplaceExisting only if you intend to replace that customization."
    }
  }
  $checked += [pscustomobject]@{ Relative = $p.Relative; Source = $p.Source; Target = $p.Target; Existed = $present }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupsDir ($stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
if ($PSCmdlet.ShouldProcess($targetBase, 'Back up and install Night Shift CSS/JS overrides')) {
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $manifest = @()
  foreach ($entry in $checked) {
    $hash = $null
    if ($entry.Existed) {
      $original = Join-Path $backup $entry.Relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $original) -Force | Out-Null
      Copy-Item -LiteralPath $entry.Target -Destination $original -Force
      $hash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    }
    $manifest += @{ relative = $entry.Relative; existed = $entry.Existed; sha256 = $hash }
  }
  @{ schema = 1; createdUtc = [DateTime]::UtcNow.ToString('o'); files = $manifest } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backup 'manifest.json') -Encoding utf8

  $changed = @()
  try {
    foreach ($entry in $checked) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $entry.Target) -Force | Out-Null
      $staged = $entry.Target + '.nightshift-stage'
      Copy-Item -LiteralPath $entry.Source -Destination $staged -Force
      try {
        Copy-Item -LiteralPath $staged -Destination $entry.Target -Force
      } finally {
        Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
      }
      $changed += $entry
    }
  } catch {
    Write-Warning "Installation failed; restoring previous overrides from $backup"
    foreach ($entry in $changed) {
      if ($entry.Existed) {
        Copy-Item -LiteralPath (Join-Path $backup $entry.Relative) -Destination $entry.Target -Force
      } else {
        Remove-Item -LiteralPath $entry.Target -Force -ErrorAction SilentlyContinue
      }
    }
    throw
  }
  Write-Host "Night Shift web overrides installed: $targetBase"
  Write-Host "Backup/rollback source: $backup"
  Write-Host 'No server configuration, database, agent, tunnel, or service changed.'
  Write-Host 'Hard-refresh the site. Restart MeshCentral only if the web override is not served.'
}
