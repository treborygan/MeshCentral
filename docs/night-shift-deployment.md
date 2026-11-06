# Night Shift — install on an existing MeshCentral server

**No migration is required.** Keep config.json, database, certificates, agents, service, Cloudflare Tunnel/Access and existing network routes unchanged.

## What changes

- Source: public/styles/custom.css → MeshCentralRoot/meshcentral-web/public/styles/custom.css
- Source: public/scripts/custom.js → MeshCentralRoot/meshcentral-web/public/scripts/custom.js
- Maintain `custom.js` in `public/scripts/night-shift/mobile-controls.js`, `shell.js` and `devices.js`; regenerate and verify the deployment bundle with `node scripts/build-night-shift.js` and `node scripts/build-night-shift.js --check` before installing.
- MeshCentral supports these persistent web override locations. No server binaries or Handlebars templates are replaced.

## Deployment evidence and source provenance

This Windows checkout uses `core.autocrlf=true`, so raw SHA-256 values of installed CRLF files differ from canonical LF Git blobs. The initial raw-hash comparison did not account for that conversion. Rechecking the rollback snapshots after normalizing CRLF to LF matched both tracked CSS/JS blobs for all recorded rollout revisions: `989ae013`, `132b706f`, `cd2e4a0c`, `f8d8673`, `b41af737`, `e44bc2e7`, `1f5a3b98`, `d4fe3b0b`, `dc482d22`, `a078b248`, `f5433273`, `72323daa`, `d73e9d63` and `c2aa0e58`. The current PRN files independently match `c2aa0e58` after the same normalization. Historical raw hashes remain useful for identifying installed/served files; normalized hashes establish their tracked content. Current live evidence is in [the PRN provenance recheck](#prn-override-source-provenance-recheck--2026-11-05).

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

- Recorded source commit label: `1f5a3b98` (`feat(ui): make user group details responsive`). The deployment contains the preceding user-group list and My Users responsive styling from the same feature branch.
- Verified target: `C:\ProgramData\MeshCentral`, with `meshcentral-data` present. The installer `-WhatIf` check passed before installation.
- The standard installer backed up the prior CSS and JS, then replaced only `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js`. It left MeshCentral configuration, data, agents, services and Cloudflare unchanged.
- Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115040-fd71df`. Its manifest records both prior files and SHA-256 hashes.
- Post-install, the site root and both local override endpoints returned HTTP 200. The deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `2E52F8DF617365E7E887C4178472C43276704BF2D677D0805F0DA0801F5B5E49`; the deployment log reports matching JavaScript SHA-256 values in the source worktree, installed file and served response `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Mesh Agent and MeshCentralCloudflared remained running.
- Authenticated visual review and restricted/admin user-group workflows were not performed; this verifies asset installation and serving only.

## Server administration overview — 2026-11-05

- Recorded source commit label: `d4fe3b0b` (`feat(ui): modernize server admin overview`).
- The same verified target, `C:\ProgramData\MeshCentral`, and standard web-only installer were used after a successful `-WhatIf` run. The installer changed only the Night Shift CSS/JS overrides and created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115351-745b58`.
- The snapshot manifest records the previous CSS SHA-256 `2E52F8DF617365E7E887C4178472C43276704BF2D677D0805F0DA0801F5B5E49` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- After installation, the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `6EA1DAB3252D7E554B558860B5103D8ADECE32C41C0A4C33A267C72E8FCFE980`; the deployment log reports matching JavaScript SHA-256 values in the source worktree, installed file and served response `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root and asset endpoints returned HTTP 200; Mesh Agent and MeshCentralCloudflared remained running.
- Live admin-authenticated layout and workflow review remains outstanding.

## Account/security settings — 2026-11-05

- Recorded source commit label: `dc482d22` (`feat(ui): organize account security settings`).
- Target root and local root/CSS/JS endpoints were confirmed before running the standard installer. The first combined `-WhatIf` and install invocation remained in dry-run mode; hashes confirmed no mutation. The installer was then run in a fresh command and created snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-115741-0da045`.
- The manifest records prior CSS SHA-256 `6EA1DAB3252D7E554B558860B5103D8ADECE32C41C0A4C33A267C72E8FCFE980` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- Post-install the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `CB3D86407368FB5E9E7258A26EEC7F493EA4BFD03D77B688B2B20226B4772F88`; the deployment log reports matching JavaScript SHA-256 values in the source worktree, installed file and served response `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root returned HTTP 200.
- Authenticated account/security visual and workflow acceptance remains outstanding.

## Native dialogs — 2026-11-05

- Recorded source commit label: `a078b248` (`feat(ui): improve native dialog presentation`).
- The existing PRN target and local root/CSS/JS endpoints returned HTTP 200 before installation; installer dry run passed. The standard installer changed only the two web overrides and created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120018-cf3887`.
- Snapshot manifest prior asset hashes: CSS `CB3D86407368FB5E9E7258A26EEC7F493EA4BFD03D77B688B2B20226B4772F88`; JS `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- After installation, the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `482F923E5955B6F75DCCAD481475FC04D80D25FBEE9D861D06539D479B1131BE`; JS hashes match `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. Root returned HTTP 200.
- Authenticated modal workflows and visual acceptance remain outstanding.

## Keyboard-accessible event history — 2026-11-05

- Recorded source commit label: `f5433273` (`feat(a11y): enable keyboard event history`).
- The verified PRN root and asset endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120416-fe8e83`.
- Snapshot manifest records the prior CSS SHA-256 `482F923E5955B6F75DCCAD481475FC04D80D25FBEE9D861D06539D479B1131BE` and JS SHA-256 `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`.
- Post-install the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `4C47D0632825439D2CB2F9C6014CCB2530886F036F7869AAE8367DDFAD790436`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root and assets returned HTTP 200.
- Keyboard activation is covered in the Node harness; authenticated screen-reader and browser acceptance remain open.

## User record detail layout — 2026-11-05

- Recorded source commit label: `72323daa` (`feat(ui): make user record details responsive`).
- PRN root and both local override endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120638-0b8d7e`.
- Snapshot manifest records the previous CSS SHA-256 `4C47D0632825439D2CB2F9C6014CCB2530886F036F7869AAE8367DDFAD790436` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- After installation, the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `2BEA4C158383378CC211FDD45C48CC3C8590127E26CA6D1B0B2285C55FC1B9CE`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root returned HTTP 200.
- Authenticated user-role visual and workflow acceptance remain outstanding.

## Device Details layout — 2026-11-05

- Recorded source commit label: `d73e9d63` (`feat(ui): make device details responsive`).
- Verified PRN root and asset endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-120920-ea39af`.
- Snapshot manifest records previous CSS SHA-256 `2BEA4C158383378CC211FDD45C48CC3C8590127E26CA6D1B0B2285C55FC1B9CE` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- Post-install the deployment log reports matching CSS SHA-256 values in the source worktree, installed file and served response `FE86DF1084427D5989DF0F8D6177874413FBFE444920E18D2D81DA3CB92B47B7`; JS hashes all match `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`. Root returned HTTP 200.
- Authenticated device/role and visual acceptance remain outstanding.

## Server statistics and tracing — 2026-11-05

- Deployment was recorded as source commit `c2aa0e58` (`feat(ui): improve server stats and tracing`); normalized installed content matches the tracked Git blobs (see the provenance recheck below).
- PRN root and both override endpoints returned HTTP 200 before the standard installer ran. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-121204-54ab5b`.
- Snapshot manifest records prior CSS SHA-256 `FE86DF1084427D5989DF0F8D6177874413FBFE444920E18D2D81DA3CB92B47B7` and JS SHA-256 `BBDABBD8DD94A53287A58711F845D0857AC8174D78742BE2D666D699371810D7`.
- The deployment log recorded post-install CSS/JS hashes `A335029697C85E6129DF65C6354D8CFF5F6D967F2F6E1B163D7E4BFDB9772420` and `529EADCEBD20957EFF01EEFCA3E14A2CC4C75B324B310CA447625B1F0ECE9DB8`; root and asset endpoints returned HTTP 200. Those raw hashes differ from Git's LF blobs because of Windows newline conversion; normalized asset contents match commit `c2aa0e58`.
- Admin-authenticated chart and trace workflow acceptance remains outstanding.

## PRN override source-provenance recheck — 2026-11-05

The installed and served Night Shift overrides are intact. Installed files and local HTTP response bodies match raw SHA-256 `A335029697C85E6129DF65C6354D8CFF5F6D967F2F6E1B163D7E4BFDB9772420` (CSS) and `529EADCEBD20957EFF01EEFCA3E14A2CC4C75B324B310CA447625B1F0ECE9DB8` (JavaScript). Both endpoints returned HTTP 200.

At commit `c2aa0e58`, the canonical Git blob SHA-256 values are `322F1A3125EA86DEE219025AD9157955A2171590FD9941FECE427B53872B440E` (CSS) and `D514964062A129FF500ECA46E137956D5DE39D0BE7EE5431440886E79F287EFA` (JavaScript). Normalizing installed/served content from CRLF to LF produces those exact hashes. This verifies the current installed content against the tracked source commit; raw hashes differ because of line-ending conversion. No live files were changed during this recheck.

## Structural UI branch rollout — 2026-11-04

The 2026-11-04 rollout record states that the structural Night Shift revision was installed on PCRN from PR #3 source label `989ae01333c0fc66fa19bc5de77152228345736`. The PR remains a draft; the label is retained so deployment evidence is not mistaken for release acceptance.

- Installed only `public/styles/custom.css` and `public/scripts/custom.js` into `C:\ProgramData\MeshCentral\meshcentral-web\public`, using `scripts/Install-NightShift.ps1 -ReplaceExisting`.
- Incremental rollback backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261104-193015-a778de`. The manifest records and preserves both prior overrides.
- The next rollback snapshot (`20261104-201809-38aed5`) contains the deployed files; CRLF-normalized contents match source commit `989ae01333c0fc66fa19bc5de77152228345736`. PCRN returned HTTP 200 for local `/styles/custom.css` and `/scripts/custom.js`; the root page returned HTTP 200 and referenced the customized assets. An unauthenticated public request returned HTTP 302 to Cloudflare Access.
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

The 2026-11-05 rollout record states that source label `cd2e4a0c2e4da552feac055557dc09ebef33ede4` was installed on the active MeshCentral 1.3.1 instance at `C:\ProgramData\MeshCentral`. Before installation, the data directory, running MeshCentral process, configured port 9455 listener and existing override paths were confirmed. The installer created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-111858-7397b2`; its manifest records the prior CSS hash `D2965A0B9CA93D312D65A0583BBF44D81D6E67CBEE6923438AE3991F38F26E0D` and JS hash `7D50EED58E7B8C4C1C915EE120B0EF3DFA6245B11CF2E03D83BBA896EF275217`.

After installation, MeshCentral, MeshCentralCloudflared and Mesh Agent remained running and the listener stayed on loopback port 9455. Local HTTP returned 200 for `/`, `/styles/custom.css` and `/scripts/custom.js`; the root HTML references both override assets. Installed files and served response bodies match source SHA-256: CSS `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA`, JS `7B816119705B130193E3B1C1B8FF82F0A91757234A43A2A4A7A40153967A0066`. No service restart or configuration, database, agent, tunnel or network-route change was made. Authenticated visual and feature acceptance has not been performed; deployment is not release acceptance.

## Inventory tag-search update — 2026-11-05

Source commit `f8d8673da6fd67d46adb10cf1cd6d31e0a07c796` adds native device tags to free-text inventory search. The regression test confirms a tag-only query filters to the matching device. Before installing, MeshCentral 1.3.1 and the root/data directory were reconfirmed; the configured `/` and both current override endpoints returned HTTP 200. The installer dry-run completed before the update.

Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-112811-ae369c`. Its manifest records the prior CSS hash `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA` and JS hash `7B816119705B130193E3B1C1B8FF82F0A91757234A43A2A4A7A40153967A0066`. Installed files and local HTTP response bodies match the new source: CSS `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA`, JS `60604C6816612F9C885D9E39C9AFAB86BE47B5E7E8090348C4830AE7F46DEB0C`. All three services stayed running; no restart, configuration or data change was made. Authenticated visual and workflow acceptance remains open.

## Keyboard skip-link update — 2026-11-05

Source commit `b41af737` adds a keyboard-first skip link before the native shell. It becomes visible on focus and transfers focus to the currently visible MeshCentral page, including remote desktop, without changing its native navigation or access behavior. Automated coverage verifies focus on both a detail page and a remote-session page; all 43 focused tests passed.

Before installing, MeshCentral 1.3.1, the existing root/data directory, running services and loopback responses for `/`, `/styles/custom.css` and `/scripts/custom.js` were confirmed. The installer dry-run passed. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-113452-badd98`; its manifest records the previous CSS hash `4665E4A69543AC0121CB5565B753F387C3EE80C03E1141617F5E3BD2096B55EA` and JS hash `60604C6816612F9C885D9E39C9AFAB86BE47B5E7E8090348C4830AE7F46DEB0C`.

The rollout record listed installed/local-response SHA-256 values CSS `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE` and JS `DC668C469F2F6302292EC6DBAAB692464540F4E1DAA30D7E158D11174D97D5A0`. The next rollback snapshot (`20261105-113912-6273b4`) contains these deployed files; CRLF-normalized contents match the `b41af737` Git blobs. MeshCentral, MeshCentralCloudflared and Mesh Agent remained running; no restart, configuration, database, agent, tunnel or route change was made. Authenticated keyboard and visual acceptance remains open.

## Remote-viewer toolbar keyboard update — 2026-11-05

Recorded source label `e44bc2e7` adds horizontal toolbar semantics, roving tab focus and Left/Right/Home/End navigation. Unavailable native actions are excluded from the focus sequence; Tab continues to enter or leave the toolbar normally. The regression test exercises wrapping, endpoints and skipping the hidden Disconnect control. All 43 focused tests passed.

Preflight reconfirmed MeshCentral 1.3.1, the existing `C:\ProgramData\MeshCentral` data root, running services and HTTP 200 for the root and both overrides. The installer dry-run completed before installation. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-113912-6273b4`; its manifest records the prior CSS hash `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE` and JS hash `DC668C469F2F6302292EC6DBAAB692464540F4E1DAA30D7E158D11174D97D5A0`.

Installed files and local HTTP response bodies match source SHA-256: CSS `3A5E7DC408C55F3AE09C0F7D0D558D27CE104F9AB70FA497C302366FB1B341EE`, JS `8F246999A5A22C9D73790EA62F86897496BAD0379C8D9F0A5653BC1042229B24`. MeshCentral, MeshCentralCloudflared and Mesh Agent remained running; no restart, configuration or data change was made. Live visual and remote-session acceptance remain open.

## Device health connection routes — 2026-11-05

The source change replaces the misleading `Agent status` label with native `Connection routes`. Device state now identifies Agent, AMT CIRA, Intel AMT, Relay and MQTT separately, and reports Offline and Unavailable distinctly. It reads the existing native connection bitmask and adds no requests or persisted data. The focused health tests passed; the full Night Shift suite passed 54/54, and bundle consistency and JavaScript syntax checks passed. This source change was not installed on PRN: the verified PRN MeshCentral 1.3.1 package is missing reviewed security changes, so the production release gate remains open pending a supported package update and verification.

## Recording keyboard access — 2026-11-05

Native MeshCentral recording rows already open their detail dialog with Enter. Night Shift now maps Space on the focused row to that same native key handler, prevents page scrolling, and leaves nested links and controls untouched. The non-bubbling keyboard event does not invoke unrelated page shortcuts. The focused regression passed, the full Night Shift suite passed 55/55, and bundle consistency and JavaScript syntax checks passed. Source only; no PRN install was made while the security release gate remains open.

## Socket-state diagnostics update — 2026-11-05

Remote-session diagnostics now wrap MeshCentral's native `meshserver.onStateChanged` callback and schedule a status refresh after each disconnect or reconnect. The wrapper forwards the original `this` and arguments, returns its value, and uses `finally` so native exceptions propagate while the status still refreshes. A regression verifies both state transitions and native callback behavior. The full Night Shift suite passed 55/55, with bundle consistency and JavaScript syntax checks passing. This is source-only; the PRN security release gate remains open.

## WebRTC path diagnostics — 2026-11-05

Connection diagnostics now include the native `RTCPeerConnection.iceConnectionState` and data-channel `readyState`. A wrapper around MeshCentral's `webRtcDesktopReset()` retains a failed/disconnected ICE state after MeshCentral closes the WebRTC objects, while forwarding native arguments, return value and exceptions. Since the native reset does not clear `desktop.webRtcActive`, the transport label now requires the data channel to be open. Retained failures are scoped to the current device and desktop session, provide native Disconnect/reconnect guidance, and clear when that device/session changes or a healthy WebRTC link opens. Tests exercise checking, failed/reset, connected/open, recovery guidance, stale-flag and cross-device states, including native cleanup. The full Night Shift suite passed 55/55; bundle consistency, syntax and whitespace checks passed. Source only; PRN deployment remains gated on the installed package's missing reviewed security fixes.

## PRN package provenance audit — 2026-11-05

Added `scripts/Test-MeshCentralSecurityProvenance.ps1` as a read-only audit of the PRN package lock, installed package, registry tarball integrity, selected package file hashes and reviewed security-fix markers. Reproduce with `./scripts/Test-MeshCentralSecurityProvenance.ps1 -InstallRoot 'C:\ProgramData\MeshCentral' -TarballPath '<verified-meshcentral-1.3.1.tgz>'`. With the cached 1.3.1 tarball, the audit confirmed lockfile SHA-512 integrity and matching hashes for all six selected paths present in both the tarball and installed package; `meshcentral-config-schema.json` was absent from both. It reported `MESHRIGHT_NOFILES` missing from `meshdevicefile.js` and `force2factorPending` missing from `webserver.js`, then exited 2 with `SECURITY_PROVENANCE_GATE=BLOCKED`. The audit extracted only to a unique temporary directory and removed it; PRN package files were not changed. The PowerShell parser passed, the generated bundle check and JavaScript syntax check passed, and the Night Shift suite passed 55/55. Deployment remains blocked pending a supported package update containing the reviewed fixes.

## Connection profile keyboard map guidance — 2026-11-05

The per-device profile editor now explains that Native/Remote keyboard-map selection applies to MeshAgent desktop. Browser RDP derives its keyboard mapping from the browser locale; Intel AMT retains its native keyboard handling. The help text is linked to the selector with `aria-describedby` and spans the profile grid on narrow layouts. The structural-shell integration regression and full Night Shift suite passed 55/55; bundle, syntax and whitespace checks passed. Source only; no PRN install was made.

## Accessible session state announcements — 2026-11-05

The existing native-session strip now includes a visually hidden polite status region. After its initial render it announces changes to the open session set, active device, or native connection state; initial sessions remain quiet on load. Switching and disconnecting continue to delegate to MeshCentral's native permission-aware controls. The session integration regression and full Night Shift suite passed 55/55; generated-bundle consistency, JavaScript syntax and whitespace checks passed. Source only: PRN deployment remains gated on the missing reviewed package security fixes.

## Persistent session announcement region — 2026-11-05

The session strip now keeps its `role=status` live region attached while replacing session controls. This avoids tearing down the live-region node during native state refreshes, which can suppress or duplicate screen-reader announcements. The focused structural-shell regression and all 55 Night Shift tests passed; generated-bundle consistency, JavaScript syntax and whitespace checks passed. Source only; PRN install remains gated by the package security audit.

## Workspace-persistent remote sessions — 2026-11-05

Moved the native multi-desktop session strip into the shared `column_l` shell, ahead of individual native pages. Open sessions can now be switched to from elsewhere in the workspace; switching and disconnect still invoke MeshCentral's native permission-aware handlers. The profile editor remains anchored inside the Remote Desktop page and no transport/session state is added or persisted. The structural-shell integration regression verifies the strip remains visible with Remote Desktop hidden, and the full 55-test suite passed; bundle, syntax and whitespace checks passed. Source only; no PRN install was made.

## Keyboard navigation for workspace sessions — 2026-11-05

The global session strip now uses horizontal toolbar semantics and roving focus: Tab enters at the active session, Left/Right move across session and disconnect controls, and Home/End reach the first/last control. Native button activation still calls MeshCentral's device-switch/disconnect handlers. The structural-shell keyboard regression and full 55-test suite passed; generated-bundle consistency, JavaScript syntax and whitespace checks passed. Source only; no PRN install was made.

## Alert deduplication memory cleanup — 2026-11-05

Allowed health/connection notices now prune deduplication keys older than five minutes and discard future or invalid timestamps, bounding retained notice history during long-lived sessions with frequent fleet changes. Quiet-hour and opt-in checks remain ahead of cleanup and notification creation; no polling or server calls were added. The focused pruning regression and all 56 tests passed; bundle consistency, JavaScript syntax and whitespace checks passed. Source only; PRN package provenance remains blocked.

## Persistent alert permission guidance — 2026-11-05

Separated browser-notification permission guidance from latest alert announcements. The permission region remains visible and refreshes when alert settings/device state update; the polite alert region reports individual health or connection notices without erasing whether notifications are denied, enabled or unavailable. The alert-focused tests and full 56-test suite passed; generated-bundle consistency, JavaScript syntax and whitespace checks passed. Source only; no PRN install was made.

## Browser notification creation fallback — 2026-11-05

When notification permission is granted but the browser/OS rejects construction of a notification, the latest alert remains in the in-page live region and the separate permission guidance region explains that delivery failure. This preserves a usable fallback without retry loops or changed notification permissions. The focused failure-path regression and full 57-test suite passed; generated-bundle consistency, JavaScript syntax and whitespace checks passed. Source only; PRN install remains gated.

## Alert permission refresh on browser focus — 2026-11-05

The alert permission-guidance region now refreshes on both document visibility changes and window focus, covering return from browser site-notification settings without replacing the latest alert announcement. Alert-focused tests and the full 57-test suite passed; bundle consistency, JavaScript syntax and whitespace checks passed. Source only; no PRN install was made.

## Device health sample freshness — 2026-11-05

The CPU/memory summary now returns to Unavailable when native graph updates stop for six seconds (three missed two-second updates). A newer native sample supersedes the prior expiry, and native graph cleanup and device switching still clear the summary immediately. This uses a one-shot timeout per sample and adds no telemetry requests or recurring polling. Focused health tests passed; broad verification is recorded with the source commit. Source only; no PRN install was made.

## Installer fixture and CI follow-up — 2026-11-05

Added a disposable PowerShell integration check for refusal to replace unrelated customizations, `-WhatIf`, source/installed asset hashes, manifest backup hashes, rollback restoration, rollback removal of newly created files, and preservation of unrelated files and MeshCentral data. Local execution passed. The Windows workflow now runs this check. Public GitHub Actions evidence showed the last successful Night Shift run on PR #3 at `d6577919` (2026-11-04 19:27 UTC), while the current head `2596a5ba` had zero check runs/status contexts despite the workflow being active and its path filters covering the changed modules/tests. No public event error or later run was available, so the trigger gap's underlying repository-side cause remains unresolved; verify the next pushed commit's run before treating CI as current.

Rechecked the PRN security gate read-only on 2026-11-05: the installed package and lock remain 1.3.1, the registry tarball SHA-512 and selected installed/tarball file hashes match, but `MESHRIGHT_NOFILES` and `force2factorPending` remain absent. `npm view meshcentral version dist-tags --json` still reports 1.3.1 for both latest and stable. No upstream-supported newer package is currently available; production deployment remains blocked and no PRN package or configuration was changed.

## Native Agent status in health summary — 2026-11-05

Added a separate health field that labels MeshAgent connected/disconnected from MeshCentral's native `conn` Agent bit and shows the cached agent version when present. Nodes with AMT connectivity but no agent metadata are identified as AMT-available; missing evidence stays Unavailable. This adds no request or permission change. Focused helper regression and broad checks are recorded with the source commit; browser acceptance remains unavailable.

## Upstream stable package availability — 2026-11-05

Fetched official upstream `Ylianst/MeshCentral` master at `2e7ec138`; it remains package version 1.3.1 and contains the reviewed security-fix probes. It differs from the fork's `origin/master` base `c897d5e5` only by an unrelated two-line agent IPC UTF-8 sizing change. Upstream Git tags and npm `latest`/`stable` currently stop at 1.3.1, whose verified tarball fails the PRN file-share and forced-2FA probes. The [official installation guide](https://docs.meshcentral.com/install/quickstart/) documents npm installation; a [MeshCentral maintainer response](https://github.com/Ylianst/MeshCentral/issues/8176) describes direct GitHub installation as latest development code intended for developers. It is not a suitable production replacement for PRN. Keep the package gate open until a stable upstream release contains the fixes and passes the provenance audit; no package/configuration/service changes were made.

## PRN frontend override update — 2026-11-05

Installed the tested Night Shift frontend assets from `feature/night-shift-structural` (latest source before this deployment: `42283d9e`, with UI code through `912dd339`) using `scripts/Install-NightShift.ps1`. Backup/rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-152354-da030e`. The manifest preserved the prior CSS SHA-256 `A335029697C85E6129DF65C6354D8CFF5F6D967F2F6E1B163D7E4BFDB9772420` and JS SHA-256 `529EADCEBD20957EFF01EEFCA3E14A2CC4C75B324B310CA447625B1F0ECE9DB8`. Installed CSS and JS now exactly match the tested working-tree files: `4074FC4DD0C63816164CCB9371154F4201B647AAFC138AEA4FEF062BA5A999A9` and `0DD2456143C4EE3FC71DC87B958CB666A20A7AA149F2A34EED81AA72C5FA6868`. MeshCentral, Cloudflared and Mesh Agent services remained running; configuration, database, certificates, agents, tunnel and routes were not changed. The public hostname redirects unauthenticated requests to Cloudflare Access, and the browser-control host was unavailable, so authenticated browser delivery/visual acceptance still needs a hard refresh and review in an already-authorized browser. To rollback, run `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot 'C:\ProgramData\MeshCentral' -RollbackFrom 'C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-152354-da030e'`.

## GitHub Actions trigger review — 2026-11-05

The connected GitHub Actions API shows successful Night Shift UI workflow runs on PR #3 through `d6577919` (2026-11-04 19:27 UTC); commits `64a9ca31` and `912dd339` have no associated check runs, even though each changes paths covered by the workflow. Recent API records do not expose enough trigger metadata to prove why the events were not created. Added `workflow_dispatch` as a manual recovery path, while preserving push/PR path filters. Reverify a normal Git push and the manually dispatched workflow after this file reaches the default branch; local checks alone are not current-head GitHub Actions evidence.

Post-install loopback verification used the existing `127.0.0.1:9455` listener with `Host: rdp.treborygan.dev`: `/` returned 200 (`PCRN Remote Desktop - Login`) and included both `styles/custom.css` and `scripts/custom.js`; both asset routes returned 200 with the exact installed/source hashes above. This proves the new overrides are being served. Authenticated application and RDP behavior still require review in the signed-in browser.

## GitHub Actions disabled confirmation — 2026-11-05

A direct `gh workflow run night-shift-ui.yml --ref feature/night-shift-structural --repo treborygan/MeshCentral` attempt returned HTTP 422: `Actions has been disabled for this repository.` Earlier CodeQL and Night Shift workflows nevertheless completed on commit `d6577919`; the dispatch response alone does not establish that all Actions were disabled. The current head had no run at this check. The workflow file is also absent from default-branch `master`, so the manual-dispatch path is unavailable until that file reaches the default branch.

## Landscape remote controls deployment — 2026-11-05

Commit `1781be930d3c018b26c644eefe3574a76e30e4dd` was installed with `scripts/Install-NightShift.ps1` to `C:\ProgramData\MeshCentral`. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-162105-8d6b8b`. The installer changed only `public/styles/custom.css` and `public/scripts/custom.js`; it did not restart a service or modify server configuration, database, agents, tunnel or routes.

Installed CSS SHA-256: `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`. Installed JavaScript SHA-256: `2B39A1D7EBD64364DFEB9BBABC5DE34DA74E7DEF83CC70FAC69D889C8071BE4A`. Local GETs for `/`, `/styles/custom.css` and `/scripts/custom.js` returned 200; the login HTML referenced both overrides, and CRLF-normalized served, installed and committed assets matched. MeshCentral, Cloudflared and Mesh Agent remained running.

Chrome 156 rendered the current unauthenticated live login at 390×844 and 1440×900. The page and both override assets returned 200, document width matched viewport width, and no browser console errors were observed. The remote-control interaction was separately checked in a synthetic native-view DOM at 852×394 and 398×862: landscape collapsed the secondary dock to 53px, More expanded it to 101px, portrait restored the full controls, focus remained visible across rotation and horizontal overflow stayed zero. These checks do not verify authenticated dashboard appearance, live Agent/RDP transport or a physical Android/iOS device.

## GitHub Actions follow-up — 2026-11-05

The current GitHub API reports repository Actions `enabled: true`, `allowed_actions: all`, and the Night Shift workflow state `active`. Workflow dispatch returns HTTP 422, while older commits have completed both push and pull-request workflows. The 2026-11-05 review found a concrete push-only CodeQL failure: SARIF upload lacked `security-events: write`; see the CodeQL repair section below. The Night Shift workflow is present and active on `master`, and the latest head still needs a hosted run.

## Security provenance recheck — 2026-11-05

The read-only PRN package audit still reports MeshCentral 1.3.1, verified npm tarball integrity, `MESHRIGHT_NOFILES` missing from `meshdevicefile.js`, and `force2factorPending` missing from `webserver.js`; `SECURITY_PROVENANCE_GATE=BLOCKED` (exit 2). npm latest remains 1.3.1 and official upstream master remains `2e7ec138cf45b09204bf036b500e5e2cf37aaba4` at 1.3.1. No server package was changed: the production deployment remains limited to the verified CSS/JS customization layer.

## Pinned source candidate and trigger update — 2026-11-05

The reproducible source build and isolated package/runtime results are recorded in [the pinned build report](night-shift-pinned-source-build.md). The package was not installed on PRN; the security provenance gate remains blocked for the currently installed package. The existing frontend-only production deployment boundary remains in effect.

The workflow trigger was widened so every pull request update and every push to the two feature branches runs the focused UI, installer and pinned-source checks, including documentation-only updates. Local checks passed; the latest branch head has no hosted run yet. A direct manual-dispatch request returns HTTP 422, but older push and pull-request workflows completed, so this response is not treated as proof that all Actions execution is disabled.

## CodeQL push failure repair — 2026-11-05

Inspection of the failed push run `41897152865` for `d6577919` showed CodeQL analyzed all 240 JavaScript files and failed when uploading SARIF with `Resource not accessible by integration`. The successful PR run for the same commit passed the Night Shift and CodeQL jobs. `.github/workflows/codeql-analysis.yml` now grants only `contents: read` and `security-events: write` to the CodeQL job and uses `github/codeql-action` v4 instead of v2. GitHub's [CodeQL Action documentation](https://github.com/github/codeql-action) requires the SARIF write permission and recommends the supported v4 line. Local YAML parsing passed. The new commit still needs a hosted run to verify the fix; no Actions run is associated with head `7d4e4288` yet.

## PRN override and UI-mode recheck — 2026-11-05

Using the local PRN route with `Host: rdp.treborygan.dev`, `/`, `/styles/custom.css` and `/scripts/custom.js` returned HTTP 200; the root HTML references both overrides. Both override responses use `Cache-Control: public, max-age=0`. CSS SHA-256 is `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript SHA-256 is `2B39A1D7EBD64364DFEB9BBABC5DE34DA74E7DEF83CC70FAC69D889C8071BE4A`, matching the deployed `1781be93` assets.

PRN's domain configuration leaves `siteStyle` unset, so it does not force the Modern UI. MeshCentral exposes its existing Modern UI toggle in that mode; Night Shift enhancement modules attach to the native Modern UI container, while the Classic fallback intentionally disables them. If an authenticated session still shows the original layout, check its existing Modern UI toggle. Configuration was not changed. Authenticated Chrome inspection is still incomplete. On 2026-11-05, the visible Chrome session reached the live sign-in page; after a refresh prompted form resubmission, continuing left the page blank and Chrome marked the tab unresponsive. A second tab to the same host also remained blank. The browser-control host could not attach, so no DOM or console/network trace is available. This does not identify the cause.

The CodeQL permission fix, its regression test and the PRN UI-mode clarification now appear on PR #3 at `f21b90fcd826f4fe0d86bf14bf9cc4fd1b3d8196`. The GitHub API commit tree matched the reviewed local tree exactly after Git pushes returned `Internal Server Error` and `fatal error in commit_refs_rules`. The PR head is synchronized; no workflow run is associated with `f21b90fc` yet.

## GitHub Actions disabled-state recheck — 2026-11-05

The repository API reports Actions `enabled: true` and `allowed_actions: all`; the Night Shift workflow is `active` at `.github/workflows/night-shift-ui.yml` on default branch `master`. No workflow run exists for current head `d23108fc9f14d7cc5893b699a7a32e6cdd653a67`. Dispatching `Night Shift UI checks` on `feature/night-shift-structural` returns HTTP 422, `Actions has been disabled for this repository`. Reaffirming the repository permission setting with a typed boolean leaves the API state unchanged and dispatch still fails. Older hosted runs for `d6577919` passed both Night Shift UI checks and CodeQL.

GitHub's [repository Actions settings guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) states that a separate GitHub-controlled disabled state can prevent workflows even when repository settings are changed; support review is required for that state. No support request was sent. Current-head hosted CI remains unverified pending GitHub's review or restoration of Actions execution.

## Authenticated browser network recheck — 2026-11-05

The latest visible Chrome attempt remains blank after canceling the stalled navigation and issuing a fresh GET to `https://rdp.treborygan.dev/`; the tab continues to show a pending load. DevTools for that tab shows an empty Sources tree and no rendered DOM. The Console displayed no errors, but evaluation did not return. The performance monitor displayed 0 DOM nodes and 0 B JavaScript heap for the inspected target; this is limited browser evidence and does not identify why navigation is pending.

From this host, an unauthenticated public request returns HTTP 302 from Cloudflare Access. The existing MeshCentral loopback route returns the login page in about 160 ms, and both `/styles/custom.css` and `/scripts/custom.js` return HTTP 200 with bytes matching the branch and installed override hashes. This isolates asset delivery from the unresolved authenticated public path. No configuration, service, tunnel, or route was changed.

After the user reported signing in again, the computer-use bridge still reported that the browser host was unavailable. The visible Chrome process had no remote-debugging endpoint. No further navigation or form resubmission was attempted, so the newly signed-in public page was not observed in this check.

## Authenticated Chrome and responsive check — 2026-11-05

A local Playwright Chromium run loaded the PRN loopback login page at 390×844, 768×1024 and 1440×900. Each viewport returned HTTP 200, kept document scroll width equal to viewport width, referenced both custom CSS and JavaScript, and reported no page errors or failed requests. These screenshots cover the unauthenticated login page only.

The user Chrome window has a separate Cloudflare Access callback tab and multiple `rdp.treborygan.dev` tabs. A newly opened direct-URL tab displayed a blank page titled `PCRN Remote Desktop`. Its DevTools Performance Monitor showed 0 DOM nodes, 0 B JavaScript heap and 0% CPU; the Console showed no page errors, and the Elements panel tree was empty. Network recording started after the first navigation and the panel had no recorded requests, so this does not identify the public navigation failure or establish that the Night Shift script caused it. Read-only Cloudflare API checks show the `PCRN MeshCentral (owner only)` Access application protects `rdp.treborygan.dev` with an allow policy limited to the configured owner and a one-hour session. Its authentication log records an allowed owner login at 2026-11-05 17:07:20 UTC. A separate OAuth callback tab displays `invalid state`, which may be stale; the successful Access log confirms authorization but not application-page delivery. The computer-use bridge remains unavailable. The signed-in dashboard and remote session are still unverified.

Focused source checks passed: 7 mobile/viewer compatibility tests, generated bundle freshness, JavaScript syntax and `git diff --check`. Installed PRN CSS and JavaScript hashes still equal the branch and loopback-served hashes (`50283975…1FCBF6D7` and `2B39A1D7…071BE4A`); MeshCentral, Cloudflared and Mesh Agent services remain running. No production file, configuration or service changed during this check.
## PRN asset and UI-mode recheck — 2026-11-05

A fresh read-only check confirmed the installed CSS/JS, the current worktree and local HTTP responses have identical SHA-256 values. The root page and both override endpoints return HTTP 200, and MeshCentral, Cloudflared and Mesh Agent are running. A read-only Cloudflare API check reports tunnel `meshcentral-pcrn` healthy, with the existing `rdp.treborygan.dev` ingress still targeting `http://127.0.0.1:9455`; no tunnel configuration was changed. The rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-162105-8d6b8b` exists. No production files, service state, MeshCentral configuration, database, agents or Cloudflare resources changed during this check.

The PRN domain configuration has no explicit `sitestyle` or `showmodernuitoggle` override. In the installed server source, the authenticated route starts with the Classic `default` template and selects Modern `default3` only when the saved `uiViewMode` is `3` or the domain forces `sitestyle` `3`; the current signed-in account preference could not be read from the browser. Night Shift intentionally disables its Modern stylesheet on Classic pages. The signed-in Chrome page could not be inspected: both the browser bridge and Windows Computer Use helper returned native-pipe unavailable. Asset delivery is verified but authenticated rendering is not.
## Native Classic UI fallback deployment — 2026-11-05

Commit `d178a49b` detects MeshCentral's native Classic application template from its existing `meshcentral.js` runtime script and absence of the Modern-only `style-bootstrap.css` marker. Login templates lack the app runtime and retain the Night Shift login surface; `default3` carries the Modern marker and keeps Night Shift enabled. This check runs before later bundle modules evaluate, so native Classic mode does not attach Modern-only controls.

Installed through `scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -ReplaceExisting`. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-185623-49c58c`. The installer backed up and replaced only `public/styles/custom.css` and `public/scripts/custom.js`; the manifest records the prior CSS hash `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7` and JavaScript hash `2B39A1D7EBD64364DFEB9BBABC5DE34DA74E7DEF83CC70FAC69D889C8071BE4A`. No configuration, database, agents, tunnel or service changed.

Post-install, source, installed and served SHA-256 values match: CSS `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript `7BC4DD9E806CEBE4CA3EF54A7F3D219A9F4DE74A02029C8FB34A5CB995386B1A`. `/`, `/styles/custom.css` and `/scripts/custom.js` returned HTTP 200. MeshCentral, Cloudflared and Mesh Agent remained running. Playwright Chromium at 390×844, 768×1024 and 1440×900 reported no horizontal overflow or page errors; the unauthenticated login retained `ns-theme` and `__NightShiftClassicMode=false`. A synthetic Chromium document using the exact native Classic template markers verified the CSS is disabled, Modern-only modules are absent and the accessible return button is present, with no page errors. The authenticated dashboard, actual native Classic page and RDP session remain unverified.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-185623-49c58c`.
## Native UI chooser return-path deployment — 2026-11-05

Commit `cd736d35` improves the native Classic fallback return control. It clears any stale `_nsClassicUI` preference, then opens MeshCentral's existing `toggleBootstrapUIMode()` selector. MeshCentral remains responsible for saving `uiViewMode` and reloading; the override does not write native user state or change routes.

Installed with the existing web-only installer. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-190533-0ffe38`. The backup manifest contains only `styles\custom.css` and `scripts\custom.js`, with previous hashes `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7` and `7BC4DD9E806CEBE4CA3EF54A7F3D219A9F4DE74A02029C8FB34A5CB995386B1A`. Current source, installed and served hashes match: CSS `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript `A96F44EBD56870BE403B4107311F6825D2A7B6C874F85498C6DD86E517D19DD3`. `/`, `/styles/custom.css` and `/scripts/custom.js` returned HTTP 200. MeshCentral, Cloudflared and Mesh Agent remain running; no server configuration, database, agents or tunnel changed.

All 62 Node contract tests, JavaScript syntax/bundle checks, and the Windows installer backup/rollback fixture passed before deployment. After deployment, Chromium again rendered the unauthenticated login at 390×844, 768×1024 and 1440×900 without overflow or page errors. A Chromium fixture loading the deployed bundle confirmed native Classic detection, disabled Night Shift CSS, the accessible “Modern UI” control, stale local preference removal and invocation of the native UI chooser, with no page errors. Actual authenticated dashboard/RDP and platform-device acceptance remain open.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-190533-0ffe38`.

## Legacy native mobile-input compatibility adapter

The PRN 1.3.1 `default3.handlebars` template predates the mobile keyboard and sticky-modifier hardening present in the Night Shift source template. To keep deployment inside the supported CSS/JavaScript customization mechanism, the overlay now feature-detects those native helpers after the page is parsed. For older templates only, it buffers soft-keyboard IME composition through the existing `onSoftKeyboardInput` handler, validates `SendKeyMsgKC` and all four numeric key actions before calling native modifier handlers, clears local held-key state safely when the transport cannot release, and surfaces clipboard promise rejection through the existing Night Shift status message. It does not replace the MeshCentral transport, routes or permission checks. Templates already carrying the enhanced native helpers are left unwrapped.

The focused Node compatibility fixtures cover legacy and enhanced handlers, committed Japanese input being delivered once through the native input function, unsupported modifier transport, initial dock refresh after capability detection, clipboard rejection feedback, and legacy touch cleanup/double-click behavior. A direct comparison against PRN's installed `default3.handlebars` found its touch-start/end handlers predate upstream commit `c747214` (`#8316`): it lacks `touchcancel`, drag release when a second finger lands or input permission is disabled, and the explicit native double-click event. Its `dmousemove` also predates upstream `58d3a691` (`#8324`) and clears the agent-provided remote cursor on every move. The compatibility adapter feature-detects those older handlers and delegates release/move/double-click through existing MeshCentral functions; templates containing the upstream fixes are left alone. These source tests do not establish authenticated RDP/Agent/AMT behavior or real-device touch acceptance.

Commit `1b11bcf6` adds the adapter to the CSS/JS customization bundle and is pushed to PR #3. It was installed on PRN with `scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -ReplaceExisting`. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-191939-d5ead2`; its manifest records only `styles\custom.css` and `scripts\custom.js`, with previous hashes `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7` and `A96F44EBD56870BE403B4107311F6825D2A7B6C874F85498C6DD86E517D19DD3`.

Post-install source, installed and loopback-served hashes match: CSS `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript `9536AE0BE81DFF2A17B7EC93144BF5576E7A80B55E0E9D8722F5143A5287C81C`. `/`, `/styles/custom.css` and `/scripts/custom.js` returned HTTP 200 and the root referenced both overrides. MeshCentral (`meshcentral.exe`), Mesh Agent, Cloudflared and MeshCentralCloudflared remained running. The installer modified only the two overrides; configuration, database, agents, tunnel and routes were not changed.

All 63 Node contract tests, bundle freshness and syntax checks passed, as did the Windows installer fixture including install/rollback. GitHub has no hosted run for commit `1b11bcf6`. The signed-in browser still cannot be inspected because the browser-control host and native pipe are unavailable, so authenticated UI and live RDP acceptance remain open.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-191939-d5ead2`.

## Capability-refresh follow-up deployment — 2026-11-05

Commit `1d556c52` refreshes the Night Shift dock after the compatibility adapter installs its stricter transport capability check. The refresh only runs when the native app container is present, so login pages and native Classic pages do not invoke app-only scheduling. All 63 Node tests passed, including login2 and Android viewport regression checks; the installer fixture passed all rollback cases.

Installed through `scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -ReplaceExisting`. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-192742-e9af5f`; its manifest contains only the two web overrides and records previous JavaScript SHA-256 `9536AE0BE81DFF2A17B7EC93144BF5576E7A80B55E0E9D8722F5143A5287C81C`. Current source, installed and served CSS hash is `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; current JavaScript hash is `50C19FD55CD5497AECEDFCBF840DA05731C1F8F8A491FD61E6F7E0A2433B3565`. Root and both override routes return HTTP 200. MeshCentral, Mesh Agent, Cloudflared and MeshCentralCloudflared remained running; no server data, configuration or Cloudflare resource changed.

PR #3 remains open/draft, with no hosted workflow run for the current head. The authenticated Chrome bridge remains unavailable, so this deployment is delivery-verified but authenticated UI and live remote-session acceptance remain open.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-192742-e9af5f`.

## Classic UI explanation follow-up — 2026-11-05

To make the interface-mode boundary clear when Night Shift cannot be active, the native Classic template now receives an inline-styled, safe-area-aware notice: “Night Shift is off in Classic UI. Choose Modern UI to use the Night Shift redesign.” Its button opens MeshCentral's existing interface selector; it does not change the account preference itself. The local Night Shift fallback retains its existing “Night Shift” return button. The feature is covered by tests for accessible status text, a narrow-viewport max-width and native chooser delegation.

This addresses the “no changes” case when the authenticated user is on Classic UI. Account mode remains unverified until the signed-in page is accessible; after choosing Modern UI, hard-refresh the page. Do not force `siteStyle` in PRN configuration because that would change the site-wide mode.

Commit `8884594b` was deployed to PRN with the existing override installer. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-193437-54e090`; the manifest contains only `styles\custom.css` and `scripts\custom.js`, with the previous JavaScript hash `50C19FD55CD5497AECEDFCBF840DA05731C1F8F8A491FD61E6F7E0A2433B3565`. Post-install source, installed and served hashes match: CSS `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript `F3A6F73B4BA1C43F53C7BF65A41823683FF346DD4277151A2F96BC3EB9F9F927`. Root and both asset routes return HTTP 200; MeshCentral, Mesh Agent, Cloudflared and MeshCentralCloudflared remain running. No configuration, database, agents, tunnel or route was changed.

The authenticated browser bridge remains unavailable, so the notice is verified by source tests and deployment bytes, but its appearance on the signed-in account has not been observed. Hard-refresh `rdp.treborygan.dev`; on Classic UI use the notice's **Choose Modern UI** button and select Modern in MeshCentral's native selector to activate the full redesign.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-193437-54e090`.

## Legacy mobile gesture compatibility deployment — 2026-11-05

Commit `f57de8bb67244e03538d870adf86831b997ff4ce` adds a narrow compatibility adapter for the older PRN MeshCentral 1.3.1 mobile touch handlers. It releases stuck remote drags on touch cancellation, second-finger gestures and permission loss; preserves native double-click input and agent cursor shapes while continuing to delegate movement to MeshCentral handlers. It activates only in the authenticated Modern app and does not replace templates or backend handlers.

Source verification: 64/64 Night Shift Node tests passed; bundle freshness, JavaScript syntax, `git diff --check`, Windows installer rollback fixtures and the pinned upstream reproducible security build passed. The pinned build remains a candidate and was not installed.

Installed through the existing web-only installer. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-195230-156ced`; the manifest records only `styles\custom.css` and `scripts\custom.js`, including the previous JS hash `F3A6F73B4BA1C43F53C7BF65A41823683FF346DD4277151A2F96BC3EB9F9F927`. CSS SHA-256 is `502839751482AC0E0773782B25F8A7CF7B6DFFA5BDC11EA2301FD8461FCBF6D7`; JavaScript SHA-256 is `A99DCB8143F9A43E06FD16172A8F18729E5EA5F4CECD85A82E6C3A6CBB138E47`. Installed and loopback-served asset hashes match; `/` and both assets return HTTP 200. MeshCentral, Mesh Agent, Cloudflared and MeshCentralCloudflared remain running. Configuration, database, agents, tunnel and routes were not changed.

GitHub Actions recovered for current head `f57de8bb67244e03538d870adf86831b997ff4ce`: Night Shift UI checks and PR CodeQL both completed successfully; the push-triggered Night Shift UI and CodeQL runs also completed successfully, including CodeQL analysis. PR #3 remains open/draft. Authenticated browser and live RDP/mobile device acceptance remain open because the browser-control bridge is unavailable.

Rollback command: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-195230-156ced`.

## Modern UI startup repair — 2026-11-05

The history search observer watched the page containing its own status text; rewriting unchanged status text could continuously trigger child-list mutations and make the authenticated browser unresponsive. The frontend now writes the status only when its value changes. A focused observer callback regression check and all 65 Node tests passed, as did bundle freshness and syntax checks.

Installed with the web-only installer. Rollback: `pwsh -NoProfile -File scripts/Install-NightShift.ps1 -MeshRoot C:\ProgramData\MeshCentral -RollbackFrom C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-233841-16b5c5`. Installed and locally served JavaScript SHA-256: `86C51278D6DE74CB391622428F0C75A10647800B0F2B024CD6AF181E8EAEBEDB`; HTTP 200 and all four services running. The previously hung browser remained unresponsive after installation, so authenticated verification in a fresh browser remains open.

## Temporary access recovery — 2026-11-05

After the observer change the authenticated page still appeared to hang. To prioritize access, the two Night Shift web overrides were restored to their pre-install state using snapshot `20261104-172151-f30fb4`; the packaged empty customization assets now return HTTP 200. The immediately preceding frontend files are preserved in snapshot `20261105-234325-3d9698`. Root returns HTTP 200 and all four services are running. Authenticated browser confirmation remains pending; the redesign must not be reinstalled until its startup is verified.

## Authenticated cache diagnosis — 2026-11-05

The signed-in native Modern interface loaded and displayed device controls after browser cache was bypassed. The previously loaded public `custom.js` came from browser disk cache with `Cache-Control: public, max-age=14400`; the zone browser cache TTL is 14400 seconds. The origin now serves empty original customization files with `max-age=0`. A targeted Cloudflare purge was issued for only the custom JS and CSS URLs. Existing browser caches require a hard refresh or expiry. The redesign remains disabled pending a verified startup repair; no zone-wide cache setting was changed.

## Modern UI hang repair and verified Night Shift reinstall — 2026-11-06

The loading hang was reproduced after forcing fresh overrides in an authenticated browser. The alerts module inserted its panel inside `p10info`, observed that subtree, and rewrote the permission guidance on each observer callback. This could perpetually generate child-list mutations. The module now updates permission text and panel visibility only when values change. A focused regression check covers this observer feedback path; all 66 Night Shift tests pass, the generated bundle is current, JavaScript syntax validation passes, and `git diff --check` passes.

Night Shift was reinstalled with `scripts/Install-NightShift.ps1`. Backup/rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-002856-a19b55`. Authenticated Modern UI at `https://rdp.treborygan.dev/?sitestyle=3` was hard-reloaded and rendered the Night Shift app bar, workspace overview, live native device inventory, shortcuts and mobile bottom navigation. The browser showed the native MeshCentral warning that both devices are currently offline, so live RDP input/transport could not be exercised. MeshCentral, Mesh Agent and MeshCentralCloudflared remained running; local asset routes return HTTP 200 and the installed JavaScript SHA-256 matches the source (`D2716B8F86BE8A42B5F20C91CFFF48A267F656847361A023CE098DA762D8801D`).

A host/path-scoped Cloudflare cache response rule prevents stale browser/CDN copies for only `rdp.treborygan.dev/scripts/custom.js` and `/styles/custom.css`; targeted purge was issued for those asset URLs. Rule set `8e7f225e156e4b549740eed7d674aa98` (`no-store`) does not change DNS, Access, tunnel or origin. Unauthenticated external asset requests still correctly redirect to Cloudflare Access; authenticated browser rendering is the verification source. Existing browser copies may require a hard refresh.

Rollback command:

```powershell
.\scripts\Install-NightShift.ps1 -MeshRoot 'C:\ProgramData\MeshCentral' -RollbackFrom 'C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-002856-a19b55'
```

Real device touch gestures, mobile keyboard input, zoom and live RDP remain unverified because the managed nodes were offline. Do not describe desktop or synthetic test coverage as physical-device acceptance.

## Startup observer audit and fresh-session responsive verification — 2026-11-06

To verify the source of the startup hang rather than credit the earlier history fix, the pre-fix PR head (`957760705b83a6ac067fda935c6a353c8a65337e`) was re-read: its alerts observer watched `p10info` with `childList`, `subtree` and `attributes`, while each callback assigned the same `permissionStatus.textContent` under that observed subtree. A new isolated DOM/MutationObserver regression fixture boots the actual alerts module against a `p10info`/`p10html2` Modern device-info fixture. The current writer settles after one observer callback; a regression variant using the pre-fix same-value text assignment re-enters until the fixture's 30-callback safety bound. The panel's hidden state is also updated only on changes.

The startup observer audit covered all 16 registrations across actions, alerts, capabilities, devices, diagnostics, both file observers, health, history, mobile controls, native compatibility, profiles, server administration, sessions, shell and viewer. The alerts status write was the observed-subtree feedback loop. Other observers either watch attributes only while writing children, observe native roots while writing to separate Night Shift nodes, use idempotent/guarded callbacks, or mutate only event listeners/row metadata outside their observed mutation type. The file upload observer's transfer status and list updates are guarded. No additional startup feedback loop was found in these paths.

A fresh authenticated in-app browser tab loaded Modern at `?sitestyle=3`, rendered the Night Shift shell, and navigated through the live device card to the native device details and desktop pages without starting a remote session. Network events for both `/styles/custom.css` and `/scripts/custom.js` show HTTP 200, `Cache-Control: public, max-age=0, no-store`, `CF-Cache-Status: BYPASS`, `fromDiskCache: false`, and `fromServiceWorker: false`. The browser reports no console errors. At the tested portrait viewport, the remote dock exposed trackpad, keyboard, right-click, zoom and special-key controls; at landscape it showed More/Less and the expanded secondary controls. Session-dependent input controls correctly stayed disabled because the managed device was offline. The browser viewport override was reset afterward.

The complete local suite now contains 67 tests, including the isolated startup observer reproduction. Live RDP input, connected-session zoom/fullscreen behavior, and physical Android/iOS touch and keyboard acceptance remain unverified until an agent-connected device and physical devices are available.

## Additional authenticated native-route smoke check — 2026-11-06

In the same fresh authenticated browser tab, native My Files, My Users, and My Server pages opened through the existing MeshCentral navigation. The files toolbar, permission-aware user list/actions, and server general/stats/console/trace sections rendered under Night Shift. No management action or data change was submitted. This verifies route reachability and presentation only; it does not qualify upload/download workflows, user/permission changes, server console operations, plugin behavior, or an active terminal session.

## Agent connectivity follow-up — 2026-11-06

A fresh authenticated inventory check shows both registered devices, PCRN and RN14PRO+, offline (2 loaded, 0 reachable, 2 offline). Native My Server statistics report zero Agent Sessions. The server console's `agentstats` counters are all zero and `agentissues` reports no issues; this means the server has no recorded agent handshake errors, not that the agents are connected. On PCRN, Windows reports the `Mesh Agent` service as Automatic/Running, but the process has no TCP connections and the supported `MeshAgent.exe -state` diagnostic says it cannot contact the service. A service restart could not be completed from this non-elevated session; Windows denied service control and the elevation attempt exited unsuccessfully. No agent files, settings, service configuration, MeshCentral configuration/database, or tunnel were changed.

The outstanding live RDP and physical-phone acceptance still needs an agent-connected managed device and a real Android or iOS browser. Do not infer agent connectivity from the Windows service state alone, or infer a healthy connection from the server's empty `agentissues` result.
