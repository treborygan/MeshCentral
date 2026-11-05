# Night Shift roadmap

Scope: modernize `treborygan/MeshCentral` while retaining native MeshCentral handlers, permissions, transports, and security boundaries. The implementation remains a reversible web override; it must not change PRN configuration, agents, certificates, database, services, or Cloudflare ingress.

Status labels: **Done** means source and the stated verification exist; it does not imply live acceptance. **Pending** means implementation or the required acceptance evidence is missing. **Blocked** means a concrete external dependency prevents work.

## Phase 1 — complete Night Shift UI V2

- [x] Navy/green tokens, responsive shell and current Night Shift styling layers.
- [x] Contextual appbar, native navigation search, permission-filtered More menu, and live-data dashboard.
- [x] Responsive live device cards, search and connection filters, native-list fallback, and native quick actions.
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
- [ ] Persistent tabs for multiple live device sessions with safe switching and reconnection.
- [ ] Actionable diagnostics for browser, Cloudflare, relay, agent, RDP and remote-display failures where observable.
- [ ] Per-device connection profiles for method, monitor, scaling, quality, keyboard layout and fullscreen preferences; never store secrets or session content.
- [ ] Recent devices, quick launch and safe reconnection.
- [ ] Improved clipboard, shortcuts, international layouts and mobile input controls, accepted against real sessions.
- [ ] Verify connection-state transitions and permission-preserving unavailable/error states.

## Phase 3 — device management and power tools

- [ ] Split-pane file manager with drag/drop, bulk transfers, queue/progress, checksums and only backend-supported retry/resume.
- [ ] Live health panels for CPU, memory, storage, uptime, agent status and available system information.
- [ ] Searchable activity/session history and native recording access.
- [ ] Permission-gated quick actions and reusable audited commands.
- [ ] Wake-on-LAN/Intel AMT power controls where supported.
- [ ] Clear unavailable states when server/agent capabilities are absent.

## Phase 4 — advanced functionality

- [ ] Configurable health/connection alerts with deduplication and quiet hours.
- [ ] Scheduled administration using existing MeshCentral mechanisms.
- [ ] Secure installable mobile PWA behavior.
- [ ] Optional modular integrations and monitoring extensions.

## Security, architecture and release gates

- [x] Keep authentication, permissions, consent, guest sharing, recording, 2FA, native transports and Cloudflare boundaries in MeshCentral.
- [x] Use the persistent `custom.css`/`custom.js` extension points and backup-manifest installer; rollback path is documented.
- [x] Current automated source checks: `node --check public/scripts/custom.js` and `node --test tests/night-shift.test.cjs` (12 tests).
- [ ] Review current upstream security fixes and compatibility before production release.
- [ ] Complete authenticated workflows for admin and restricted roles, Agent desktop, browser RDP, terminal, files, reconnect, guest, recordings, AMT and plugins.
- [ ] Complete screenshot comparison and live physical-device checks; keep the PR draft until these pass.
- [x] Recheck the installed asset and rollback hashes for the 2026-11-05 mobile masthead update; verify the running asset revision over the local HTTP listener.
- [ ] Repeat authenticated visual review at 390×844 and on physical phones; the browser-control host was unavailable during this session.

## Current evidence and blockers

- Source branch: `feature/night-shift-structural`, based on the MeshCentral 1.3.1 fork. PR #3 is open and draft.
- PRN deployment notes record structural source commit `989ae01333c0fc66fa19bc5de77152228345736`, followed by authenticated navigation fix `132b706f951a9ff8f2e3d7f3f3400ff7e7578f5f`. On 2026-11-05 the synchronized mobile rules and safe-area refinement were deployed from this worktree. Local HTTP served CSS/JS exactly matching source SHA-256, and the root returned HTTP 200 with both override names present. The current source-only favorites slice is not deployed; authenticated visual confirmation of the masthead update remains open.
- Authenticated read-only review passed navigation, search/status filtering, dashboard, Events, Files, Users, Server, and native-list fallback. It recorded a mobile masthead clipping defect. The correction is now deployed and byte-verified through the local HTTP listener; its visual effect has not yet been rechecked in an authenticated browser.
- PRN Cloudflare Access and service state were preserved. Real Agent/RDP input, terminal commands, file mutation, Android/iOS gestures, role restrictions, AMT, recordings and plugin workflows remain unverified.
- Current PRN target is `C:\ProgramData\MeshCentral` (data directory present, MeshCentral, Cloudflared and Mesh Agent services running, configured listener port 9455, local override endpoints HTTP 200). The installer created rollback `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261105-000507-28f309`; its manifest preserves the prior CSS/JS hashes. Source and served CSS hash: `D2965A0B9CA93D312D65A0583BBF44D81D6E67CBEE6923438AE3991F38F26E0D`; source and served JS hash: `7D50EED58E7B8C4C1C915EE120B0EF3DFA6245B11CF2E03D83BBA896EF275217`.
- No current blocker to source development. Browser access tooling was unavailable in this session, so live authenticated visual acceptance could not be repeated. Physical-device acceptance also requires authenticated Android/iOS devices and eligible MeshCentral test sessions; these are acceptance dependencies, not reasons to claim completion.

