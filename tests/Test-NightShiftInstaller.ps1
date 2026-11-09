$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $repoRoot 'scripts\Install-NightShift.ps1'
$tempRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('nightshift-installer-test-' + [guid]::NewGuid().ToString('N'))))
$tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (-not $tempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to create test fixture outside the temporary directory.' }

function Assert-Equal([object]$Actual, [object]$Expected, [string]$Message) {
  if ($Actual -cne $Expected) { throw "$Message (expected '$Expected', got '$Actual')" }
}

function New-Fixture([string]$Name) {
  $root = Join-Path $tempRoot $Name
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'meshcentral-data') | Out-Null
  return $root
}

try {
  New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
  $tokens = $null; $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count -gt 0) { throw ($parseErrors | Out-String) }
  Write-Output 'INSTALLER_PARSE=PASS'

  $existingRoot = New-Fixture 'existing-overrides'
  $existingPublic = Join-Path $existingRoot 'meshcentral-web\public'
  New-Item -ItemType Directory -Force -Path (Join-Path $existingPublic 'styles') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $existingPublic 'scripts') | Out-Null
  $oldCss = 'Night Shift prior CSS marker'
  $oldJs = 'Night Shift prior JS marker'
  [IO.File]::WriteAllText((Join-Path $existingPublic 'styles\custom.css'), $oldCss)
  [IO.File]::WriteAllText((Join-Path $existingPublic 'scripts\custom.js'), $oldJs)
  $unrelated = Join-Path $existingPublic 'custom.conf'
  [IO.File]::WriteAllText($unrelated, 'unchanged sentinel')
  $dataSentinel = Join-Path $existingRoot 'meshcentral-data\sentinel'
  [IO.File]::WriteAllText($dataSentinel, 'data unchanged')

  $outsideRoot = New-Fixture 'unrelated-override'
  $outsidePath = Join-Path $outsideRoot 'meshcentral-web\public\styles\custom.css'
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outsidePath) | Out-Null
  [IO.File]::WriteAllText($outsidePath, 'third-party customization')
  $refused = $false
  try { & $installer -MeshRoot $outsideRoot -SourceRoot $repoRoot -Confirm:$false | Out-Null }
  catch { $refused = $true }
  if (-not $refused) { throw 'Installer accepted an unrelated existing customization without -ReplaceExisting.' }
  Assert-Equal ([IO.File]::ReadAllText($outsidePath)) 'third-party customization' 'Refused install changed the unrelated file'
  Write-Output 'UNRELATED_OVERRIDE_PROTECTION=PASS'

  & $installer -MeshRoot $existingRoot -SourceRoot $repoRoot -WhatIf -ReplaceExisting | Out-Null
  if (Test-Path -LiteralPath (Join-Path $existingRoot 'meshcentral-web\.night-shift-backups')) { throw 'WhatIf created a backup directory.' }
  Write-Output 'WHATIF=PASS'

  & $installer -MeshRoot $existingRoot -SourceRoot $repoRoot -ReplaceExisting -Confirm:$false | Out-Null
  $installedCss = Join-Path $existingPublic 'styles\custom.css'
  $installedJs = Join-Path $existingPublic 'scripts\custom.js'
  Assert-Equal (Get-FileHash -LiteralPath $installedCss -Algorithm SHA256).Hash (Get-FileHash -LiteralPath (Join-Path $repoRoot 'public\styles\custom.css') -Algorithm SHA256).Hash 'Installed CSS hash mismatch'
  Assert-Equal (Get-FileHash -LiteralPath $installedJs -Algorithm SHA256).Hash (Get-FileHash -LiteralPath (Join-Path $repoRoot 'public\scripts\custom.js') -Algorithm SHA256).Hash 'Installed JS hash mismatch'
  Assert-Equal ([IO.File]::ReadAllText($unrelated)) 'unchanged sentinel' 'Installer changed an unrelated web file'
  Assert-Equal ([IO.File]::ReadAllText($dataSentinel)) 'data unchanged' 'Installer changed MeshCentral data'
  $backupRoot = Join-Path $existingRoot 'meshcentral-web\.night-shift-backups'
  $backup = Get-ChildItem -LiteralPath $backupRoot -Directory | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if (-not $backup) { throw 'Installer did not create a rollback snapshot.' }
  $manifest = Get-Content -LiteralPath (Join-Path $backup.FullName 'manifest.json') -Raw | ConvertFrom-Json
  Assert-Equal $manifest.files.Count 2 'Rollback manifest file count mismatch'
  foreach ($entry in $manifest.files) {
    $backupFile = Join-Path $backup.FullName $entry.relative
    Assert-Equal (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash $entry.sha256 "Backup hash mismatch for $($entry.relative)"
  }
  & $installer -MeshRoot $existingRoot -RollbackFrom $backup.FullName -Confirm:$false | Out-Null
  Assert-Equal ([IO.File]::ReadAllText($installedCss)) $oldCss 'Rollback did not restore CSS'
  Assert-Equal ([IO.File]::ReadAllText($installedJs)) $oldJs 'Rollback did not restore JavaScript'
  Write-Output 'EXISTING_FILE_INSTALL_ROLLBACK=PASS'

  # A failed preflight may not restore only one of the two overrides.
  $currentCss = 'Night Shift later CSS must remain'
  $currentJs = 'Night Shift later JS must remain'
  [IO.File]::WriteAllText($installedCss, $currentCss)
  [IO.File]::WriteAllText($installedJs, $currentJs)
  $manifestFile = Join-Path $backup.FullName 'manifest.json'
  $manifestText = [IO.File]::ReadAllText($manifestFile)
  $backupJs = Join-Path $backup.FullName 'scripts\custom.js'
  $backupJsOriginal = [IO.File]::ReadAllText($backupJs)

  function Assert-RollbackRejected([string]$Scenario) {
    $rejected = $false
    try { & $installer -MeshRoot $existingRoot -RollbackFrom $backup.FullName -Confirm:$false | Out-Null }
    catch { $rejected = $true }
    if (-not $rejected) { throw "Rollback unexpectedly accepted $Scenario." }
    Assert-Equal ([IO.File]::ReadAllText($installedCss)) $currentCss "$Scenario altered CSS"
    Assert-Equal ([IO.File]::ReadAllText($installedJs)) $currentJs "$Scenario altered JavaScript"
  }

  try {
    [IO.File]::WriteAllText($backupJs, 'tampered rollback copy')
    Assert-RollbackRejected 'tampered backup digest'
  } finally { [IO.File]::WriteAllText($backupJs, $backupJsOriginal) }
  Write-Output 'ROLLBACK_TAMPER_PRECHECK=PASS'

  $missingJs = $backupJs + '.test-missing'
  try {
    Move-Item -LiteralPath $backupJs -Destination $missingJs -Force
    Assert-RollbackRejected 'missing second backup asset'
  } finally {
    if (Test-Path -LiteralPath $missingJs) { Move-Item -LiteralPath $missingJs -Destination $backupJs -Force }
  }
  Write-Output 'ROLLBACK_MISSING_ASSET_PRECHECK=PASS'

  try {
    $badManifest = $manifestText | ConvertFrom-Json
    $badManifest.files[1].relative = $badManifest.files[0].relative
    $badManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestFile -Encoding utf8
    Assert-RollbackRejected 'duplicate manifest entry'
  } finally { [IO.File]::WriteAllText($manifestFile, $manifestText) }
  Write-Output 'ROLLBACK_DUPLICATE_MANIFEST_PRECHECK=PASS'

  & $installer -MeshRoot $existingRoot -RollbackFrom $backup.FullName -Confirm:$false | Out-Null
  Assert-Equal ([IO.File]::ReadAllText($installedCss)) $oldCss 'Verified rollback did not restore original CSS'
  Assert-Equal ([IO.File]::ReadAllText($installedJs)) $oldJs 'Verified rollback did not restore original JavaScript'
  Write-Output 'ROLLBACK_RECOVERY_AFTER_REJECTED_BACKUPS=PASS'

  $newRoot = New-Fixture 'new-overrides'
  & $installer -MeshRoot $newRoot -SourceRoot $repoRoot -Confirm:$false | Out-Null
  $newPublic = Join-Path $newRoot 'meshcentral-web\public'
  $newBackup = Get-ChildItem -LiteralPath (Join-Path $newRoot 'meshcentral-web\.night-shift-backups') -Directory | Select-Object -First 1
  if (-not $newBackup) { throw 'Installer did not create rollback snapshot for new overrides.' }
  & $installer -MeshRoot $newRoot -RollbackFrom $newBackup.FullName -Confirm:$false | Out-Null
  if ((Test-Path -LiteralPath (Join-Path $newPublic 'styles\custom.css')) -or (Test-Path -LiteralPath (Join-Path $newPublic 'scripts\custom.js'))) {
    throw 'Rollback left newly created override files behind.'
  }
  Write-Output 'NEW_FILE_ROLLBACK=PASS'
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    $resolved = (Resolve-Path -LiteralPath $tempRoot).Path
    if (-not $resolved.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove fixture outside the temporary directory.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
