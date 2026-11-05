# Night Shift 2 — structural, live-data UI integration

Branch: `feature/night-shift-structural` (built on `fix/night-shift-mobile-layout`).

## Scope and implementation boundary

This slice extends the existing `custom.js` and `custom.css` overrides without replacing MeshCentral templates, services, agents, database, authentication, Cloudflare integration, or transport protocol. It adds a structural layer around **real** MeshCentral DOM and native handlers. It is not the standalone HTML prototype, and it does not use any data from its sample fleet.

Included:
- Contextual workspace appbar with live page title, native navigation search, and a functional More menu exposing only original account-accessible sections.
- Responsive overview in the real Devices page: genuine live online/offline counts, actionable links to existing pages, clear provenance, and no fake events/devices/connection counts.
- A responsive real-device card inventory built from the authenticated MeshCentral `window.nodes`/`window.meshes` collection, with local search and reachable/offline filters. Clicking a card delegates to the existing `gotoDevice()` permission/2FA/verification checks. **Original list** toggles back to the full native inventory, bulk actions, sorting, groups, map and advanced views. Only device list views 1 and 2 are replaced by cards; other views remain native.
- Per-card favorite controls and a Favorites filter use MeshCentral's native `stars` state and `putstore('stars', ...)` preference path, including its 200-device limit; no separate identity or credential data is stored.
- Recent devices are stored per MeshCentral account in browser preferences as up to eight device IDs and timestamps, without names, credentials, tokens or session content. Recent entries render only when their devices appear in the current authorized inventory; opening one delegates to native `gotoDevice()` checks.
- Quick device actions using native Desktop, Terminal and Files handlers. Advanced device tabs, plugins, permissions and original controls remain available.
- Contextual remote-session strip with connection text derived from MeshCentral's existing Disconnect control. Original canvas, RDP, AMT, terminal, keyboard and other session implementations remain untouched.
- Navy/green Night Shift composition for desktop/tablet/phone, accessible labels, focus, reduced-motion styling and mobile session-first chrome.
- Existing mobile touch controls, command search, login2 theming and viewport corrections inherited from previous PRs.

The actual browser must supply MeshCentral's expected IDs. Components are created only after authenticated markup exists. When the corresponding native section or permission-gated control is absent, enhanced actions are withheld. Live session and rendered inventory state are derived from existing DOM and never asserted from mocks.

## Important limits

- A full screenshot-matched replacement of the native list/group/user/server templates is **not yet proven**. These screens are restyled upstream views with additive components, not a complete independent application.
- Core MeshCentral behavior is preserved by delegation, but end-to-end Agent desktop, browser RDP, terminal, file transfer, Android gestures, Intel AMT, guest sessions, recordings, plugins and restricted-role workflows still require real authenticated browser acceptance.
- The dashboard counts authenticated device objects currently loaded into `window.nodes` and derives reachable/offline from `node.conn` (Agent, AMT, or relay flags). If node data are not yet available, the device count falls back to rendered native rows and status counts remain unavailable. Counts can be paginated and are **not guaranteed to represent the server-wide total**.
- A synthetic DOM contract test verifies the UI shell, native navigation and populated device-row count; it does not validate a live browser or remote-control session.
- PRN has received the structural layer from this branch (source commit `989ae01333c0fc66fa19bc5de77152228345736`) and the authenticated-navigation fix (`132b706f951a9ff8f2e3d7f3f3400ff7e7578f5f`). The production mobile-overflow patch was synchronized to source and deployed with safe-area refinements on 2026-11-05; installed/served hashes and rollback evidence are in `night-shift-deployment.md`. Native favorites and recent-device features are source-tested but not deployed. Latest authenticated visual recheck remains open.

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
