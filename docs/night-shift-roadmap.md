# Night Shift roadmap

Scope: modernize `treborygan/MeshCentral` while retaining native MeshCentral handlers, permissions, transports, and security boundaries. The implementation remains a reversible web override; it must not change PRN configuration, agents, certificates, database, services, or Cloudflare ingress.

Status labels: **Done** means source and the stated verification exist; it does not imply live acceptance. **Pending** means implementation or the required acceptance evidence is missing. **Blocked** means a concrete external dependency prevents work.

## Phase 1 — complete Night Shift UI V2

- [x] Navy/green tokens, responsive shell and current Night Shift styling layers.
- [x] Contextual appbar, native navigation search, permission-filtered More menu, and live-data dashboard.
- [x] Responsive live inventory with card/table/compact layouts, native device-tag chips and filtering, search, sorting, favorites, connection filters, native bulk-selection/group actions, and native-list fallback.
- [x] Login2 activation, Android viewport correction, touch dock, keyboard focus and reduced-motion support.
- [x] Carry the installed mobile-usability rules into source: contained masthead, compact account control, viewport-bound menu, and non-overflowing appbar/cards/navigation.
- [x] Fix mobile masthead horizontal overflow and account-area clipping using viewport-contained, safe-area-aware sizing.
- [ ] Match the approved Concept B across authenticated dashboard, inventory, groups, users, settings, administration, dialogs and detail screens; compare screenshots at phone, tablet and desktop sizes.
- [ ] Complete and verify the remote-session-first viewer, floating/auto-hide controls, information drawer and fullscreen layouts.
- [ ] Verify touch, trackpad, zoom, keyboard modifiers and monitor selection on real Android and iOS devices.
- [ ] Verify keyboard-only navigation, contrast, focus visibility, feedback and loading/empty/error states across major screens.
- [ ] Verify a clear, usable Classic UI fallback on the installed server.

## Phase 2 — remote-access workspace

- [x] Current session strip reflects native MeshCentral connection controls; mobile dock delegates to native desktop/RDP handlers.
- [x] Favorites control and inventory filter reuse MeshCentral's native `stars` preference and 200-device limit; no parallel storage or account identity key is introduced.
- [x] Persistent tabs for existing MeshCentral multi-desktop sessions, with switching through native `gotoDevice()` and disconnect through rights-checked `toggleKvmDevice()`; tabs survive in-app navigation for the lifetime of the native sessions.
- [x] Event-driven client diagnostics for browser connectivity, MeshCentral control channel, Agent/AMT route, native remote-session transport/state and display canvas, with a shortcut to native connection controls. Cloudflare Access/tunnel health is explicitly shown as not observable after page load.
- [x] Account- and device-scoped connection profiles store method, monitor, scaling, quality, native/remote keyboard map and fullscreen preference only. Apply/Connect uses native connection and display APIs; unsupported RDP/AMT settings remain on native controls, and fullscreen is applied from the explicit user gesture.
- [x] Account-scoped recent-device list, limited to eight IDs/timestamps; opening an entry returns through native MeshCentral navigation and permissions.
- [x] Quick launch from Recent/Favorites and safe reconnection by routing through native `gotoDevice()` and exposing MeshCentral's existing Connect controls; tabs never auto-connect or bypass permissions.
- [x] Touch dock exposes local/remote clipboard transfer, text entry, common shortcuts and selected special-key sending through native MeshCentral handlers. The keyboard map preference is per device and uses native/remote mapping modes.
- [ ] Verify clipboard permissions, international input layouts, shortcuts and mobile controls against real Agent, RDP and AMT sessions.
- [ ] Verify connection-state transitions and permission-preserving unavailable/error states.

## Phase 3 — device management and power tools

- [ ] Split-pane file manager with drag/drop, bulk transfers, queue/progress, checksums and only backend-supported retry/resume. (Responsive inspector, local filter and drag/drop now feed the native file page. Native upload already queues multiple files, reports progress, and uses server hash negotiation for resumable uploads when supported. Unified transfer queue/retry and equivalent download progress remain pending.)
- [ ] Live health panels for CPU, memory, storage, uptime, agent status and available system information. (Health summary shows CPU/memory values and threshold alerts from native graph updates while the graph is open; no extra telemetry polling. Live/authenticated acceptance pending.)
- [ ] Searchable activity/session history and native recording access. (Local search added to loaded native Events and recordings; expanded history workflows and live acceptance remain pending.)
- [ ] Permission-gated quick actions and reusable audited commands. (Device Details shortcuts now expose native power actions and the native configured-command picker when MeshCentral rights and connection state allow; live acceptance remains pending.)
- [x] Wake-on-LAN/Intel AMT power controls where supported are exposed through MeshCentral's rights-checked native action dialog; authenticated device acceptance remains pending.
- [x] Clear unavailable states for native Desktop, Terminal, Files and AMT tabs in Device Details; current capability display follows MeshCentral's permission and device-support visibility gates. Authenticated role/agent acceptance remains pending.

## Phase 4 — advanced functionality

- [ ] Configurable health/connection alerts with deduplication and quiet hours. (Opt-in current-device connection, CPU/memory and Windows volume free-space thresholds, per-device quiet hours, and per-key five-minute deduplication are implemented; background multi-device monitoring remains pending.)
- [ ] Scheduled administration using existing MeshCentral mechanisms. (No native scheduled device-action mechanism was found in the current UI/API command paths reviewed. Do not emulate durable scheduling with browser timers; use the existing manual native actions until a supported server scheduler is identified.)
- [ ] Secure installable mobile PWA behavior. (Accessible install prompt added when the browser offers `beforeinstallprompt`; manifest and worker remain MeshCentral-native. No offline shell is claimed because the native worker only handles push notifications.)
- [ ] Optional modular integrations and monitoring extensions.

## Security, architecture and release gates

- [x] Keep authentication, permissions, consent, guest sharing, recording, 2FA, native transports and Cloudflare boundaries in MeshCentral.
- [x] Use the persistent `custom.css`/`custom.js` extension points and backup-manifest installer; rollback path is documented.
- [x] Split JavaScript into focused mobile-controls, shell, devices, diagnostics, sessions, profiles, health, history, files, actions, alerts, PWA and capabilities components; regenerate the single deployable `custom.js` bundle and include bundle validation in the CI workflow.
- [x] Current automated source checks: `node scripts/build-night-shift.js --check`, `node --check public/scripts/custom.js` and `node --test tests/night-shift.test.cjs` (22 tests).
- [x] Review current upstream security-fix ancestry and compatibility: the PR branch includes the reviewed 1.3.1 fixes; source changes remain limited to web overrides.
- [ ] Verify the exact installed PRN source revision and confirm those upstream fixes are present before release.
- [ ] Complete authenticated workflows for admin and restricted roles, Agent desktop, browser RDP, terminal, files, reconnect, guest, recordings, AMT and plugins.
- [ ] Complete screenshot comparison and live physical-device checks; keep the PR draft until these pass.
- [x] Recheck the installed asset and rollback hashes for the 2026-11-05 mobile masthead update; verify the running asset revision over the local HTTP listener.
- [ ] Repeat authenticated visual review at 390×844 and on physical phones; the browser-control host was unavailable during this session.

## Current evidence and blockers

- Source branch: `feature/night-shift-structural`, based on the MeshCentral 1.3.1 fork. PR #3 is open and draft.
- The modular script build, Cards/Table/Compact inventory, diagnostics, multi-session tabs and per-device profiles are source-only and have not been deployed.
- Event-driven diagnostics are source-only. They do not poll, inspect tunnel health after authentication, or replace MeshCentral connection controls; authenticated visual acceptance is pending.
- Multi-session tabs are source-only and display existing MeshCentral `multiDesktop` sessions; switching and closing use native permission-aware handlers. They do not open additional transports or persist session content.
- Per-device profiles are source-only and store only an allow-listed preference object under account/device-specific browser storage. Agent quality/scaling/keyboard map use the native desktop object; monitor and fullscreen use native display/viewer controls. RDP/AMT expose only the settings supported by their native objects, with unavailable settings reported rather than simulated.
- Device health summary is source-only and reads MeshCentral's cached native Device Details for connection state, last boot, OS description and Windows volume size/free values. It reads only whitelisted volume fields and never exposes BitLocker metadata. CPU/memory percentages are displayed from native graph sample updates only while the user opens MeshCentral's graph, then return to Unavailable when the graph closes; a narrow wrapper around that chart's update method emits sample events, with no new telemetry polling. Non-Windows storage and absent values display Unavailable. Authenticated device/role acceptance remains pending.
- Events and recordings search is source-only and filters only rows already rendered by native MeshCentral views. It does not expand server queries, alter permission checks, or replace native recording download/playback actions. Search resets are local to the page lifetime; full historical indexing and authenticated acceptance remain pending.
- Device Files has a source-only responsive split pane with selected-item metadata and current-folder name/type filtering. Download, rename and delete buttons delegate to existing native controls and mirror their disabled state. Drag/drop, batch queue/progress, checksums and retry/resume are not claimed; native transfer behavior remains in place. Live acceptance is pending.
- File drag/drop is wired to MeshCentral's native upload entrypoint and only activates while its native upload button is enabled; native overwrite confirmation, multi-file sequential queue, progress, SHA-384 hash negotiation and server-supported resume remain intact. The UI does not invent resume when negotiation or file support is absent. A unified transfer queue, retry controls and enhanced download progress remain pending.
- Device Details has source-only power and command shortcuts whose availability mirrors MeshCentral device rights and connection requirements. Power actions open the native confirmation/audit dialog; configured commands open MeshCentral's native `runDeviceCmd()` picker, which dispatches through the existing audited run-command path. No custom command transport or persistence is added. Live acceptance is pending.
- Connection, CPU/memory and Windows storage alerts are source-only and opt-in per device. Preferences use the authenticated account's existing MeshCentral web-state path; each repeated status/threshold key is deduplicated for five minutes and local quiet hours are supported. Browser notification permission is requested only from an enable action. CPU/memory alerts consume native graph update events and require the graph to be open; storage alerts consume sanitized cached volume size/free values on native details updates and never inspect BitLocker fields. Background alerts for devices outside Device Details remain pending.
- PWA install affordance is source-only and appears only after the browser dispatches `beforeinstallprompt`; installation runs from the explicit user click and installed state hides the control. MeshCentral's native dynamic manifest and push service worker are preserved. The existing service worker handles push display/click behavior and does not cache an offline application shell; offline use is not claimed. Browser/platform installation acceptance is pending.
- Scheduled administration remains unimplemented: review of the current MeshCentral client/server command paths found native immediate `runcommands` and `poweraction` handlers but no scheduled-action API. Browser timers would be lost when the page closes and cannot provide reliable audited administration, so the supported fallback is the immediate native permission/audit flow.
- Device Details now shows native Desktop, Terminal, Files and AMT capability states by reading the visibility/disabled state of MeshCentral's existing tabs. It adds no navigation or access grant; hidden/restricted/unavailable tabs display Unavailable. Source contract coverage exists; authenticated role and hardware validation remains pending.
- Upstream compatibility snapshot reviewed on 2026-11-05: `origin/master` is package version 1.3.1 at `c897d5e5`. Newer upstream commits add file-sharing download permission enforcement (`396e423b`), user-management domain-boundary enforcement (`74b24b77`), device/delegated-permission limits (`5ee4afeb`), and server-side 2FA/session-token/routing hardening (`75ebec8a`). PR #1 is based on `c897d5e5`; PRs #2 and #3 build on that branch chain, so these upstream fixes are included in the source ancestry. Night Shift changes only web override assets and tests, with no template/backend replacement. PRN package metadata confirms 1.3.1 but does not expose its exact source commit; installed-fix presence still requires source/behavior verification before release.
- PRN deployment notes record structural source commit `989ae01333c0fc66fa19bc5de77152228345736`, followed by authenticated navigation fix `132b706f951a9ff8f2e3d7f3f3400ff7e7578f5f`. On 2026-11-05 the synchronized mobile rules and safe-area refinement were deployed from this worktree. Local HTTP served CSS/JS exactly matching source SHA-256, and the root returned HTTP 200 with both override names present. The native favorites and recent-device source slices are not deployed; authenticated visual confirmation of the masthead update remains open.
- Authenticated read-only review passed navigation, search/status filtering, dashboard, Events, Files, Users, Server, and native-list fallback. It recorded a mobile masthead clipping defect. The correction is now deployed and byte-verified through the local HTTP listener; its visual effect has not yet been rechecked in an authenticated browser.
- PRN Cloudflare Access and service state were preserved. Real Agent/RDP input, terminal commands, file mutation, Android/iOS gestures, role restrictions, AMT, recordings and plugin workflows remain unverified.
- Current PRN target is `C:\ProgramData\MeshCentral` (data directory present, MeshCentral, Cloudflared and Mesh Agent services running, configured listener port 9455, local override endpoints HTTP 200). The installer created rollback `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-000507-28f309`; its manifest preserves the prior CSS/JS hashes. Source and served CSS hash: `D2965A0B9CA93D312D65A0583BBF44D81D6E67CBEE6923438AE3991F38F26E0D`; source and served JS hash: `7D50EED58E7B8C4C1C915EE120B0EF3DFA6245B11CF2E03D83BBA896EF275217`.
- No current blocker to source development. Browser access tooling was unavailable in this session, so live authenticated visual acceptance could not be repeated. Physical-device acceptance also requires authenticated Android/iOS devices and eligible MeshCentral test sessions; these are acceptance dependencies, not reasons to claim completion.

