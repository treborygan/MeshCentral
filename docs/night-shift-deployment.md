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

The script verifies the root, creates a timestamped backup with a manifest, installs only CSS and JS, and leaves the service running. It refuses to overwrite an unrelated nonempty custom.css or custom.js unless -ReplaceExisting is explicitly supplied (after reviewing and preserving the originals). When `meshcentral-web` is created for the first time, restart MeshCentral once so it discovers the override directory; the existing service can then continue serving both assets without further restarts.

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

## Structural UI branch rollout — 2026-11-04

The structural Night Shift revision was installed on PCRN from PR #3 source commit `989ae01333c0fc66fa19bc5de77152228345736`. The PR remains a draft; its latest source revision at the time of installation is recorded here so deployment evidence is not mistaken for release acceptance.

- Installed only `public/styles/custom.css` and `public/scripts/custom.js` into `C:\ProgramData\MeshCentral\meshcentral-web\public`, using `scripts/Install-NightShift.ps1 -ReplaceExisting`.
- Incremental rollback backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261104-193015-a778de`. The manifest records and preserves both prior overrides.
- Both installed assets match the source commit SHA-256 byte-for-byte. PCRN returned HTTP 200 for local `/styles/custom.css` and `/scripts/custom.js`; the root page returned HTTP 200 and referenced the customized assets. An unauthenticated public request returned HTTP 302 to Cloudflare Access.
- `node --check public/scripts/custom.js` passed. `node --test tests/night-shift.test.cjs` passed 11/11 checks.
- MeshCentral, MeshCentralCloudflared and Mesh Agent remained running. No service restart, configuration, database, agent, tunnel, or network route was changed.

Authenticated visual review and end-to-end acceptance for remote desktop, terminal, files, roles, plugins, and mobile touch remain open. The deployment proves the installed UI assets and current access gate; it does not certify those workflows.
## PCRN rollout record — 2026-11-04

- MeshCentral 1.3.1 at `C:\ProgramData\MeshCentral`; only `custom.css` and `custom.js` were added under its persistent `meshcentral-web\public` override.
- Backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261104-172151-f30fb4`. The manifest confirms both files were absent before installation; rollback removes the two added files.
- MeshCentral was restarted once to discover the new override directory. MeshCentral, MeshCentralCloudflared and Mesh Agent were all running afterward.
- Local HTTP checks returned 200 for both assets, matched their installed SHA-256 bytes, and confirmed the root HTML references both assets. Anonymous public asset access returned 302 to Cloudflare Access.
- Source contract tests and the Windows install/hash/rollback fixture passed. Authenticated browser, Android/iOS touch, RDP input, and full feature/role acceptance remain open; this rollout is not a device-acceptance claim.

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

## Login page activation fix — 2026-11-04

The live root renders MeshCentral's `login2` template, which has `body.login` and `#centralTable` but no `#container`. The first override version therefore left this entry page outside the JavaScript theme activation path, and its inline blue background could cover the global theme. The update themes that native login template while leaving its login and account actions untouched.

- Incremental backup of the previously deployed override: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261104-174005-a89c79`.
- The original deployment backup (`20261104-172151-f30fb4`) still restores the pre-Night-Shift state. To remove the whole customization, roll back from that original backup; rolling back only from the incremental backup restores the prior Night Shift version.
- After the update, local HTTP checks returned 200 for both files, matched their installed bytes, and confirmed the root HTML references both assets. The served JavaScript contains the login2 activation path and the CSS contains the login-specific background override.
- Latest test suite: 8/8 Node checks passed. Browser rendering, authenticated flows and phone/RDP touch acceptance remain open.
