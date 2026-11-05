# Night Shift — install on an existing MeshCentral server

**No migration is required.** Keep config.json, database, certificates, agents, service, Cloudflare Tunnel/Access and existing network routes unchanged.

## What changes

- Source: public/styles/custom.css → MeshCentralRoot/meshcentral-web/public/styles/custom.css
- Source: public/scripts/custom.js → MeshCentralRoot/meshcentral-web/public/scripts/custom.js
- Maintain `custom.js` in `public/scripts/night-shift/mobile-controls.js`, `shell.js` and `devices.js`; regenerate and verify the deployment bundle with `node scripts/build-night-shift.js` and `node scripts/build-night-shift.js --check` before installing.
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


## Authenticated live UI acceptance — 2026-11-04

After deployment, the authenticated browser review reproduced a navigation issue: the Night Shift More-menu route dispatcher called MeshCentral's native navigation through a synthetic click, while native sidebar routes listen for mouseup. The fix now dispatches the native mouseup event. Source revision `132b706f951a9ff8f2e3d7f3f3400ff7e7578f5f` was deployed to PCRN. The incremental rollback backup is `C:\\ProgramData\\MeshCentral\\meshcentral-web\\.night-shift-backups\\20261104-201809-38aed5`.

Live verification confirmed the public script returned HTTP 200 with a Cloudflare cache MISS and contained the patched dispatch. Authenticated read-only browser checks passed for device search/status filtering, dashboard and More-menu Events navigation, Files root, Users list, Server general/stats, and toggling between Night Shift cards and the native device list. The More-menu navigation now reaches Events successfully.

At 390×844, the mobile bottom navigation and page changes worked. A visual issue remains: the account greeting and Logout text are clipped at the right edge of the mobile masthead. This needs a follow-up UI adjustment and phone recheck.

No new remote desktop input, terminal command, file transfer, permission change, or administrative mutation was performed during this browser pass. Earlier remote desktop and server-file connection checks are recorded in the PCRN rollout notes above; this browser pass does not certify those workflows. Full touch/accessibility and broader remote-management acceptance remain open. The pull request remains a draft.

## Mobile masthead source synchronization — 2026-11-05

The authenticated 390×844 review above exposed clipping at the right side of the masthead. The currently installed `custom.css` contains a 110-line mobile usability patch added after the recorded Git source revision; it bounds the account menu and appbar, hides the redundant legacy logout text on mobile while retaining native logout in the account menu, and improves narrow-screen card/navigation sizing. This patch was missing from the repository branch.

The patch was synchronized into `public/styles/custom.css` and covered by a regression test. Source adds horizontal safe-area insets to the masthead and account menu. Before deployment, the production root was verified as `C:\ProgramData\MeshCentral`, its `meshcentral-data` directory existed, MeshCentral was running on configured port 9455, and the local root/CSS/JS endpoints returned HTTP 200. The installer was dry-run first and the currently installed asset hashes were recorded in the rollback manifest.


## Structural source rollout — 2026-11-05

Source commit `cd2e4a0c2e4da552feac055557dc09ebef33ede4` was installed on the active MeshCentral 1.3.1 instance at `C:\ProgramData\MeshCentral`. Before installation, the data directory, running MeshCentral process, configured port 9455 listener and existing override paths were confirmed. The installer created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-111858-7397b2`; its manifest records the prior CSS hash `D2965A0B9CA93D312D65A0583BBF44D81D6E67CBEE6923438AE3991F38F26E0D` and JS hash `7D50EED58E7B8C4C1C915EE120B0EF3DFA6245B11CF2E03D83BBA896EF275217`.

After installation, MeshCentral, MeshCentralCloudflared and Mesh Agent remained running and the listener stayed on loopback port 9455. Local HTTP returned 200 for `/`, `/styles/custom.css` and `/scripts/custom.js`; the root HTML references both override assets. Installed files and served response bodies match source SHA-256: CSS `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA`, JS `7B816119705B130193E3B1C1B8FF82F0A91757234A43A2A4A7A40153967A0066`. No service restart or configuration, database, agent, tunnel or network-route change was made. Authenticated visual and feature acceptance has not been performed; deployment is not release acceptance.

## Inventory tag-search update — 2026-11-05

Source commit `f8d8673da6fd67d46adb10cf1cd6d31e0a07c796` adds native device tags to free-text inventory search. The regression test confirms a tag-only query filters to the matching device. Before installing, MeshCentral 1.3.1 and the root/data directory were reconfirmed; the configured `/` and both current override endpoints returned HTTP 200. The installer dry-run completed before the update.

Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-112811-ae369c`. Its manifest records the prior CSS hash `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA` and JS hash `7B816119705B130193E3B1C1B8FF82F0A91757234A43A2A4A7A40153967A0066`. Installed files and local HTTP response bodies match the new source: CSS `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA`, JS `60604C6816612F9C885D9E39C9AFAB86BE47B5E7E8090348C4830AE7F46DEB0C`. All three services stayed running; no restart, configuration or data change was made. Authenticated visual and workflow acceptance remains open.

## Keyboard skip-link update — 2026-11-05

Source commit `b41af737` adds a keyboard-first skip link before the native shell. It becomes visible on focus and transfers focus to the currently visible MeshCentral page, including remote desktop, without changing its native navigation or access behavior. Automated coverage verifies focus on both a detail page and a remote-session page; all 43 focused tests passed.

Before installing, MeshCentral 1.3.1, the existing root/data directory, running services and loopback responses for `/`, `/styles/custom.css` and `/scripts/custom.js` were confirmed. The installer dry-run passed. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-113452-badd98`; its manifest records the previous CSS hash `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA` and JS hash `60604C6816612F9C885D9E39C9AFAB86BE47B5E7E8090348C4830AE7F46DEB0C`.

Installed files and local HTTP response bodies match source SHA-256: CSS `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE`, JS `DC668C469F2F6302292EC6DBAAB692464540F4E1DAA30D7E158D11174D97D5A0`. MeshCentral, MeshCentralCloudflared and Mesh Agent remained running; no restart, configuration, database, agent, tunnel or route change was made. Authenticated keyboard and visual acceptance remains open.

## Remote-viewer toolbar keyboard update — 2026-11-05

Source commit `e44bc2e7` adds horizontal toolbar semantics, roving tab focus and Left/Right/Home/End navigation. Unavailable native actions are excluded from the focus sequence; Tab continues to enter or leave the toolbar normally. The regression test exercises wrapping, endpoints and skipping the hidden Disconnect control. All 43 focused tests passed.

Preflight reconfirmed MeshCentral 1.3.1, the existing `C:\ProgramData\MeshCentral` data root, running services and HTTP 200 for the root and both overrides. The installer dry-run completed before installation. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-113912-6273b4`; its manifest records the prior CSS hash `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE` and JS hash `DC668C469F2F6302292EC6DBAAB692464540F4E1DAA30D7E158D11174D97D5A0`.

Installed files and local HTTP response bodies match source SHA-256: CSS `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE`, JS `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. MeshCentral, MeshCentralCloudflared and Mesh Agent remained running; no restart, configuration or data change was made. Live visual and remote-session acceptance remain open.
