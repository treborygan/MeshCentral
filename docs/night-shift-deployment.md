# Night Shift — install on an existing MeshCentral server

**No migration is required.** Keep config.json, database, certificates, agents, service, Cloudflare Tunnel/Access and existing network routes unchanged.

## What changes

- Source: public/styles/custom.css → MeshCentralRoot/meshcentral-web/public/styles/custom.css
- Source: public/scripts/custom.js → MeshCentralRoot/meshcentral-web/public/scripts/custom.js
- MeshCentral supports these persistent web override locations. No server binaries or Handlebars templates are replaced.

## Install on PCRN (Windows PowerShell)

1. Confirm an independent recovery method and locate the real MeshCentral root (containing meshcentral-data).
2. Check out the feature/night-shift-ui branch of treborygan/MeshCentral on PCRN.
3. From the fork checkout directory, execute:

```powershell
.\scripts\Install-NightShift.ps1 -MeshRoot 'C:\REPLACE-WITH-ACTUAL-MESHCENTRAL-ROOT'
```

The script verifies the root, creates a timestamped backup with a manifest, installs only CSS and JS, and leaves the service running. It refuses to overwrite an unrelated nonempty custom.css or custom.js unless -ReplaceExisting is explicitly supplied (after reviewing and preserving the originals).

Open https://rdp.treborygan.dev and select the **Modern UI** in the existing interface when necessary; hard-refresh and verify both custom assets are served. If the new overrides do not load, restart only MeshCentral at a safe time. Changing siteStyle to 3 is optional; not required if Modern UI is already selected and not included in the installer.

## Dry run

```powershell
.\scripts\Install-NightShift.ps1 -MeshRoot 'C:\REPLACE-WITH-ACTUAL-MESHCENTRAL-ROOT' -WhatIf
```

## Rollback

The installer reports the exact backup directory. Use that path:

```powershell
.\scripts\Install-NightShift.ps1 -MeshRoot 'C:\REPLACE-WITH-ACTUAL-MESHCENTRAL-ROOT' -RollbackFrom 'C:\...\meshcentral-web\.night-shift-backups\BACKUP-FOLDER'
```

Hard-refresh after rollback. Restore both override files independently; if a target file did not exist before, the installer deletes it. No service, agent or database rollback is necessary.

## Acceptance checklist

- Authentication, 2FA, user roles, device lists/groups, plugins and server settings.
- Browser RDP and MeshAgent desktop connections, quality/framerate settings, disconnect, consent and clipboard.
- Android portrait and landscape: direct touch, trackpad, right-click, soft keyboard, zoom/pan, special keys, fullscreen, monitors.
- Terminal input and resizing; Files upload/download; guest access; events; Intel AMT when available.
- Browser console and Cloudflare/WebSocket behavior. Existing Zscaler disconnections are a separate issue.

## Source verification

```powershell
node --check public/scripts/custom.js
node --test tests/night-shift.test.cjs
```

The CI workflow also parses the installer on Windows. These checks verify syntax and invariants; they do not establish live PCRN or phone RDP acceptance.
