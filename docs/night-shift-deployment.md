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

A fresh authenticated inventory check shows both registered devices, PCRN and RN14PRO+, offline (2 loaded, 0 reachable, 2 offline). Native My Server statistics report zero Agent Sessions. The server console's `agentstats` counters are all zero and `agentissues` reports no issues; this means the server has no recorded agent handshake errors, not that the agents are connected. On PCRN, Windows reports the `Mesh Agent` service as Automatic/Running, but its process has no TCP connections and the supported `MeshAgent.exe -state` diagnostic says it cannot contact the service. Both `Restart-Service -Name 'Mesh Agent'` and the agent's own `MeshAgent.exe restart` failed with Windows access denied (error 5); the service remains running and a subsequent `-state` query still cannot contact it. Completing a restart requires an administrator-controlled service action on PCRN. No agent files, settings, service configuration, MeshCentral configuration/database, or tunnel were changed.

The outstanding live RDP and physical-phone acceptance still needs an agent-connected managed device and a real Android or iOS browser. Do not infer agent connectivity from the Windows service state alone, or infer a healthy connection from the server's empty `agentissues` result.

## Authenticated PCRN desktop session attempt — 2026-11-06

After the supported `meshagent64-Pcrn.exe -state` diagnostic reported its active connection to `wss://agent-rdp.treborygan.dev:443/agent.ashx`, a fresh authenticated Night Shift browser session showed one reachable device. Its native details page reported `Agent connected`, the active user `PCRN\Robert`, and Remote desktop available. This supersedes the prior inventory-only statement that the device was offline; it does not establish that a remote display session works.

On the device's native Desktop page, the browser reported Online, MeshCentral control channel Connected, and device route Agent. Clicking MeshAgent `Connect` and `Connect using profile` did not start a remote display: the page remained `Disconnected`, diagnostics showed no active remote session/display, and mobile trackpad, keyboard, right-click, zoom and special-key controls stayed disabled. Trying native Browser RDP opened the existing RDP Credentials dialog; it was canceled without entering or saving credentials. The page showed an existing Windows console session (`RDP-Tcp#0 - PCRN/Robert`, `Connected, Console`), but this did not become a browser desktop session.

Thus Night Shift startup, signed-in navigation, live agent inventory and native device details are now browser-verified. A connected browser desktop session, its touch/trackpad/keyboard/zoom/fullscreen interactions, and physical Android/iOS acceptance remain open. The remaining RDP path needs a successful MeshAgent desktop handshake or owner-provided RDP credentials entered directly into the native prompt; do not store credentials in the Night Shift profile or claim the input controls were live-tested.

## Authenticated connected-session mobile control check — 2026-11-06

This check supersedes the earlier disconnected-session result above. The PCRN Mesh Agent was actively connected, and the authenticated inventory showed it reachable. On the native Desktop route, selecting the existing `RDP-Tcp#0 - PCRN/Robert` session in MeshCentral's session chooser established the browser desktop session. MeshCentral reported `Connected, WebRTC`; the Night Shift session diagnostics showed the Agent route, connected MeshAgent desktop, and mounted remote canvas. No remote keystrokes, clipboard data, or power/file actions were sent. The session was disconnected at the end of the check.

With the connected session, the responsive dock's trackpad mode, right-click mode, on-screen keyboard visibility, fit/native zoom mode, and fullscreen state each toggled on and back off through their live native handlers. No keyboard text or special key was sent. In an emulated 854×395 CSS landscape viewport, More exposed the secondary controls. With MeshCentral's `is-mobile` class applied in the test page, fullscreen fit mode rendered the 1920×1080 remote display at about 702×395 CSS pixels; native mode exposed its full 1920×1080 surface for panning. The earlier 106×224 measurement came from a viewport test that did not activate the native `is-mobile` style path and is superseded by this correctly configured result.

The page's native touch handlers were exercised without enabling remote input: browser `TouchEvent`s dispatched to the canvas moved the viewer scroll offset by about 40×30 CSS pixels, and a two-point pinch changed the native zoom surface from 1920×1080 to 2880×1620. For the desktop browser emulation, the test page was given MeshCentral's `is-mobile` class and the native handlers were registered on the canvas; the input checkbox was disabled during the gesture checks and restored afterward. Trackpad, right-click and keyboard visibility controls were also toggled with the connected session. These checks exercise the native handler path but do not verify physical touch, keyboard/IME, native mobile listener registration, or orientation acceptance on Android/iOS. Browser RDP was not tested because its native credentials prompt was canceled without entering credentials.

A fresh authenticated browser tab at `?sitestyle=3` rendered the Night Shift workspace after the frontend install. Its `/styles/custom.css` request returned HTTP 200 with `Cache-Control: public, max-age=0, no-store` and `CF-Cache-Status: BYPASS`; the stylesheet and computed body font both showed the deployed Avenir Next / Segoe UI stack. The earlier open document still had its pre-update stylesheet in its CSSOM; the fresh tab confirmed new documents receive the installed asset. This verifies the targeted response rule and new-tab behavior, not physical-device cache behavior.

The same deployment also replaced the generic Inter-first stack with `Avenir Next`, `Segoe UI Variable`, and `Segoe UI` fallbacks after the design hook flagged Inter as overused. The web-only installer created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-100444-4e394b`; installed CSS and JS SHA-256 hashes matched source. MeshCentral, Mesh Agent and MeshCentralCloudflared remained running. This changed no server configuration, database, agent, tunnel, or service.

## Initial authenticated layout corrections deployment — 2026-11-06

This first layout-correction revision was installed using the existing web customization mechanism. Backup/rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-120640-f9f89d`. Source and installed SHA-256 values matched: CSS `AE9CA92FC58C50F618C871ACD1A5298362D08DB25CD0EA83E2EE96385435C0BD`; JavaScript `A7AC2C4961E73D9D1BD27D22F6A06985A3D99E647735776B5AB1FA306B4B9A26`.

MeshCentral, MeshCentralCloudflared, and Mesh Agent were Running before and after installation. No service restart occurred; MeshCentral backend, configuration, database, agents, Cloudflare Tunnel, and routes were not changed.

After a hard reload of the authenticated browser, the computed `#column_l` overflow-y was `auto`; Devices PageDown moved scroll position from 0 to 218 px and all inventory cards were reachable. On Server > General, action links stayed within their card and Memory text stayed within its card. The More menu dismissed on outside click and reported `aria-expanded=false`. These are live desktop-browser acceptance results at the reviewed viewport; physical Android/iOS acceptance remains open.

The native desktop Connect attempts reviewed with this first layout-correction revision left the page Disconnected with no active session/display. Device Details reported Agent connected / remote desktop available, while browser diagnostics showed the control channel Connected and route Agent. Those observations establish device/control-channel availability, not an active desktop session relay. A separate earlier browser check recorded connecting through the existing session chooser; the reviewed Connect attempt did not reproduce that result, so end-to-end remote desktop acceptance remains open. This is not evidence for a frontend presentation defect; the Night Shift changes preserve the native Connect handler. No backend or service diagnosis/change was made.

## Final Device Details column correction — 2026-11-06

A second backed-up web-override install corrected the Device Details key-column selectors to match the rendered `.row.mb-1` label/value columns. The final active backup snapshot is `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-121131-0a4ccc`; its manifest records the prior installed CSS hash `AE9CA92FC58C50F618C871ACD1A5298362D08DB25CD0EA83E2EE96385435C0BD` and JS hash `A7AC2C4961E73D9D1BD27D22F6A06985A3D99E647735776B5AB1FA306B4B9A26`. The earlier `20261106-120640-f9f89d` snapshot remains available for the previous install.

Final source and installed hashes match: CSS `4290A120587AC6508408CD1F44CB61D24F00EEE87AA1368C757E0211F32E2B0B`; JavaScript `A7AC2C4961E73D9D1BD27D22F6A06985A3D99E647735776B5AB1FA306B4B9A26`. After a hard reload, live Device Details labels rendered at 180 px, value columns at 338 px, and `#p10info` remained scrollable. These measurements verify the corrected desktop layout. Physical mobile acceptance and end-to-end remote desktop session acceptance remain open.

## Authenticated desktop session recheck — 2026-11-06

With PCRN reachable, the authenticated Night Shift inventory showed it as the sole reachable managed device. Native MeshAgent Connect transitioned from Connecting to Connected. Diagnostics reported the browser online, MeshCentral control channel connected, Agent route, and remote canvas mounted. The visible remote viewport remained uniformly dark/blank, including after MeshCentral's native Refresh desktop action. No remote keystrokes, clipboard data, commands, files, or power actions were sent. The acceptance session opened for this check was disconnected afterward.

The native Browser RDP Connect path opened its existing RDP Credentials dialog. It was canceled without entering or saving credentials, so Browser RDP remains untested. This confirms the Night Shift desktop route and native session controls can connect through MeshAgent, but it does not verify visible remote pixels or usable remote input. Physical Android/iOS acceptance remains with the owner and is still open.

The live loopback server returned HTTP 200 for `/styles/custom.css` and `/scripts/custom.js`; response-body SHA-256 hashes matched both working-tree files and the installed overrides (CSS `A8A06F0B0FD03F04FA5F33A87B40929429DC9985465E88CA3F575B8D27F24957`; JavaScript `A7AC2C4961E73D9D1BD27D22F6A06985A3D99E647735776B5AB1FA306B4B9A26`). Backup/rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-131013-727a0e` records the prior installed CSS and JavaScript hashes. MeshCentral, Mesh Agent and MeshCentralCloudflared were Running; no services were restarted and no server configuration, database, agent or Cloudflare resource was changed.

Focused source verification after the current layout edits passed: the generated script matches its modules, JavaScript syntax passes, `git diff --check` passes, and all 71 Night Shift tests pass. These checks do not close the blank-display or physical-phone acceptance gates.
## Pending desktop layout corrections — 2026-11-06

The Device Files and Console source corrections were installed using the existing backup-first customization mechanism. The pre-install rollback snapshot is `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-131013-727a0e`. After a hard reload, Registry actions visibly wrapped. Device Files still visually omitted Find/GoTo/Open, although the browser accessibility tree included all three controls; those actions are not yet accepted as visible/reachable. The Console Clear button could not be conclusively judged because the native console output height was changing during capture. Keep Device Files toolbar acceptance and Console footer acceptance open. No frontend release acceptance claim should be based on this partial check; preserve the snapshot for rollback.

## Mobile display and dock recheck — 2026-11-06

Read-only emulation at 904×407 CSS pixels (DPR 3) opened the native Desktop route, which reported “No active display session”; the backing canvas remained 300×150. No remote input was sent. This does not justify stretching the canvas: a blank/no-frame state is not a valid layout sample, and scaling it could distort native pointer coordinates. Mobile canvas streaming, gestures, keyboard and physical-device behavior remain open pending a real display frame and phone acceptance.

The narrow portrait dock had previously shown controls clipped beyond the viewport while its horizontal scrollbar was suppressed. The current PR #3 CSS adds a visible thin scrollbar under 430px while retaining touch swipe and all native controls. This source-only change is not installed. Since it changes CSS, the installed CSS hash documented above remains the earlier deployed hash; the current worktree must not be reported as matching installed assets until a future authorized install verifies new hashes. The mobile search/rail pointer navigation anomaly remains unconfirmed: emulated pointer attempts did not navigate, while keyboard Enter did; no change was made without physical or alternate-path reproduction.

PR #3 source-only follow-up also resets the shell and nested scroll positions on native route changes. The regression covers the reported Events inner offset and RDP route entry. This corrects the confirmed behavior in source but is not deployed; the installed hash above still refers to the previous CSS/JS pair.

## Consolidated route-audit source follow-up — 2026-11-06

This source-only follow-up addresses the latest authenticated review findings. The previous installed files remain unchanged at the recorded CSS/JS hashes above. Current uninstalled PR #3 source hashes: CSS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`; JS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

The 1441×900 live Stats check confirmed the overlap depended on retained scroll: entering Stats from scrolled Server General left `#column_l.scrollTop≈153`, placing `#p40title` at y290 over the canvas at y224. Activating the page Refresh reset the outer offset to 0; the title remained at y290 and the canvas moved to y361, with no overlap. This supersedes the earlier description that the sticky title alone caused the defect. The 184px sticky title rule contributed to the overlap while the route retained scroll; the source removes that sticky positioning and resets route scroll on entry. This source change is not deployed, so the live corrected state remains unverified. Other source-only corrections reflow the Events title/search/filter row, wrap Device Files actions inside their actual nested wrapper, and add appbar metadata/watchers for native routes through p60. The focused source suite passes.

The current mobile RDP evidence remains “No active display session” with a 300×150 backing canvas and no input sent. Do not stretch a no-frame placeholder. Console Clear visibility remains open; repeated device-console exceptions have no established CSS attribution; mobile command/rail click inconsistency was only observed in emulation and remains unconfirmed. No deployment, commit, push, service change, backend change, or remote input occurred.

Local final verification: generated bundle current, script syntax clean, focused suite 74/74 passing, and `git diff --check` clean. This is source-only; no production install or live-browser acceptance was performed.


The latest live evidence is route-scroll-dependent: Refresh removing the overlap confirms the route offset is material. The source fix combines the route reset with removal of the fixed sticky title; neither has been deployed or rechecked against this new 1441×900 case.

## Server Stats heading color follow-up — 2026-11-06

Post-deployment browser review at 944×1178 found the page geometry corrected: `#p40title` y192–241, controls y256, chart y325. The actual heading inherited `rgb(33,37,41)` and was nearly invisible on the dark canvas. Added a narrow source rule setting only `#p40title > .fs-4` to `var(--ns-foreground)` and a focused CSS assertion. It has not been installed; current source hashes are CSS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`, JS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`. No deployment or live recheck was performed for the color override.

## Appbar Events activation follow-up — 2026-11-06

After the first install, selecting More → Events on the live Server Stats page by pointer click and Enter left the route at `viewmode=40`. The native sidebar anchor was present. Source inspection confirmed that `default3.handlebars` binds `LeftMenuMyEvents` to `onclick=go(3,event)`, but the Night Shift appbar helper dispatched `mouseup`; this is a real source-level event mismatch. The isolated patch now invokes the original anchor's `.click()` method, with a bubbling native `click` event fallback, and tests that behavior against the Modern template. The updated script is not installed or live-verified. Current local JS SHA-256: `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`. No deployment was made for the pending Stats heading contrast patch or this navigation correction.

## Events title contrast follow-up — 2026-11-06

Live review after the first install at 944×1178 verified successful Events navigation and `#column_l.scrollTop=0`; title, search and filters fit. It also found a white `#p3title` background with inherited dark heading text (`rgb(33,37,41)`). The isolated source now assigns `--ns-canvas` to the title strip and `--ns-foreground` to the strip and its `.fs-4` heading. A focused regression checks both color tokens. This CSS fix is not deployed or live-verified. Current local CSS SHA-256 is `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`; the prior local JS hash remains `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

## Workspace breadcrumb live discrepancy — 2026-11-06

Mobile emulation at 904×407 now successfully navigates More → Events and resets the outer scroll. Clicking the Workspace breadcrumb (`button.ns-breadcrumb-link[aria-label="Open Devices"]`) from Events leaves the page on `viewmode=3`. In source, that breadcrumb is explicitly labeled “Open Devices” and calls `navigate(entries[0])`; the local shell regression exercises the resulting native Devices click handler and verifies return to the Devices route. The test passes, so this live-only failure is not explained by a source handler omission. Cause remains inconclusive; no workaround was added and no deploy was made.

## Events sticky overlap correction — 2026-11-06

At 1445×903 CSS with `#column_l.scrollTop=146`, live coordinates showed `#p3title` y45–110 and filters y114–158 under sticky `#ns-appbar` y66–170. At 944×1178, body carried `is-mobile`, and upstream `style-bootstrap.css` forced `body.is-mobile #p3title` to `position:relative!important; z-index:1!important`, defeating the original custom sticky rule. Source now applies `position:sticky!important; top:170px!important; z-index:69!important` with greater selector specificity inside the wide-screen media query; small-screen layout remains unchanged. Tests assert the conflicting upstream rule and the winning override. Not deployed or live-verified.

The upstream mobile title rule in `style-bootstrap.css` also assigns white backgrounds to My Users (`#p4title`), My Files (`#p5title`), My Server (`#p6title`), and My Server Tracing (`#p41title`). Custom CSS now scopes dark canvas and foreground overrides to those titles when Night Shift is active and the native `is-mobile` class is present. Contracts verify both the native conflict and custom declarations. These four per-route styles are source-confirmed but still need live visual review after installation.


Follow-up live retest showed the cascade now wins (`position:sticky`, z-index 69), but top 104px still placed title at y149 against appbar bottom y170. Source offsets are now calibrated to viewport coordinates: title top 170px (`appbar top 66 + height 104`), filter top 235px (title bottom plus 65px). A contract asserts both sums and declarations. This second offset correction is not deployed.

Live My Files (#p5) review with no file selected showed native disabled Rename/Delete/Edit/New Folder/Upload/Download/Cut/Copy/Paste buttons still rendered Bootstrap danger red. A narrowly scoped Night Shift rule now mutes fill, border, text, and shadow for natively `:disabled` danger/outline-danger actions in Files and Registry toolbars; it does not alter enabled danger buttons or native disabled state. CSS contract covers both states. Source-only; not deployed or live-rechecked.

## Final verified customization install and viewport acceptance — 2026-11-06

The latest install changed only the existing MeshCentral web customization files. Rollback backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-152556-17c9b1`. Installed files match source: CSS SHA-256 `2EBC832E87DB476A8C4CC72081F404041C28DBDEAB541FEE77F0B0A422D72FD4`; JavaScript SHA-256 `50D96923B39E9E2255097B8F1AD2F59270D790D7BF1F3CAF679E5AB4D099EA29`. No MeshCentral configuration, database, agent, tunnel, or service was modified or restarted.

After `Page.reload(ignoreCache)`, live review at 944×1178 CSS with `body.is-mobile` and `#column_l.scrollTop=146` showed `#ns-appbar` at y66–170, Events title at y216–280, and filters at y281–332; the title and filters no longer overlap the appbar. My Files (`#p5`) showed a dark title surface, and disabled native destructive/file actions had muted computed fill, border, and text colors. The file toolbar had no horizontal overflow. This live acceptance supersedes earlier notes that the Events offset correction and disabled-action styling were pending installation.

Mobile emulation at 904×407 CSS/DPR 3 and 390×844 CSS showed the dock controls visible without horizontal overflow. The remote canvas measured 0×0 even while the session showed connected; no remote input was sent. Physical handset checks for touch gestures, keyboard text/key delivery, and RDP display rendering remain open. This supersedes the earlier emulated 300×150 placeholder observation; no claim is made that a remote display frame was accepted.

## Mobile device-detail Desktop handoff follow-up — 2026-11-06

The 390×844 portrait and 904×407 landscape emulation initially showed the visible “Open native Desktop” action leaving `viewmode=10` with `#MainDevDesktop` still `style3x`. A later hit-test confirmed that the native Desktop tab itself was covered by fixed `#ns-mobile-nav`; its tap was therefore not a valid handler test. The quick action button was unobstructed (`#ns-device-actions` button center hit-tested to the button). A Playwright isolated-world check incorrectly reported `window.go` undefined; Chrome CDP main-world evaluation confirms both `window.go` and `go` are functions. Calling the quick action’s `.click()` from the main page world navigated to `viewmode=11`, set `#MainDevDesktop` to `style3sel`, and showed `#p11`. The installed native `onmouseup` handoff is therefore working in the main page world. This verifies programmatic main-world activation, not an actual touch gesture. Physical touch/keyboard delivery and the connected-session 0×0 canvas remain separate open acceptance items; no remote input was sent. No template bridge was retained.

## Latest Night Shift customization install and portrait live check — 2026-11-06

The PR #3 frontend follow-up was installed through the existing backup-first web customization mechanism. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-161157-b7f52e`. Installed CSS SHA-256 is `91795AF1DDFEAEB482AD2EB7A565CA12D481ED2E1A92E701844F431B3A428FC9`; installed JavaScript SHA-256 is `4423CA38DC0700BB208403D75736FD53540ED7CD22A27737F11B0160C4E291D4`. Both hashes match the current source files. The install changed only `styles/custom.css` and `scripts/custom.js`. MeshCentral, Mesh Agent, Cloudflared, and MeshCentralCloudflared were not modified or restarted; no MeshCentral configuration, database, agent, or tunnel state was changed.

Live portrait-equivalent review at 244×542 CSS pixels (DPR 5; 1220×2710 physical-equivalent) found `#column_l` and the document both 244px wide with matching scroll widths, so there was no horizontal overflow. `#column_l` had 2576px scroll height and reached scrollTop 1627.5. The appbar computed to `position: relative`, beginning at y107.99 after the native tabs/masthead; the native device toolbar was later in normal flow at page y1211–1539. At the captured scrolled position the appbar was at y−1519, the toolbar at y−416, and the inventory began at y−70.8. The appbar therefore no longer overlays page controls while scrolling. This is browser-emulated portrait evidence, not physical handset acceptance.

During the authenticated remote desktop check, the native MeshCentral session connected and was then disconnected. The remote canvas remained blank/0×0, so no display interaction was accepted. No remote keystrokes, clipboard content, or commands were sent. Physical touch/gesture and keyboard acceptance remains open. This install supersedes the preceding `20261106-152556-17c9b1` deployment snapshot and its CSS/JS hashes as the current installed state; that earlier snapshot and its history remain preserved above.

## Pending desktop layout review — 2026-11-06

After that deployment, live desktop review found three additional layout defects: the Server Stats title could finish scrolling beneath the appbar at 1440×901; Events sticky title/filters covered rows in its independently scrolling list at 1024×768; and a Bootstrap `.row` with negative side margins inside `#p2meshes` produced an 8px horizontal overflow in Account at 1024px. A source-only CSS follow-up now positions the Server Stats title below the appbar with chart clearance, returns the wide Events route to outer workspace scrolling, and constrains only the offending group row. The 78-test focused suite and `git diff --check` pass. This patch has not been installed, and the prior snapshot `20261106-161157-b7f52e` and its hashes remain the current production state until parent review, live verification, and a later authorized install. No native notifications, handlers, backend, services, agents, database, configuration, or tunnel were changed.

This source pair was installed through the existing backup-first CSS/JS customization mechanism. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-154124-357964`; its manifest records the prior hashes and contains only the two web overrides. Installed CSS SHA-256: `2EBC832E87DB476A8C4CC72081F404041C28DBDEAB541FEE77F0B0A422D72FD4`; installed JS SHA-256: `BD4CCF7F8A00DE98FF581C568E937CE784ACD4C678646E2D37548502C795B643`. MeshCentral, Mesh Agent, Cloudflared and MeshCentralCloudflared remained running; no service, configuration, database, agent or tunnel changed.

## Latest verified install and portrait RDP layout — 2026-11-06

The latest source pair was installed with `scripts/Install-NightShift.ps1` using the existing backup-first web customization path. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-164301-a55fee`. The install touched only `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js`. Installed and source SHA-256 values match: CSS `736F24DEBD1483545DF1CCA426AB0EC477CDC20AB1EFBD66C913DE281C8D1FE5`; JavaScript `1683AF98499CA518FF715577BCD636F4C09061EAB5489783B48E73311C415301`. The previous installed pair is preserved in snapshot `20261106-163842-b62c7e`.

The final focused verification passed: generated bundle check, 79/79 `tests/night-shift.test.cjs` tests, and `git diff --check`. MeshCentral configuration, database, agents, Cloudflare/Tunnel routing and services were not modified or restarted. Cloudflared, meshcentral.exe, and MeshCentralCloudflared were Running after installation. No service restart was needed for the override files to load.

At the user's corrected primary target, Redmi Note 14 Pro+ portrait 1220×2712, the browser emulation used 244×542 CSS pixels at DPR 5 (1220×2710 physical-equivalent, two pixels shorter due to integer viewport sizing). The remote workspace now places the native viewer after its title/session strip, before diagnostics and profile settings. The document remained 244px wide with no horizontal overflow. The profile and diagnostics remain in the scrollable page. A 542×244 CSS/DPR 5 landscape-equivalent view also had no horizontal overflow; the dock fit its primary actions and kept secondary actions behind the More control. These are browser emulation results, not physical Redmi Note 14 Pro+ acceptance.

Live desktop Stats review at 944×1178 CSS, at the outer workspace scroll limit, measured the appbar bottom at y180.87, title from y181.97 to y235.11, and chart top at y240.91. The title cleared the appbar and retained roughly 6px before the chart. Live portrait testing also exercised the “Show native connection controls” diagnostics action after the guard fix; it raised no new console error.

Remote-session acceptance is still open. In the authenticated live view, the control channel and Agent route reported connected, while the native viewer remained Disconnected with no active session/display. The remote image was blank and no remote keys, clipboard contents, commands or power actions were sent. The in-app browser could not provide reliable physical touch input; trackpad gestures, on-screen keyboard delivery, zoom, fullscreen and actual handset rendering remain for physical phone acceptance. This entry supersedes earlier “pending desktop layout” and prior install/hash statements as the current deployment record.

## Portrait follow-up deployment and live asset verification — 2026-11-06

After fixing the portrait file action states, remote touch dock wrapping, server illustration scale, title backing, and device subtab scroll wrapper, the updated web overrides were installed with `scripts/Install-NightShift.ps1`. The latest rollback snapshot is `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-171329-a0dedb`; it preserves the prior web override files. The customization install updates only `public/styles/custom.css` and `public/scripts/custom.js`. MeshCentral configuration, database, agents, Cloudflare/Tunnel infrastructure, and services were left untouched.

At 407×904 CSS pixels / DPR 3, the live Device Files page has document and body widths of 407px, device subtab scroller width of 343px with 644px of scrollable tabs, and visible accessible Scroll left/Scroll right controls. The disabled Delete action is muted (`rgb(145, 160, 168)` on `rgb(38, 49, 57)`). The appbar title surface matches the dark canvas. Earlier live portrait capture after the dock change showed every remote touch control within the viewport. Server image/card spacing was also checked live without overlap.

Source and installed hashes match the assets fetched from the live site: CSS `B6CA601319BBB5AADB9E10E28A7AC2C3FC22B23928107484551A69988148505E`; JavaScript `1683AF98499CA518FF715577BCD636F4C09061EAB5489783B48E73311C415301`. Live responses were HTTP 200, `Cache-Control: public, max-age=0, no-store`, and Cloudflare `BYPASS`. The 80/80 focused Node tests, bundle check, and `git diff --check` pass. These results are responsive browser emulation at the Redmi portrait equivalent, not physical handset acceptance. Remote display remained waiting for user consent; live touch/trackpad delivery, keyboard, zoom, and fullscreen remain unverified.

## PR3 desktop and Redmi viewport follow-up — 2026-11-06

The follow-up was installed on PCRN through `scripts/Install-NightShift.ps1` at 2026-11-06 17:39 local time. The new rollback snapshot is `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-173949-1cad22`; its manifest records the previous CSS and JS hashes. Only `meshcentral-web\public\styles\custom.css` and `meshcentral-web\public\scripts\custom.js` changed. Installed files exactly match the checkout: CSS `1FFD9381B6A35B47DFD892698BF28F198A63E1A8941A60702D486E07227B1619`; JavaScript `BAFD9F01045448D44DB86FF1BE1E7D9DFC9833C90BADA6057C84DF0955FC0D95`. Direct local MeshCentral asset responses returned HTTP 200 and matched these hashes. `meshcentral.exe` and Cloudflared remained running; no restart was needed. MeshCentral configuration, database, agents, Cloudflare routes, and service settings were unchanged.

Verification passed: `node --check public/scripts/custom.js`, `node scripts/build-night-shift.js --check`, `node --test tests/night-shift.test.cjs` (84/84), and `git diff --check`. Authenticated browser checks after a cache-bypassing reload included:

- Redmi portrait-equivalent 407×904 CSS px at DPR 3: Software page document/body/workspace widths all 407px; toolbar is 375px and its controls wrap within the viewport. The native Software status still displayed its loading message, so installed-app enumeration is not accepted by this layout check.
- Users page: the native settings glyph reports `role=button`, accessible name “User list settings”, `tabIndex=0`, and a 44×44px target. Enter opened the native Users View dialog; cancel closed it without changes.
- Device Console at 1440×900: document stayed 1440px wide; console `<pre>` stayed within the 1305px cell and retained its own horizontal scroll (`overflow-x:auto`).
- Phone-landscape-equivalent 904×407 CSS px at DPR 3 with coarse-pointer emulation: the mobile dock appeared at the bottom (904×45px), its visible primary controls fit within x=8..897 with 36px heights, and the document stayed 904px wide. A remote session was not active, so session-dependent controls stayed disabled.

The authenticated session reported its MeshCentral control channel and Agent route connected, but no active remote session or remote display after the native and dock Connect actions. No remote keys, clipboard data, commands, or power actions were sent. This is responsive browser emulation, not a physical Redmi test. Touch gesture delivery, on-screen keyboard input, connected-session zoom/fullscreen, active RDP pixels, and physical-device rotation remain open acceptance items. The earlier Software loading state also remains a live native behavior to investigate separately from the verified CSS overflow correction.

## PR3 portrait remote-control and Software recovery patch — 2026-11-06

The verified frontend patch (`cc0da783`) was installed through `scripts/Install-NightShift.ps1` on 2026-11-06. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-181807-0219e0`. Only `meshcentral-web\public\styles\custom.css` and `meshcentral-web\public\scripts\custom.js` were replaced. Source and installed raw SHA-256 values match: CSS `80A3CCA861655C0EA54D3A6F9DED4F4C6E645DB1ADAA24F705C10E12C5483C26`, JavaScript `22431EA0F8A78902CFA0D5D90052166B4E6B619E144D2A1990C26D213319C5A9`. MeshCentral and Cloudflared remained running; no restart or configuration, database, agent, tunnel, or permission changes were made.

Verification passed: 86/86 focused Node tests, generated bundle check, JavaScript syntax check, and `git diff --check`. At 407×904 CSS px, DPR 3, coarse-pointer emulation (the 1220×2712 Redmi Note 14 Pro+ physical-pixel target), a cache-bypass reload applied the new portrait rules. The native `#deskarea4` footer measured 374px client/scroll width and `#deskarea4Icons` measured 358px client/scroll width; the document and body remained 407px wide. This confirms the two overflowing native footer rows now fit in the portrait workspace. The page could not maintain a remote display after the later connection attempt: the native status changed to connected but the canvas stayed 0×0, so touch/trackpad input, keyboard delivery, zoom, fullscreen, active RDP pixels, and real-device rotation remain unverified. No physical Redmi handset was available. The Software timeout behavior is covered by source regression tests but was not exercised in the live page.

## PR3 desktop audit fixes — 2026-11-06

Installed the verified desktop audit fixes through `scripts/Install-NightShift.ps1` with the existing customization mechanism. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-192919-07f4c0`. The manifest confirms both prior CSS/JS overrides existed. Only `custom.css` and `custom.js` in `meshcentral-web\public` were replaced; normalized installed bytes match the current source. Local HTTP returned 200 for both assets and their response bytes exactly matched the installed files. The raw installed SHA-256 values are CSS `2832AB91B65F1531F0A558F627D786C88EF968F29611E6458B7D924C5935734D` and JavaScript `22431EA0F8A78902CFA0D5D90052166B4E6B619E144D2A1990C26D213319C5A9`.

MeshCentral and MeshCentralCloudflared remained running. No restart, config, database, agent, tunnel, permission, or network change occurred. At the authenticated 1148×505 browser screenshot size, live retests passed for the Server General Memory/Server State scroll, muted disabled Users action, reachable More-menu Classic UI action through internal scrolling, and sticky Device Console title while scrolling. The source suite passed 91/91 tests with the bundle check, JavaScript syntax check and `git diff --check`. Redmi portrait and live remote-session acceptance remain open.

## Device Details refresh feedback installation — 2026-11-06

The source-tested native Device → Details refresh feedback was installed through `scripts/Install-NightShift.ps1`. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-195356-b9be0d`. Only `custom.css` and `custom.js` were replaced. Source and installed SHA-256 values match: CSS `0FD8B088EC4CA6F407C9F0AF0CB76008EFE782EFE1FB02EAD06C8D7C3C5484FC`, JavaScript `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501`. Loopback HTTP with the production Host header returned 200 for both assets and the response bytes match these hashes. MeshCentral and MeshCentralCloudflared remain running; no restart, configuration, database, agent, tunnel, permission or network change occurred.

Verification passed before installation: `node scripts/build-night-shift.js --check`, `node --check public/scripts/custom.js`, `node --test tests/night-shift.test.cjs` (92/92), and `git diff --check`. The live authenticated browser showed the portrait mobile remote dock and a connected PCRN session, but the remote canvas still says “Waiting for user to grant access…”. The new Details refresh status has not yet been visually checked after installation; live touch/trackpad, keyboard delivery, zoom, fullscreen, landscape rotation and physical Redmi acceptance remain open.

## Approved Concept B typography correction — 2026-11-06

Restored the approved Concept B font stack (`Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif`) after review found the deployed Avenir-first stack came from an unapproved typography change. No font download or remote import was introduced. Installed through `scripts/Install-NightShift.ps1`; rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-200601-25becc`. Only the CSS/JS override files were copied; the JS bundle content was unchanged. Source, installed and loopback HTTP response hashes match: CSS `EA99F83CF2409408A1ABE724D6F8752AE172FB3DE54F9F6D41A31FAB13F9CE59`, JS `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501`; both asset routes returned HTTP 200. MeshCentral and Cloudflared remain running with no restart or server configuration, database, agent, tunnel or permission changes.

Verification passed before installation: the approved-concept typography regression, bundle check, JavaScript syntax check, `node --test tests/night-shift.test.cjs` (93/93), and `git diff --check`. A hard-refresh visual font check remains pending.

## Landscape tab scroller installed — 2026-11-06

- The standard installer ran after a successful `-WhatIf`, against `C:\ProgramData\MeshCentral`.
- Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-202234-9d6d7b`.
- Only `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js` were replaced. Source, installed and loopback HTTP response hashes match. CSS SHA-256: `A4B1721B6EBE46C121862AEC4B55D5B9ED4900DFB9A004E7A365785D40DF968E`; JS SHA-256: `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501`. Both asset routes returned HTTP 200.
- MeshCentral, MeshCentralCloudflared and Mesh Agent remain running. No service restart, config/database/agent/tunnel change, or permission change was made.
- Pixel 10 Chrome emulation at 412×924 CSS px portrait reloaded the authenticated Remote Desktop route and showed the mobile dock. The remote session remained disconnected; trackpad, keyboard, zoom and fullscreen actions were disabled. The 904×407 landscape responsive viewport was configured, but coarse-pointer landscape tab scrolling was not independently demonstrated. Physical Redmi and live remote input acceptance remain open.

## Corrected desktop and mobile layout install — 2026-11-06

The corrected source pair was installed through the existing web customization mechanism. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-212010-87c929`. This supersedes the earlier 21:14:45 (`211445`) install attempt; use the 21:20:10 snapshot as the current rollback point. Normalized source, installed, and served asset SHA-256 values match: CSS `CEC5B527570C4367C48CA07236D051FE77B509BC6026CE245C5C72AC0B9081C2`; JavaScript `8B8A1C09806579293500EE0E724592C919C186B302017D30831EFC6E14E235EB`. Both live asset routes returned HTTP 200.

Authenticated live acceptance passed at 1440×900 desktop: inventory cards and Device General authorization content remained reachable. Mobile browser emulation was checked at 440×977 portrait and 977×440 landscape. At 977×440, the corrected floating viewer controls computed to `bottom:110px`, with bounds y=274.54–330.13; the fixed dock began at y=361.55, leaving 31.4px clearance. The document had no horizontal overflow. Console title contrast was corrected in both mobile orientations.

MeshCentral, MeshCentralCloudflared, and Mesh Agent stayed Running. No service restart, configuration, database, agent, tunnel, or infrastructure change was made. The remote display remained inactive/disconnected, so touch and keyboard delivery, zoom/fullscreen operation, and physical Redmi Note 14 Pro+ acceptance remain unverified.

## PR #4 install and authenticated-browser recheck — 2026-11-09

A read-only comparison against `fix/night-shift-session-tab-fallback` found that the installed CSS matches the PR source (raw SHA-256 `7C07E17FD6913E3BACE68EA05A4840565BEA629F26C359BBC0083067E94AF67C`). The PR source JavaScript is `9680E30DEEB34510DC4CEDAA7855EE761FC1462ADD96A002E3D591088F65CC0A`; the installed JavaScript remains `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501`, and CRLF-normalized contents differ. The PR #4 session-tab and blank-display diagnostics changes are therefore not installed on PRN. No install, service restart, or production change was performed.

At the time of this comparison, the available Chrome Work profile redirected to Cloudflare Access sign-in, so those live checks were deferred. The later authenticated-browser recheck is recorded below.

## Authenticated browser acceptance recheck — 2026-11-09

The signed-in browser loaded the Night Shift Devices page and its live native inventory (three devices, one reachable and two offline). Opening the reachable PCRN Device Details route and its Details subtab succeeded. Clicking Refresh details information produced no accessible pending/response message during the captured review; after a 13-second wait, the accessible Last details update value was still `11/9/2026, 3:54:47 AM`, and the “No device details response yet” retry hint was not visible. Treat the feedback sequence as not accepted live; the review did not establish whether the native refresh response arrived. The PR4 source and installed JavaScript hashes differ, so the browser session did not establish the PR4 asset state.

The native Server route opened successfully, and its Console subtab rendered `Console - My Server Console` with a scrollable console pane. The pane was blank in the captured view. No command was entered, no console output was cleared, and no remote Desktop session was started. This browser review did not emulate the requested 904×407 landscape viewport or use the physical Redmi handset. RDP input/display and physical-device acceptance therefore remain open.

PR #4 remains open and draft at `186f732192e7f65d61f8ac823bffa7f8e28693ff`. GitHub reports the Night Shift UI checks run 84 and CodeQL run 131 successful for this head. No production install, service restart, or infrastructure change was made.

## Hosted checks and served-asset follow-up — 2026-11-09

After the acceptance notes were pushed, PR #4 advanced to `542c752a0179ded5d0a5bbea6c167ba00e3f8147`. Night Shift UI checks run 85 and CodeQL run 133 both completed successfully. A fresh loopback HTTP request with the production Host header returned 200 for `scripts/custom.js` (194,802 bytes; SHA-256 `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501`) and `styles/custom.css` (128,362 bytes; SHA-256 `7C07E17FD6913E3BACE68EA05A4840565BEA629F26C359BBC0083067E94AF67C`). These response hashes match the installed overrides; the installed JavaScript contains the refresh-feedback code. The PR source JavaScript remains `9680E30DEEB34510DC4CEDAA7855EE761FC1462ADD96A002E3D591088F65CC0A`, so PR4's newer session/diagnostic changes are still not installed.

The authenticated browser continued to show no Device Details refresh status after another direct refresh click. Computer Use then stopped the UI session because it could not establish the current browser URL with enough confidence for policy enforcement. Therefore a cache-bypass reload and runtime wiring diagnosis were not completed; the loopback hash verifies what the server serves, not what the already-open browser had cached. No install or service action was performed.

## Refresh feedback toolbar replacement coverage — 2026-11-09

The refresh feedback source now keeps its direct native-button listener and adds a document-level delegated fallback for a later replacement button. The feedback logic remains tied to the active native device and native `updateDeviceDetails` response; `refreshDetails()` and the MeshCentral toolbar handler are not replaced. `public/scripts/custom.js` was regenerated from the modular source. This addresses the case where route navigation replaces a button after the one-time health-module boot. CI and an authenticated cache-bypassed browser retest are pending; no production files or services were changed.

## PR4 frontend override installation — 2026-11-09

After current-head Night Shift UI checks (run 87) and CodeQL (run 137) passed at source commit `f3769efe5ca666bac13782f957c7fb6a5e6612fe`, the web-only override installer copied the verified branch CSS/JS to PRN. Rollback snapshot: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261109-140057-f8c7ec`. The manifest records the previous JavaScript hash `D613CB27E49F63EB8CA72785480E9EF575E1B77B8AE1605360FB41FBCBCB2501` and previous CSS hash `7C07E17FD6913E3BACE68EA05A4840565BEA629F26C359BBC0083067E94AF67C`.

The installed and loopback-served files match the source: JavaScript SHA-256 `C7CC0AC74BC256D6D418DAA0039C14B416627C9DB71364C48649EDBB24335F0A` (196,131 bytes) and CSS SHA-256 `7C07E17FD6913E3BACE68EA05A4840565BEA629F26C359BBC0083067E94AF67C` (128,362 bytes); both asset routes returned HTTP 200. Only the existing `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js` overrides changed. `Cloudflared`, `meshcentral.exe`, and `MeshCentralCloudflared` remained Running; no service restart, configuration, database, agent, tunnel, or permission change occurred. The authenticated browser still needs a cache-bypassing reload and live Device Details refresh retest. The Computer Use URL-confidence stop remains in effect for this session; production HTTP delivery is verified, browser application of the new bytes is not.
