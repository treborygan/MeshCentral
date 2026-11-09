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
  if ($manifest.schema -ne 1 -or @($manifest.files).Count -ne $assets.Count) {
    throw 'Rollback manifest must contain exactly two version-1 web overrides.'
  }

  # Validate every entry and digest before altering either live override.
  $plan = @{}
  $allow = @('styles\custom.css','scripts\custom.js')
  foreach ($entry in $manifest.files) {
    if ($entry.relative -notin $allow -or $plan.ContainsKey([string]$entry.relative)) {
      throw 'Rollback manifest contains an unexpected or duplicate asset.'
    }
    if ($entry.existed -isnot [bool]) { throw 'Rollback manifest has an invalid existed flag.' }
    $source = Join-Path $path $entry.relative
    if ($entry.existed) {
      if ($entry.sha256 -isnot [string] -or $entry.sha256 -notmatch '^[0-9a-fA-F]{64}$') {
        throw "Rollback manifest is missing a valid digest for $($entry.relative)."
      }
      if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Original backup missing: $source"
      }
      if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.sha256) {
        throw "Original backup failed SHA-256 verification: $source"
      }
    } elseif ($null -ne $entry.sha256) {
      throw "New override has an unexpected backup digest: $($entry.relative)"
    }
    $plan[[string]$entry.relative] = @{ Existed = [bool]$entry.existed; Source = $source; Sha256 = $entry.sha256 }
  }
  if ($plan.Count -ne $assets.Count) { throw 'Rollback manifest is missing a required asset.' }
  if (-not $PSCmdlet.ShouldProcess($targetBase, 'Restore both Night Shift web overrides')) { return }

  # Prepare both replacements and a compensating snapshot of each current file.
  # An error while preparing the second file leaves both live files untouched.
  $transaction = Join-Path $backupsDir ('.rollback-transaction-' + [guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Path $transaction -Force | Out-Null
    $restore = @()
    foreach ($asset in $assets) {
      $relative = Join-Path $asset.Directory $asset.Name
      $target = Join-Path $targetBase $relative
      if ((Test-Path -LiteralPath $target) -and -not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw "Rollback target is not a regular file: $target"
      }
      $wasPresent = Test-Path -LiteralPath $target -PathType Leaf
      $previous = Join-Path $transaction ('previous-' + $asset.Name)
      $previousHash = $null
      if ($wasPresent) {
        Copy-Item -LiteralPath $target -Destination $previous -Force
        $previousHash = (Get-FileHash -LiteralPath $previous -Algorithm SHA256).Hash
      }
      $expected = $plan[$relative]
      $staged = Join-Path $transaction ('restore-' + $asset.Name)
      if ($expected.Existed) {
        Copy-Item -LiteralPath $expected.Source -Destination $staged -Force
        if ((Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash -ne $expected.Sha256) {
          throw "Staged rollback asset failed SHA-256 verification: $relative"
        }
      }
      $restore += [pscustomobject]@{
        Target = $target; WasPresent = $wasPresent; Previous = $previous
        PreviousHash = $previousHash; Existed = $expected.Existed
        Stage = $staged; ExpectedHash = $expected.Sha256
      }
    }

    $changed = @()
    try {
      foreach ($entry in $restore) {
        $changed += $entry
        if ($entry.Existed) {
          New-Item -ItemType Directory -Force -Path (Split-Path -Parent $entry.Target) | Out-Null
          Copy-Item -LiteralPath $entry.Stage -Destination $entry.Target -Force
          if ((Get-FileHash -LiteralPath $entry.Target -Algorithm SHA256).Hash -ne $entry.ExpectedHash) {
            throw "Restored web override failed verification: $($entry.Target)"
          }
        } elseif (Test-Path -LiteralPath $entry.Target -PathType Leaf) {
          Remove-Item -LiteralPath $entry.Target -Force
        }
      }
    } catch {
      $originalError = $_
      $recoveryErrors = @()
      foreach ($entry in $changed) {
        try {
          if ($entry.WasPresent) {
            Copy-Item -LiteralPath $entry.Previous -Destination $entry.Target -Force
            if ((Get-FileHash -LiteralPath $entry.Target -Algorithm SHA256).Hash -ne $entry.PreviousHash) {
              throw 'Current-file recovery SHA-256 mismatch.'
            }
          } elseif (Test-Path -LiteralPath $entry.Target -PathType Leaf) {
            Remove-Item -LiteralPath $entry.Target -Force
          }
        } catch { $recoveryErrors += "$($entry.Target): $_" }
      }
      if ($recoveryErrors.Count) {
        throw "Rollback failed and current-file recovery was incomplete: $($recoveryErrors -join '; '). Original error: $originalError"
      }
      throw $originalError
    }
  } finally {
    if (Test-Path -LiteralPath $transaction -PathType Container) {
      Remove-Item -LiteralPath $transaction -Recurse -Force
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
        $changed += $entry
        Copy-Item -LiteralPath $staged -Destination $entry.Target -Force
      } finally {
        Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
      }
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
