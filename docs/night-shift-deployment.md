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

## User administration responsive styling — 2026-11-05

- Installed source commit: `1f5a3b98` (`feat(ui): make user group details responsive`). The deployment contains the preceding user-group list and My Users responsive styling from the same feature branch.
- Verified target: `C:\ProgramData\MeshCentral`, with `meshcentral-data` present. The installer `-WhatIf` check passed before installation.
- The standard installer backed up the prior CSS and JS, then replaced only `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js`. It left MeshCentral configuration, data, agents, services and Cloudflare unchanged.
- Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115040-fd71df`. Its manifest records both prior files and SHA-256 hashes.
- Post-install, the site root and both local override endpoints returned HTTP 200. Source, installed and served CSS SHA-256 all match `2E52F8DF617365E7E887C4178472C43276704BF2D677D0805F0DA0801F5B5E49`; source, installed and served JS SHA-256 all match `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Mesh Agent and MeshCentralCloudflared remained running.
- Authenticated visual review and restricted/admin user-group workflows were not performed; this verifies asset installation and serving only.

## Server administration overview — 2026-11-05

- Installed source commit: `d4fe3b0b` (`feat(ui): modernize server admin overview`).
- The same verified target, `C:\ProgramData\MeshCentral`, and standard web-only installer were used after a successful `-WhatIf` run. The installer changed only the Night Shift CSS/JS overrides and created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115351-745b58`.
- The snapshot manifest records the previous CSS SHA-256 `2E52F8DF617365E7E887C4178472C43276704BF2D677D0805F0DA0801F5B5E49` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- After installation, source, installed and served CSS SHA-256 all match `6EA1DAB3252D7E554B558860B5103D8ADECE32C41C0A4C33A267C72E8FCFE980`; source, installed and served JS SHA-256 all match `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root and asset endpoints returned HTTP 200; Mesh Agent and MeshCentralCloudflared remained running.
- Live admin-authenticated layout and workflow review remains outstanding.

## Account/security settings — 2026-11-05

- Installed source commit: `dc482d22` (`feat(ui): organize account security settings`).
- Target root and local root/CSS/JS endpoints were confirmed before running the standard installer. The first combined `-WhatIf` and install invocation remained in dry-run mode; hashes confirmed no mutation. The installer was then run in a fresh command and created snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115741-0da045`.
- The manifest records prior CSS SHA-256 `6EA1DAB3252D7E554B558860B5103D8ADECE32C41C0A4C33A267C72E8FCFE980` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- Post-install source, installed and served CSS SHA-256 all match `CB3D86407368FB5E9E7258A26EEC7F493EA4BFD03D77B688B2B20226B4772F88`; source, installed and served JS SHA-256 all match `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root returned HTTP 200.
- Authenticated account/security visual and workflow acceptance remains outstanding.

## Native dialogs — 2026-11-05

- Installed source commit: `a078b248` (`feat(ui): improve native dialog presentation`).
- The existing PRN target and local root/CSS/JS endpoints returned HTTP 200 before installation; installer dry run passed. The standard installer changed only the two web overrides and created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120018-cf3887`.
- Snapshot manifest prior asset hashes: CSS `CB3D86407368FB5E9E7258A26EEC7F493EA4BFD03D77B688B2B20226B4772F88`; JS `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- After installation, source, installed and served CSS SHA-256 all match `482F923E5955B6F75DCCAD481475FC04D80D25FBEE9D861D06539D479B1131BE`; JS hashes match `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root returned HTTP 200.
- Authenticated modal workflows and visual acceptance remain outstanding.

## Keyboard-accessible event history — 2026-11-05

- Installed source commit: `f5433273` (`feat(a11y): enable keyboard event history`).
- The verified PRN root and asset endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120416-fe8e83`.
- Snapshot manifest records the prior CSS SHA-256 `482F923E5955B6F75DCCAD481475FC04D80D25FBEE9D861D06539D479B1131BE` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- Post-install source, installed and served CSS SHA-256 all match `4C47D0632825439D2CB2F9C6014CCB2530886F036F7869AAE8367DDFAD790436`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root and assets returned HTTP 200.
- Keyboard activation is covered in the Node harness; authenticated screen-reader and browser acceptance remain open.

## User record detail layout — 2026-11-05

- Installed source commit: `72323daa` (`feat(ui): make user record details responsive`).
- PRN root and both local override endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120638-0b8d7e`.
- Snapshot manifest records the previous CSS SHA-256 `4C47D0632825439D2CB2F9C6014CCB2530886F036F7869AAE8367DDFAD790436` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- After installation, source, installed and served CSS SHA-256 all match `2BEA4C158383378CC211FDD45C48CC3C8590127E26CA6D1B0B2285C55FC1B9CE`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root returned HTTP 200.
- Authenticated user-role visual and workflow acceptance remain outstanding.

## Device Details layout — 2026-11-05

- Installed source commit: `d73e9d63` (`feat(ui): make device details responsive`).
- Verified PRN root and asset endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120920-ea39af`.
- Snapshot manifest records previous CSS SHA-256 `2BEA4C158383378CC211FDD45C48CC3C8590127E26CA6D1B0B2285C55FC1B9CE` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- Post-install source, installed and served CSS SHA-256 all match `FE86DF1084427D5989DF0F8D6177874413FBFE444920E18D2D81DA3CB92B47B7`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root returned HTTP 200.
- Authenticated device/role and visual acceptance remain outstanding.

## Server statistics and tracing — 2026-11-05

- Installed source commit: `c2aa0e58` (`feat(ui): improve server stats and tracing`).
- PRN root and both override endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-121204-54ab5b`.
- Snapshot manifest records prior CSS SHA-256 `FE86DF1084427D5989DF0F8D6177874413FBFE444920E18D2D81DA3CB92B47B7` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- Post-install source, installed and served CSS SHA-256 all match `A335029697C85E6129DF65C6354D8CFF5F6D967F2F6E1B163D7E4BFDB9772420`; JS hashes all match `529EADCEBD20957EFF01EEFCA3E14A2CC4C75B324B310CA447625B1F0ECE9DB8`. Root returned HTTP 200.
- Admin-authenticated chart and trace workflow acceptance remains outstanding.

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

## Device health connection routes — 2026-11-05

The source change replaces the misleading `Agent status` label with native `Connection routes`. Device state now identifies Agent, AMT CIRA, Intel AMT, Relay and MQTT separately, and reports Offline and Unavailable distinctly. It reads the existing native connection bitmask and adds no requests or persisted data. The focused health tests passed; the full Night Shift suite passed 54/54, and bundle consistency and JavaScript syntax checks passed. This source change was not installed on PRN: the verified PRN MeshCentral 1.3.1 package is missing reviewed security changes, so the production release gate remains open pending a supported package update and verification.

## Recording keyboard access — 2026-11-05

Native MeshCentral recording rows already open their detail dialog with Enter. Night Shift now maps Space on the focused row to that same native key handler, prevents page scrolling, and leaves nested links and controls untouched. The non-bubbling keyboard event does not invoke unrelated page shortcuts. The focused regression passed, the full Night Shift suite passed 55/55, and bundle consistency and JavaScript syntax checks passed. Source only; no PRN install was made while the security release gate remains open.
