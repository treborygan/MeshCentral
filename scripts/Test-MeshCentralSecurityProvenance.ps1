[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,
  [string]$TarballPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedRoot = (Resolve-Path -LiteralPath $InstallRoot).Path
$lockPath = Join-Path $resolvedRoot 'package-lock.json'
$packageRoot = Join-Path $resolvedRoot 'node_modules\meshcentral'
if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) { throw "Missing package lock: $lockPath" }
if (-not (Test-Path -LiteralPath $packageRoot -PathType Container)) { throw "Missing installed package: $packageRoot" }

$lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json -AsHashtable
$locked = $lock.packages['node_modules/meshcentral']
if ($null -eq $locked) { throw 'package-lock.json does not contain node_modules/meshcentral.' }
$package = Get-Content -LiteralPath (Join-Path $packageRoot 'package.json') -Raw | ConvertFrom-Json
$blocked = $false

if ($package.version -ne $locked.version) {
  Write-Output "BLOCKED package version mismatch: lock=$($locked.version) installed=$($package.version)"
  $blocked = $true
} else {
  Write-Output "PACKAGE_VERSION=$($locked.version)"
}

if ($locked.resolved -notmatch '^https://registry\.npmjs\.org/meshcentral/-/meshcentral-[^/]+\.tgz$') {
  Write-Output "BLOCKED unsupported registry source: $($locked.resolved)"
  $blocked = $true
}
if ($locked.integrity -notmatch '^sha512-[A-Za-z0-9+/]+=*$') {
  Write-Output 'BLOCKED package lock has no supported SHA-512 integrity value.'
  $blocked = $true
}
if ($blocked) { Write-Output 'SECURITY_PROVENANCE_GATE=BLOCKED'; exit 2 }

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$workRoot = Join-Path $tempBase ('meshcentral-security-audit-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($workRoot)
$downloadedTarball = $null
try {
  if ([string]::IsNullOrWhiteSpace($TarballPath)) {
    $tarball = Join-Path $workRoot 'meshcentral.tgz'
    $downloadedTarball = $tarball
    Invoke-WebRequest -Uri $locked.resolved -OutFile $tarball
  } else {
    $tarball = (Resolve-Path -LiteralPath $TarballPath).Path
  }

  $sha = [Security.Cryptography.SHA512]::Create()
  $stream = [IO.File]::OpenRead($tarball)
  try { $digest = $sha.ComputeHash($stream) }
  finally { $stream.Dispose(); $sha.Dispose() }
  $actualIntegrity = 'sha512-' + [Convert]::ToBase64String($digest)
  if ($actualIntegrity -ne $locked.integrity) {
    Write-Output 'BLOCKED downloaded/provided tarball does not match package-lock.json SHA-512 integrity.'
    Write-Output "LOCK_INTEGRITY=$($locked.integrity)"
    Write-Output "TARBALL_INTEGRITY=$actualIntegrity"
    Write-Output 'SECURITY_PROVENANCE_GATE=BLOCKED'
    exit 2
  }
  Write-Output 'TARBALL_INTEGRITY=VERIFIED'

  $tar = Get-Command tar.exe -ErrorAction Stop
  $extractRoot = Join-Path $workRoot 'extract'
  [void][IO.Directory]::CreateDirectory($extractRoot)
  & $tar.Source -xzf $tarball -C $extractRoot
  if ($LASTEXITCODE -ne 0) { throw "tar.exe extraction failed with exit code $LASTEXITCODE." }

  $targetedFiles = @(
    'amt/amt-redir-mesh.js',
    'apprelays.js',
    'meshdevicefile.js',
    'meshuser.js',
    'webserver.js',
    'meshcentral-config-schema.json'
  )
  foreach ($relativePath in $targetedFiles) {
    $tarballFile = Join-Path (Join-Path $extractRoot 'package') ($relativePath -replace '/', '\')
    $installedFile = Join-Path $packageRoot ($relativePath -replace '/', '\')
    $inTarball = Test-Path -LiteralPath $tarballFile -PathType Leaf
    $installed = Test-Path -LiteralPath $installedFile -PathType Leaf
    if ($inTarball -and $installed) {
      $tarHash = (Get-FileHash -LiteralPath $tarballFile -Algorithm SHA256).Hash
      $installedHash = (Get-FileHash -LiteralPath $installedFile -Algorithm SHA256).Hash
      if ($tarHash -ne $installedHash) {
        Write-Output "BLOCKED package file differs from verified tarball: $relativePath"
        $blocked = $true
      } else {
        Write-Output "PACKAGE_FILE_MATCH=$relativePath"
      }
    } elseif (-not $inTarball -and -not $installed) {
      Write-Output "PACKAGE_FILE_ABSENT_FROM_BOTH=$relativePath"
    } else {
      Write-Output "BLOCKED package file presence differs: $relativePath"
      $blocked = $true
    }
  }

  $fixProbes = @(
    @{ Name = 'file-share NoFiles permission enforcement'; Path = 'meshdevicefile.js'; Marker = 'MESHRIGHT_NOFILES' },
    @{ Name = 'forced two-factor setup gate'; Path = 'webserver.js'; Marker = 'force2factorPending' }
  )
  foreach ($probe in $fixProbes) {
    $sourcePath = Join-Path (Join-Path $extractRoot 'package') $probe.Path
    $source = Get-Content -LiteralPath $sourcePath -Raw
    if ($source.Contains($probe.Marker, [StringComparison]::Ordinal)) {
      Write-Output "REVIEWED_FIX_MARKER_PRESENT=$($probe.Name)"
    } else {
      Write-Output "BLOCKED REVIEWED_FIX_MARKER_MISSING=$($probe.Name) [$($probe.Marker)]"
      $blocked = $true
    }
  }

  if ($blocked) {
    Write-Output 'SECURITY_PROVENANCE_GATE=BLOCKED'
    exit 2
  }
  Write-Output 'SECURITY_PROVENANCE_GATE=PASS'
  exit 0
}
finally {
  $fullWorkRoot = [IO.Path]::GetFullPath($workRoot)
  if (-not $fullWorkRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to remove a temporary path outside the system temporary directory.'
  }
  if (Test-Path -LiteralPath $fullWorkRoot -PathType Container) {
    Remove-Item -LiteralPath $fullWorkRoot -Recurse -Force
  }
}
