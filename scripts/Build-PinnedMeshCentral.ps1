[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OverlayRepository,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$OverlayCommit,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$ReferencePackageJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$upstreamUrl = 'https://github.com/Ylianst/MeshCentral.git'
$upstreamCommit = '2e7ec138cf45b09204bf036b500e5e2cf37aaba4'
$upstreamVersion = '1.3.1'
$repoRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $OverlayRepository).Path)
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$workRoot = Join-Path $tempBase ('meshcentral-pinned-build-' + [guid]::NewGuid().ToString('N'))
$outWasCreated = $false
$outputFiles = @()

function Invoke-CheckedCommand {
  param([string]$Command, [string[]]$Arguments, [string]$Failure)
  $result = @(& $Command @Arguments 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "$Failure (exit $LASTEXITCODE). $($result -join "`n")"
  }
  return $result
}

function Get-DependencySignature {
  param($Metadata)
  if ($null -eq $Metadata.dependencies) { return '' }
  return (@($Metadata.dependencies.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "`n")
}

function Get-FileSha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Get-ArchiveIntegrity {
  param([string]$Path)
  $sha = [Security.Cryptography.SHA512]::Create()
  $stream = [IO.File]::OpenRead($Path)
  try { return 'sha512-' + [Convert]::ToBase64String($sha.ComputeHash($stream)) }
  finally { $stream.Dispose(); $sha.Dispose() }
}

try {
  $git = Get-Command git.exe -ErrorAction Stop
  $tar = Get-Command tar.exe -ErrorAction Stop
  $node = Get-Command node.exe -ErrorAction Stop
  $npm = Get-Command npm.cmd -ErrorAction Stop

  $resolvedOverlay = @(& $git.Source -C $repoRoot rev-parse --verify "${OverlayCommit}^{commit}" 2>&1)
  if ($LASTEXITCODE -ne 0 -or $resolvedOverlay[0].Trim() -ne $OverlayCommit) { throw 'OverlayCommit is not available in the overlay repository.' }

  if (Test-Path -LiteralPath $outputPath) {
    if (-not (Test-Path -LiteralPath $outputPath -PathType Container)) { throw 'OutputDirectory exists and is not a directory.' }
    if (@(Get-ChildItem -LiteralPath $outputPath -Force).Count -gt 0) { throw 'OutputDirectory must be empty to prevent overwriting an existing build.' }
  } else {
    [void][IO.Directory]::CreateDirectory($outputPath)
    $outWasCreated = $true
  }
  [void][IO.Directory]::CreateDirectory($workRoot)
  if (-not [IO.Path]::GetFullPath($workRoot).StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) { throw 'Temporary build path escaped the system temporary directory.' }

  $sourceRoot = Join-Path $workRoot 'upstream'
  $sourceGit = Join-Path $workRoot 'source-fetch'
  [void][IO.Directory]::CreateDirectory($sourceRoot)
  [void][IO.Directory]::CreateDirectory($sourceGit)
  [void](Invoke-CheckedCommand $git.Source @('-C',$sourceGit,'init','--quiet') 'Could not initialize temporary source fetch')
  [void](Invoke-CheckedCommand $git.Source @('-C',$sourceGit,'remote','add','upstream',$upstreamUrl) 'Could not add the official upstream remote')
  [void](Invoke-CheckedCommand $git.Source @('-C',$sourceGit,'fetch','--quiet','--depth','1','upstream',$upstreamCommit) 'Could not fetch the pinned official upstream commit')
  $fetchedCommit = (@(Invoke-CheckedCommand $git.Source @('-C',$sourceGit,'rev-parse','FETCH_HEAD') 'Could not resolve the fetched upstream commit')[0]).Trim()
  if ($fetchedCommit -ne $upstreamCommit) { throw "Official upstream fetch resolved to unexpected commit $fetchedCommit." }
  $upstreamArchive = Join-Path $workRoot 'upstream-source.tar'
  [void](Invoke-CheckedCommand $git.Source @('-C',$sourceGit,'archive','--format=tar',"--output=$upstreamArchive",$upstreamCommit) 'Could not archive the pinned official upstream source')
  [void](Invoke-CheckedCommand $tar.Source @('-xf',$upstreamArchive,'-C',$sourceRoot) 'Could not extract the pinned official upstream source')

  $upstreamPackagePath = Join-Path $sourceRoot 'package.json'
  if (-not (Test-Path -LiteralPath $upstreamPackagePath -PathType Leaf)) { throw 'Pinned upstream package.json is missing.' }
  $package = Get-Content -LiteralPath $upstreamPackagePath -Raw | ConvertFrom-Json
  if ($package.version -ne $upstreamVersion) { throw "Pinned upstream version changed from the reviewed $upstreamVersion contract." }
  $dependenciesMatchReference = $false
  if ($ReferencePackageJson) {
    $referencePath = (Resolve-Path -LiteralPath $ReferencePackageJson).Path
    $referencePackage = Get-Content -LiteralPath $referencePath -Raw | ConvertFrom-Json
    if ($referencePackage.version -ne $package.version) { throw 'Pinned upstream version does not match the installed package.' }
    if ((Get-DependencySignature $referencePackage) -cne (Get-DependencySignature $package)) { throw 'Pinned upstream direct dependencies differ from the installed package; review lock changes before building.' }
    $dependenciesMatchReference = $true
  }

  $overlayArchive = Join-Path $workRoot 'night-shift-overlay.tar'
  $overlayPaths = @('public/styles/custom.css','public/scripts/custom.js','public/scripts/night-shift','scripts/build-night-shift.js')
  [void](Invoke-CheckedCommand $git.Source (@('-C',$repoRoot,'archive','--format=tar',"--output=$overlayArchive",$OverlayCommit,'--') + $overlayPaths) 'Could not archive the pinned Night Shift overlay')
  $overlayRoot = Join-Path $workRoot 'overlay'
  [void][IO.Directory]::CreateDirectory($overlayRoot)
  [void](Invoke-CheckedCommand $tar.Source @('-xf',$overlayArchive,'-C',$overlayRoot) 'Could not extract the pinned Night Shift overlay')
  $overlayCss = Join-Path $overlayRoot 'public\styles\custom.css'
  $overlayJs = Join-Path $overlayRoot 'public\scripts\custom.js'
  $bundleCheck = @(& $node.Source (Join-Path $overlayRoot 'scripts\build-night-shift.js') --check 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "Pinned overlay bundle is not current. $($bundleCheck -join "`n")" }
  if (-not (Test-Path -LiteralPath $overlayCss -PathType Leaf) -or -not (Test-Path -LiteralPath $overlayJs -PathType Leaf)) { throw 'Pinned overlay CSS or JavaScript bundle is missing.' }
  Copy-Item -LiteralPath $overlayCss -Destination (Join-Path $sourceRoot 'public\styles\custom.css') -Force
  Copy-Item -LiteralPath $overlayJs -Destination (Join-Path $sourceRoot 'public\scripts\custom.js') -Force

  $deviceFile = Join-Path $sourceRoot 'meshdevicefile.js'
  $webserverFile = Join-Path $sourceRoot 'webserver.js'
  $schemaFile = Join-Path $sourceRoot 'meshcentral-config-schema.json'
  $deviceSource = Get-Content -LiteralPath $deviceFile -Raw
  $webserverSource = Get-Content -LiteralPath $webserverFile -Raw
  if (-not $deviceSource.Contains('MESHRIGHT_NOFILES',[StringComparison]::Ordinal)) { throw 'Pinned upstream source lacks the reviewed file-sharing security fix.' }
  if (-not $webserverSource.Contains('force2factorPending',[StringComparison]::Ordinal)) { throw 'Pinned upstream source lacks the reviewed forced-two-factor security fix.' }
  if (-not (Test-Path -LiteralPath $schemaFile -PathType Leaf)) { throw 'Pinned upstream security configuration schema is missing.' }

  # This upstream schema changed with the security fixes but is absent from its npm files allowlist.
  if (@($package.files) -notcontains 'meshcentral-config-schema.json') {
    $package.files = @($package.files) + 'meshcentral-config-schema.json'
    $packageJson = ConvertTo-Json -InputObject $package -Depth 100
    [IO.File]::WriteAllText($upstreamPackagePath,$packageJson,[Text.UTF8Encoding]::new($false))
  }

  $epoch = [DateTime]::Parse('1985-10-26T08:15:00Z').ToUniversalTime()
  foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force) { $file.LastWriteTimeUtc = $epoch }
  foreach ($dir in (Get-ChildItem -LiteralPath $sourceRoot -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending)) { $dir.LastWriteTimeUtc = $epoch }
  (Get-Item -LiteralPath $sourceRoot).LastWriteTimeUtc = $epoch

  $packOneDir = Join-Path $workRoot 'pack-one'
  $packTwoDir = Join-Path $workRoot 'pack-two'
  [void][IO.Directory]::CreateDirectory($packOneDir)
  [void][IO.Directory]::CreateDirectory($packTwoDir)
  Push-Location $sourceRoot
  try {
    $packOneText = (@(& $npm.Source 'pack' '--json' '--ignore-scripts' "--pack-destination=$packOneDir" 2>&1) -join "`n")
    if ($LASTEXITCODE -ne 0) { throw "npm pack failed (exit $LASTEXITCODE). $packOneText" }
    $packTwoText = (@(& $npm.Source 'pack' '--json' '--ignore-scripts' "--pack-destination=$packTwoDir" 2>&1) -join "`n")
    if ($LASTEXITCODE -ne 0) { throw "Repeat npm pack failed (exit $LASTEXITCODE). $packTwoText" }
  } finally { Pop-Location }
  $packOneJson = ConvertFrom-Json -InputObject $packOneText
  $packTwoJson = ConvertFrom-Json -InputObject $packTwoText
  if ($packOneJson.PSObject.Properties.Name -contains $package.name) { $packOne = $packOneJson.PSObject.Properties[$package.name].Value } else { $packOne = @($packOneJson)[0] }
  if ($packTwoJson.PSObject.Properties.Name -contains $package.name) { $packTwo = $packTwoJson.PSObject.Properties[$package.name].Value } else { $packTwo = @($packTwoJson)[0] }
  if ($packOne.filename -ne $packTwo.filename) { throw 'Repeat npm pack produced different filenames.' }
  $firstArchive = Join-Path $packOneDir $packOne.filename
  $secondArchive = Join-Path $packTwoDir $packTwo.filename
  $firstSha256 = Get-FileSha256 $firstArchive
  $secondSha256 = Get-FileSha256 $secondArchive
  $firstIntegrity = Get-ArchiveIntegrity $firstArchive
  $secondIntegrity = Get-ArchiveIntegrity $secondArchive
  if ($firstSha256 -cne $secondSha256 -or $firstIntegrity -cne $secondIntegrity) { throw 'Repeated npm pack of the same pinned source was not byte-for-byte reproducible.' }

  $auditRoot = Join-Path $workRoot 'package-audit'
  [void][IO.Directory]::CreateDirectory($auditRoot)
  [void](Invoke-CheckedCommand $tar.Source @('-xzf',$firstArchive,'-C',$auditRoot) 'Could not inspect the generated package')
  $packedRoot = Join-Path $auditRoot 'package'
  foreach ($relative in @('meshdevicefile.js','webserver.js','meshcentral-config-schema.json','public\styles\custom.css','public\scripts\custom.js')) {
    if (-not (Test-Path -LiteralPath (Join-Path $packedRoot $relative) -PathType Leaf)) { throw "Required file is absent from the built package: $relative" }
  }
  if (-not (Get-Content -LiteralPath (Join-Path $packedRoot 'meshdevicefile.js') -Raw).Contains('MESHRIGHT_NOFILES',[StringComparison]::Ordinal)) { throw 'Generated package lost the reviewed file-sharing security fix.' }
  if (-not (Get-Content -LiteralPath (Join-Path $packedRoot 'webserver.js') -Raw).Contains('force2factorPending',[StringComparison]::Ordinal)) { throw 'Generated package lost the reviewed forced-two-factor security fix.' }

  $nodeVersion = (@(& $node.Source '--version' 2>&1) -join '').Trim()
  $npmVersion = (@(& $npm.Source '--version' 2>&1) -join '').Trim()
  $gitVersion = (@(& $git.Source '--version' 2>&1) -join '').Trim()
  $shortOverlay = $OverlayCommit.Substring(0,12)
  $archiveName = "MeshCentral-$upstreamVersion-upstream-$($upstreamCommit.Substring(0,12))-overlay-$shortOverlay.tgz"
  $finalArchive = Join-Path $outputPath $archiveName
  $finalManifest = Join-Path $outputPath 'manifest.json'
  foreach ($target in @($finalArchive,$finalManifest)) { if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite existing build output: $target" } }
  Copy-Item -LiteralPath $firstArchive -Destination $finalArchive
  $outputFiles += $finalArchive

  $manifest = [ordered]@{
    schemaVersion = 1
    createdUtc = [DateTime]::UtcNow.ToString('o')
    upstream = [ordered]@{ repository = 'Ylianst/MeshCentral'; url = $upstreamUrl; commit = $upstreamCommit }
    overlay = [ordered]@{ repository = 'treborygan/MeshCentral'; commit = $OverlayCommit }
    package = [ordered]@{ name = $package.name; version = $package.version; dependenciesMatchReference = $dependenciesMatchReference }
    packaging = [ordered]@{ addedUpstreamFile = 'meshcentral-config-schema.json'; reason = 'The pinned source changes this schema, but the upstream npm files allowlist omits it.' }
    security = [ordered]@{ noFilesPermissionMarker = $true; forceTwoFactorMarker = $true; configSchemaPackaged = $true }
    assets = [ordered]@{ customCssSha256 = Get-FileSha256 (Join-Path $packedRoot 'public\styles\custom.css'); customJsSha256 = Get-FileSha256 (Join-Path $packedRoot 'public\scripts\custom.js') }
    builder = [ordered]@{ node = $nodeVersion; npm = $npmVersion; git = $gitVersion }
    reproducibility = [ordered]@{ repeatSha256 = $secondSha256; repeatIntegrity = $secondIntegrity }
    archive = [ordered]@{ file = $archiveName; sha256 = Get-FileSha256 $finalArchive; integrity = Get-ArchiveIntegrity $finalArchive }
  }
  $manifestJson = ConvertTo-Json -InputObject $manifest -Depth 20
  [IO.File]::WriteAllText($finalManifest,$manifestJson,[Text.UTF8Encoding]::new($false))
  $outputFiles += $finalManifest
  Write-Output "PINNED_UPSTREAM_COMMIT=$upstreamCommit"
  Write-Output "OVERLAY_COMMIT=$OverlayCommit"
  Write-Output "PACKAGE_VERSION=$($package.version)"
  Write-Output "PACKAGE_SHA256=$($manifest.archive.sha256)"
  Write-Output "PACKAGE_INTEGRITY=$($manifest.archive.integrity)"
  Write-Output 'REPRODUCIBLE_PACK=PASS'
  Write-Output 'REVIEWED_SECURITY_FIXES=PASS'
  Write-Output "BUILD_OUTPUT=$outputPath"
} catch {
  foreach ($path in $outputFiles) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
  if ($outWasCreated -and (Test-Path -LiteralPath $outputPath -PathType Container) -and @(Get-ChildItem -LiteralPath $outputPath -Force).Count -eq 0) { Remove-Item -LiteralPath $outputPath -Force }
  throw
} finally {
  $fullWorkRoot = [IO.Path]::GetFullPath($workRoot)
  if (-not $fullWorkRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove a temporary build path outside the system temporary directory.' }
  if (Test-Path -LiteralPath $fullWorkRoot -PathType Container) { Remove-Item -LiteralPath $fullWorkRoot -Recurse -Force }
}
