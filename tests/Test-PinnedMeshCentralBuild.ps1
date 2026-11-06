[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-NormalizedText([string]$Path) {
  return [IO.File]::ReadAllText($Path).Replace("`r`n","`n").Replace("`r","`n")
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $repoRoot 'scripts\Build-PinnedMeshCentral.ps1'
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
  throw 'Pinned MeshCentral source build did not produce a package and provenance manifest.'
}
$tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$caseRoot = Join-Path $tempPrefix ('meshcentral-pinned-build-test-' + [guid]::NewGuid().ToString('N'))
if (-not [IO.Path]::GetFullPath($caseRoot).StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to create test output outside the temporary directory.'
}
[void][IO.Directory]::CreateDirectory($caseRoot)
try {
  $overlayCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $overlayCommit -notmatch '^[0-9a-f]{40}$') { throw 'Unable to resolve the overlay commit.' }
  $pwsh = (Get-Command pwsh -ErrorAction Stop).Source
  $outDir = Join-Path $caseRoot 'build'
  $referencePackage = Join-Path $env:ProgramData 'MeshCentral\node_modules\meshcentral\package.json'
  $hasReferencePackage = Test-Path -LiteralPath $referencePackage -PathType Leaf
  $buildArgs = @('-NoProfile','-File',$scriptPath,'-OverlayRepository',$repoRoot,'-OverlayCommit',$overlayCommit,'-OutputDirectory',$outDir)
  if ($hasReferencePackage) { $buildArgs += @('-ReferencePackageJson',$referencePackage) }
  & $pwsh @buildArgs
  if ($LASTEXITCODE -ne 0) { throw "Pinned source build failed (exit $LASTEXITCODE)." }
  $manifestPath = Join-Path $outDir 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Build manifest missing.' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.upstream.commit -ne '2e7ec138cf45b09204bf036b500e5e2cf37aaba4') { throw 'The build did not use the pinned official upstream commit.' }
  if ($manifest.overlay.commit -ne $overlayCommit) { throw 'The manifest does not identify the selected overlay commit.' }
  if ($manifest.package.version -ne '1.3.1') { throw 'The source package version differs from the PRN dependency contract.' }
  if ([bool]$manifest.package.dependenciesMatchReference -ne $hasReferencePackage) { throw 'Installed-package dependency comparison state does not match the test environment.' }
  if (-not $manifest.security.noFilesPermissionMarker -or -not $manifest.security.forceTwoFactorMarker) { throw 'The packaged source is missing a reviewed security marker.' }
  if (-not $manifest.security.configSchemaPackaged) { throw 'The upstream config security schema was omitted from the source package.' }
  if ($manifest.archive.integrity -notmatch '^sha512-[A-Za-z0-9+/]+=*$') { throw 'The archive lacks a valid SHA-512 integrity record.' }
  if ($manifest.reproducibility.repeatIntegrity -ne $manifest.archive.integrity) { throw 'Repeated packing of the same pinned source produced different bytes.' }
  if ($manifest.assets.customCssSha256 -notmatch '^[A-F0-9]{64}$' -or $manifest.assets.customJsSha256 -notmatch '^[A-F0-9]{64}$') { throw 'The overlay asset hashes are missing or malformed.' }
  $archive = Join-Path $outDir $manifest.archive.file
  if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Build archive missing.' }
  $sha = [Security.Cryptography.SHA512]::Create()
  $stream = [IO.File]::OpenRead($archive)
  try { $actualIntegrity = 'sha512-' + [Convert]::ToBase64String($sha.ComputeHash($stream)) }
  finally { $stream.Dispose(); $sha.Dispose() }
  if ($actualIntegrity -ne $manifest.archive.integrity) { throw 'Archive integrity does not match its build manifest.' }
  $extract = Join-Path $caseRoot 'extract'
  [void][IO.Directory]::CreateDirectory($extract)
  & tar.exe -xzf $archive -C $extract
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect built source archive.' }
  $packageRoot = Join-Path $extract 'package'
  $expectedOverlayArchive = Join-Path $caseRoot 'expected-overlay.tar'
  & git -C $repoRoot archive --format=tar "--output=$expectedOverlayArchive" $overlayCommit -- public/styles/custom.css public/scripts/custom.js
  if ($LASTEXITCODE -ne 0) { throw 'Unable to read the pinned overlay commit for comparison.' }
  $expectedOverlay = Join-Path $caseRoot 'expected-overlay'
  [void][IO.Directory]::CreateDirectory($expectedOverlay)
  & tar.exe -xf $expectedOverlayArchive -C $expectedOverlay
  if ($LASTEXITCODE -ne 0) { throw 'Unable to extract the pinned overlay for comparison.' }
  foreach ($item in @(@{Path='meshdevicefile.js';Marker='MESHRIGHT_NOFILES'},@{Path='webserver.js';Marker='force2factorPending'},@{Path='meshcentral-config-schema.json';Marker=$null})) {
    $path = Join-Path $packageRoot $item.Path
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Security source file absent from package: $($item.Path)" }
    if ($item.Marker) {
      $source = Get-Content -LiteralPath $path -Raw
      if (-not $source.Contains($item.Marker,[StringComparison]::Ordinal)) { throw "Security marker absent from package: $($item.Marker)" }
    }
  }
  foreach ($asset in @(@{Relative='public\styles\custom.css';Manifest=$manifest.assets.customCssSha256},@{Relative='public\scripts\custom.js';Manifest=$manifest.assets.customJsSha256})) {
    $builtPath = Join-Path $packageRoot $asset.Relative
    $expectedPath = Join-Path $expectedOverlay ($asset.Relative -replace '\\','\')
    if (-not (Test-Path -LiteralPath $builtPath -PathType Leaf)) { throw "Night Shift asset absent from package: $($asset.Relative)" }
    if ((Get-FileHash -LiteralPath $builtPath -Algorithm SHA256).Hash -ne $asset.Manifest) { throw "Night Shift asset hash disagrees with manifest: $($asset.Relative)" }
    if ((Read-NormalizedText $builtPath) -cne (Read-NormalizedText $expectedPath)) { throw "Packaged Night Shift asset differs from the pinned overlay commit: $($asset.Relative)" }
  }
  Write-Output 'PINNED_UPSTREAM_BUILD=PASS'
  Write-Output 'SOURCE_AND_OVERLAY_PROVENANCE=PASS'
  Write-Output 'SECURITY_MARKERS_AND_SCHEMA=PASS'
  Write-Output 'PACKAGE_REPRODUCIBILITY=PASS'
  Write-Output 'NIGHT_SHIFT_ASSETS=PASS'
} finally {
  $fullCaseRoot = [IO.Path]::GetFullPath($caseRoot)
  if (-not $fullCaseRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove a test path outside the temporary directory.' }
  if (Test-Path -LiteralPath $fullCaseRoot -PathType Container) { Remove-Item -LiteralPath $fullCaseRoot -Recurse -Force }
}
