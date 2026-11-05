# Night Shift 2 — structural, live-data UI integration

Branch: `feature/night-shift-structural` (built on `fix/night-shift-mobile-layout`).

## Scope and implementation boundary

This slice extends the generated `custom.js` and `custom.css` overrides without replacing MeshCentral templates, services, agents, database, authentication, Cloudflare integration, or transport protocol. JavaScript source is split into focused mobile-controls, shell, device-inventory, session-diagnostics, multi-session-tabs and per-device-profiles components and assembled by `scripts/build-night-shift.js`; the generated bundle remains the only deployed script asset. The UI wraps **real** MeshCentral DOM and native handlers. It is not the standalone HTML prototype, and it does not use any data from its sample fleet.

Included:
- Contextual workspace appbar with live page title, native navigation search, and a functional More menu exposing only original account-accessible sections.
- Responsive overview in the real Devices page: genuine live online/offline counts, actionable links to existing pages, clear provenance, and no fake events/devices/connection counts.
- A responsive real-device inventory built from the authenticated MeshCentral `window.nodes`/`window.meshes` collection, with Cards, semantic Table and Compact layouts; name/group/status/recent sorting; native `node.tags` chips and tag filter; local search; and reachable/offline filters. Selection checkboxes delegate to native `p1devcheck()` state and keep MeshCentral's group-action toolbar available. Device opening still delegates to `gotoDevice()` permission/2FA/verification checks. **Original list** restores the complete native inventory and advanced layouts. Only device list views 1 and 2 are replaced by Night Shift layouts; other views remain native.
- Per-card favorite controls and a Favorites filter use MeshCentral's native `stars` state and `putstore('stars', ...)` preference path, including its 200-device limit; no separate identity or credential data is stored.
- Recent devices are stored per MeshCentral account in browser preferences as up to eight device IDs and timestamps, without names, credentials, tokens or session content. Recent entries render only when their devices appear in the current authorized inventory; opening one delegates to native `gotoDevice()` checks.
- Quick device actions using native Desktop, Terminal and Files handlers. Advanced device tabs, plugins, permissions and original controls remain available.
- Contextual remote-session strip with connection text derived from MeshCentral's existing Disconnect control. Original canvas, RDP, AMT, terminal, keyboard and other session implementations remain untouched.
- Event-driven remote-session diagnostics report browser online state, MeshCentral socket state, native Agent/AMT route flags, session transport/state, and whether the native display canvas is mounted. A shortcut focuses the existing native Connect control. Updates use browser events and a scoped DOM observer rather than polling. Cloudflare Access/tunnel health is labeled as not observable after page load; this UI does not infer it from an authenticated session.
- A remote-session tab bar enumerates the active viewer and existing MeshCentral `multiDesktop` sessions. Switching calls the native `gotoDevice()` route and closing a background session calls `toggleKvmDevice()`, retaining upstream navigation, permission and session behavior. A disconnected session returns to the native Connect controls for deliberate reconnection; the tab bar does not auto-connect or save session data to browser storage.
- Per-device profiles use an account/device-scoped local preference key with a strict allow-list: connection method, monitor index, quality, scaling, native/remote keyboard map and fullscreen preference. Connecting delegates to the enabled native Agent/RDP/AMT button, preserving native permission and credential/consent flows. Agent quality/scaling/map and supported monitor settings apply through existing desktop methods. Fullscreen uses the native viewer handler during the user-initiated profile connect or a separate Apply fullscreen click. Unsupported controls on RDP/AMT are reported and left to their native settings. No credentials, tokens or session content are stored.
- Navy/green Night Shift composition for desktop/tablet/phone, accessible labels, focus, reduced-motion styling and mobile session-first chrome.
- Existing mobile touch controls, command search, login2 theming and viewport corrections inherited from previous PRs.

The actual browser must supply MeshCentral's expected IDs. Components are created only after authenticated markup exists. When the corresponding native section or permission-gated control is absent, enhanced actions are withheld. Live session and rendered inventory state are derived from existing DOM and never asserted from mocks.

## Important limits

- A full screenshot-matched replacement of the native list/group/user/server templates is **not yet proven**. These screens are restyled upstream views with additive components, not a complete independent application.
- Core MeshCentral behavior is preserved by delegation, but end-to-end Agent desktop, browser RDP, terminal, file transfer, Android gestures, Intel AMT, guest sessions, recordings, plugins and restricted-role workflows still require real authenticated browser acceptance.
- The dashboard counts authenticated device objects currently loaded into `window.nodes` and derives reachable/offline from `node.conn` (Agent, AMT, or relay flags). If node data are not yet available, the device count falls back to rendered native rows and status counts remain unavailable. Counts can be paginated and are **not guaranteed to represent the server-wide total**.
- Synthetic DOM contract tests verify the UI shell, native navigation, populated device-row count and diagnostic mapping; they do not validate a live browser or remote-control session.
- PRN has received the structural layer from this branch (source commit `989ae01333c0fc66fa19bc5de77152228345736`) and the authenticated-navigation fix (`132b706f951a9ff8f2e3d7f3f3400ff7e7578f5f`). The production mobile-overflow patch was synchronized to source and deployed with safe-area refinements on 2026-11-05; installed/served hashes and rollback evidence are in `night-shift-deployment.md`. Native favorites, recent-device features, Cards/Table/Compact inventory improvements, diagnostics, session tabs and connection profiles are source-tested but not deployed. Latest authenticated visual recheck remains open.

## Deploying safely to PCRN

Use the existing `scripts/Install-NightShift.ps1` deployment/rollback workflow and the same **verified** MeshCentral root (`C:ProgramDataMeshCentral`). Preserve `meshcentral-data`, certificates, service, Cloudflare Tunnel and Access, database and installed agents.

1. Confirm branch and source checks; use the verified root `C:\ProgramData\MeshCentral`.
2. Keep the installer-generated backup of both currently installed overrides and confirm its manifest hashes.
3. Confirm the local HTTP listener serves the new CSS and JS byte-for-byte after install; do not restart MeshCentral unless it stops serving the overrides.
4. Recheck authenticated login, permissions, desktop/device list, Android viewport, genuine MeshAgent and browser RDP sessions, terminal, file transfer, account/admin and session toolbar.
5. If there is any regression, use the exact backup path printed by the installer to restore both assets. Hard-refresh to avoid cached files.

## Verification

- `node --check public/scripts/custom.js`
- `node --test tests/night-shift.test.cjs`
- CI checks JavaScript, native delegation and PowerShell parsing.

Never mark the release accepted based solely on passing source contracts. Real authenticated browser testing on the actual PCRN server is required before merging and making a production claim.
