# Deploy Night Shift to an existing MeshCentral installation

**Intent:** change CSS only. No agent/server/database migration and no service binary change.

## Preconditions

- Open the current MeshCentral page from a working, approved connection.
- Verify the installed version and find the **real** MeshCentral root (the directory containing `meshcentral-data` and `node_modules`). Paths differ by Windows installation. Do not assume a fixed path.
- Confirm independent recovery access before touching the service.
- Review active `meshcentral-web` assets; the instance may already have other customizations.
- If the directory already has `custom.css`, **do not replace it without a merge review**: create a combined file after comparing styles.

## Staging, non-disruptive

Copy only `public/styles/custom.css` from the fork's `feature/night-shift-ui` branch to the MeshCentral persistent override directory:

```
<meshcentral-root>/
  meshcentral-web/
    public/
      styles/
        custom.css
```

Use an atomic file replacement after backing up any current CSS. Do **not** copy the entire repository or replace a `views/default*.handlebars` template in this slice.

The server automatically loads a `custom.css` override last. Check the served CSS in browser DevTools → Network and hard-refresh with cache bypass. A service restart should not be the first step for a static CSS change; only restart if verification shows the server is not serving the new override and its behavior requires restart.

## Windows PowerShell example

Run from the MeshCentral server's authorized admin shell. **Set both paths after verifying them**, and keep original permissions/ACLs intact.

```powershell
$MeshRoot = 'C:\REPLACE-WITH-VERIFIED-MESHCENTRAL-ROOT'
$SourceCss = 'C:\REPLACE-WITH-CHECKED-OUT-FORK\public\styles\custom.css'
$TargetDir = Join-Path $MeshRoot 'meshcentral-web\public\styles'
$TargetCss = Join-Path $TargetDir 'custom.css'

if (-not (Test-Path -LiteralPath (Join-Path $MeshRoot 'meshcentral-data'))) { throw 'Invalid MeshCentral root' }
if (-not (Test-Path -LiteralPath $SourceCss -PathType Leaf)) { throw 'Source CSS missing' }
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
if (Test-Path -LiteralPath $TargetCss) {
  $Backup = "$TargetCss.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $TargetCss -Destination $Backup -ErrorAction Stop
  Write-Host "Backup: $Backup"
}
$Stage = Join-Path $TargetDir 'custom.css.staging'
Copy-Item -LiteralPath $SourceCss -Destination $Stage -Force -ErrorAction Stop
# Stop here if an existing custom.css had local edits: review/merge before replacement.
Move-Item -LiteralPath $Stage -Destination $TargetCss -Force -ErrorAction Stop
Write-Host "CSS deployed; verify from browser. No MeshCentral service restart performed."
```

This script is a **template**, not a command already executed on PCRN. A release automation should add a diff/merge gate and a proper atomic swap with Windows ACL protection.

## Verify immediately

- Existing protected site and login (including Access/2FA)
- Main device group/list and search
- Device desktop: connect/disconnect, keyboard and mouse, fullscreen, quality
- Terminal: type, paste, resize; Files: navigation/upload/download
- User role scopes, dialogs and settings
- Android portrait + landscape: navigation, touch target sizes, remote keyboard
- Mobile browser RDP and agent desktop *separately*
- Console errors and WebSocket Network entries, especially existing 39-second disconnects

The overlay does **not** fix WebSocket or corporate proxy interruptions.

## Rollback

Restore the backed-up `custom.css` (or delete the Night Shift override if none existed previously), hard-refresh, and verify. Do not roll back the server or agents; they were not changed.

## Source-of-truth guard

Use only the contents of this MeshCentral fork for Night Shift. Keep the independent interactive concept as a visual target; simulated control interactions must be implemented with real MeshCentral APIs before being presented as functioning.
