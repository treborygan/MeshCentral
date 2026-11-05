# Night Shift — MeshCentral interface modernization

> **Structural implementation deployed (2026-11-04):** [`feature/night-shift-structural`](night-shift-structural.md) adds a live-data contextual appbar, dashboard, responsive real-device cards with a native-list toggle, permission-filtered More menu, native device quick actions and remote-session chrome. An authenticated read-only browser pass verified navigation, search/status filtering, dashboard, Files, Users, Server and native-list fallback. Real remote input, restricted-role parity, and physical phone acceptance remain open. Later mobile-overflow CSS from PRN and safe-area refinements were deployed on 2026-11-05; the latest masthead still needs a visual recheck.

Status: **Night Shift V2 and the mobile safe-area refinement are deployed to PRN; partial authenticated browser acceptance passed. The source branch adds native favorites/recent devices and Cards/Table/Compact inventory with tags, sorting and native bulk selection; these newer slices have not been deployed. The masthead layout still needs live visual recheck.** Design direction **B / Night Shift** is approved. The branch contains responsive CSS, progressive JavaScript, a reversible installer, syntax/contract checks, and a mobile interaction harness. No server/agent changes. The source baseline is the `treborygan/MeshCentral` fork at upstream MeshCentral **1.3.1** (2026-11-04).

## Goal

Modernize MeshCentral's entire web experience, especially phone use, while **preserving every existing device, server, user, guest, group, privilege, plugin, and remote-management capability**.

The aesthetic follows the independently prototyped Night Shift concept: deep navy canvas, indigo-gray surfaces, compact workspace chrome, sage accent for active controls, and clear data hierarchy. No design or code from other projects is used.

## Architecture decision

**Keep the MeshCentral backend, protocols, accounts, database, agents, remote desktop renderers, session state, permission decisions and Cloudflare/network ingress unchanged.**

1. Night Shift deploys `public/styles/custom.css` and the generated `public/scripts/custom.js` through MeshCentral's persistent override hooks. Maintain JavaScript in the focused `public/scripts/night-shift/{mobile-controls,shell,devices}.js` components and run `node scripts/build-night-shift.js`; CI checks that the deployable bundle is current. The bundle remains additive; no original templates or input handlers are replaced.
2. For an **existing installed instance**, deploy only the CSS and JS into `<meshcentral-root>/meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js`. Use `scripts/Install-NightShift.ps1` for backup, installation and rollback. No package/binary replacement.
3. Later, when CSS cannot represent a workflow change, copy **only specific** upstream `views/*.handlebars` files to `meshcentral-web/views` for a reviewed override. Template copies must be diffed/rebased on upstream upgrades. Do not use wholesale template overrides while in the initial CSS stage.
4. Functional mobile remote-control upgrades must call existing MeshCentral desktop/RDP/AMT input interfaces. Never create a parallel relay or evade agent permissions.
5. Design changes must not require reinstalling agents or re-enrolling devices.

## Current implementation

- [x] Night Shift token palette and accessible focus indicators
- [x] Main desktop and mobile page coloring, navigation, device toolbar, dialogs, forms
- [x] Coarse-pointer target sizing and reduced-motion support
- [ ] Real-browser visual and functional acceptance on live MeshCentral pages
- [x] Command search, labeled sidebar, streamlined navigation and mobile dock integrated with upstream markup (additive overlay, not a pixel-identical template replacement)
- [x] Dark device detail, remote desktop, terminal, files and settings presentation without displacing original MeshCentral controls
- [x] Mobile actions wired to existing MeshCentral Connect, RDP, Disconnect, trackpad, right-click, keyboard, zoom, fullscreen, monitor and settings handlers (source-level interaction harness passes; real-session acceptance remains open)
- [x] PCRN web override installed and exact CSS/JS assets verified from the local MeshCentral listener
- [ ] Comprehensive MeshCentral feature parity and role permissions validation

**Acceptance boundary:** the Night Shift CSS/JS is installed in `C:\ProgramData\MeshCentral\meshcentral-web\public`. PCRN's local listener serves both files with HTTP 200 and matching SHA-256 content; the public unauthenticated route redirects to Cloudflare Access. The login2 entry page is explicitly themed even though it lacks the application `#container`. Native trackpad, touch, zoom, keyboard and RDP behavior is delegated to MeshCentral 1.3.1 itself. Authenticated browser rendering, real mobile touch input, live RDP, iOS Safari, role permissions and feature parity are **not yet verified**. Classic mobile templates remain as fallback. No RDP/WebSocket/protocol code is modified.

## Suggested delivery slices

### Slice A — Styling (implemented)

Apply CSS and JS via built-in custom overrides. Preserve all IDs, event handlers, form names, network endpoints, and existing surfaces. Verify login, device list, tabs, settings, file/terminal/desktop panels, dark/light semantics, dialogs and permissions.

### Slice B — Structural composition (additive controls implemented; more intrusive template restructuring deferred)

For the primary desktop view, create a modern hierarchy: collapsible navigation rail, searchable device inventory, device details, contextual actions and remote-session workspace. Prefer additive components, feature detection and retained upstream DOM IDs/handlers; if a template override is required, make it narrow, keep source diffs reviewable, and retain an immediate classic-UI fallback.

### Slice C — Mobile session UX (native-action dock implemented; device acceptance pending)

Use a mobile-first connection flow: device list → remote session, maximized remote canvas, compact lower control tray and landscape view. Implement/tether to actual MeshCentral browser interfaces:
- Direct touch vs trackpad mode, right-click, scroll wheel, drag and drag lock.
- Pinch-zoom and viewport pan *without modifying mouse coordinate mapping incorrectly*.
- Keyboard focus and IME, on-screen Ctrl/Alt/Shift/Win/Tab/Esc/Del, send key-down/up.
- Multi-monitor selection, full screen, quality/framerate controls, reconnect state.
- Respect consent/recording/guest protections and role permissions.
- Test independently for MeshAgent, browser RDP, Intel AMT KVM, and unavailable capabilities.

**Do not replace canvas/WebSocket/RDP implementations merely to change their UI.**

### Slice D — Remaining feature parity

Cover groups, users, user permissions, invites, two-factor/account pages, agent enrollment, files/transfers, terminal, events, console, recordings, Intel AMT power/provisioning, server administration, guest sessions, plugins/custom tabs, advanced dialogs, and localized text. Unknown/upstream plugin tabs must remain accessible.

## Acceptance gates

| Surface | Desktop | Android Chrome | iOS Safari | Notes |
| --- | --- | --- | --- | --- |
| Login/2FA/logout | pending | pending | pending | Security and CSRF unchanged |
| Device/group search and navigation | pending | pending | pending | No missing actions |
| MeshAgent desktop | pending | pending | pending | Touch, mouse, keyboard, resize, reconnect |
| Browser RDP | pending | pending | pending | Genuine remote session, not prototype |
| AMT KVM (where available) | pending | pending | pending | Authorization + power |
| Terminal | pending | pending | pending | Input, resize, paste, keyboard |
| Files | pending | pending | pending | Upload/download, progress, ACL |
| Admin/users/plugins | pending | pending | pending | Feature parity |
| 320–430px portrait and landscape | n/a | pending | pending | Safe areas + external keyboard |
| Zscaler/Cloudflare transport | pending | pending | pending | Existing disconnect issue is separate |

Test with one account with admin rights and one restricted account; preserve denied/unavailable states. Check the complete default, modern and mobile templates rather than one happy path. Validate screen readers, keyboard focus, 200% zoom, reduced motion, dark contrast and Chrome/Edge/Firefox.

## PCRN deployment and rollback

The 2026-11-04 rollout backed up both previously absent customization files under `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261104-172151-f30fb4`. MeshCentral was restarted once to load the newly created override directory; afterward MeshCentral, Cloudflare Tunnel and Mesh Agent services were all running. The rollback command and full procedure are in [the deploy runbook](night-shift-deployment.md). **Never overwrite production config.json, certificates, database, agent binaries, installed service, npm package, or Cloudflare Tunnel in a UI-only rollout.** Preserve a known-good independent remote access route.

## Upstream maintenance

Keep `master` tracking upstream. Develop Night Shift on feature branches and review changes to `views/`, `public/styles/`, desktop input scripts and plugin APIs on each upstream upgrade. Avoid bundling an entire modified upstream stylesheet where a small custom override is sufficient.

References:
- https://docs.meshcentral.com/meshcentral/customization/
- https://docs.meshcentral.com/design/
- https://github.com/Ylianst/MeshCentral

## Build and test

- `node --check public/scripts/custom.js`
- `node --test tests/night-shift.test.cjs`
- Windows PowerShell parser validation is configured in `.github/workflows/night-shift-ui.yml`.
- The tests check source syntax, native-action delegation, CSS structure, installer safety, desktop/mobile navigation and dock visibility, native RDP/trackpad/keyboard/zoom/right-click/fullscreen/monitor delegation, and hidden-rail navigation fallback. The Windows installer was also exercised against a disposable fixture with SHA-256 comparison and rollback.
- These checks do **not** prove live browser rendering, real mobile touch input, authenticated RDP, iOS Safari, or permission-role acceptance.
- Install/rollback: `scripts/Install-NightShift.ps1`; see [deployment](night-shift-deployment.md).


## 2026-11-04 live Android screenshot findings (blocking)

Owner-provided Android Chrome screenshots of `rdp.treborygan.dev` demonstrate that the first rollout **does not match Night Shift Concept B**:

- Original 60–90 px sidebar and duplicate mobile bar both visible.
- Text, account actions, and device rows render at desktop-sized CSS viewport and become too small on the phone.
- Device inventory is the upstream table/legacy tile with dark colors; not the approved device cards.
- Account page uses legacy scattered links instead of structured, tappable security and settings sections.

### Confirmed immediate root cause

`views/default3.handlebars` contains `<meta name="viewport" content="user-scalable=yes,initial-scale=1.0,minimum-scale=1.0">` **without** `width=device-width`. Android may use a roughly 980px layout viewport. The previous custom.js enabled the mobile toolbar for coarse pointers up to 1100px, but the CSS only hid the desktop sidebar at max-width 900px. This exactly explains the duplicate navigation and compressed presentation.

The follow-up branch `fix/night-shift-mobile-layout` adds a device-width viewport at runtime (without disabling zoom), makes JS and CSS use the same 900px breakpoint, updates mobile list/account styling, and adds regression checks. **It has not been deployed or tested on the actual phone.**

### Remaining design gap (not solved by the viewport patch)

A CSS overlay alone cannot guarantee faithful implementation of the Night Shift prototype. The next work must restructure the *actual* MeshCentral interface rather than recolor it:

1. Preserve upstream MeshCentral handlers/IDs, permission gates, and plugin extension slots while creating the responsive app shell, top bar and device lists from real data.
2. Implement the Night Shift device-detail layout with semantic, functional **General / Desktop / Terminal / Files / More** navigation. No dead mock buttons.
3. Create a mobile session-first desktop layout: active canvas, real connection-status/header and a bottom touch palette connected to existing agent/RDP/AMT handlers; use portrait/landscape safe areas and no overlapping controls.
4. Adapt account, groups, users, events, files and server admin into consistent, accessible mobile layouts. Every original action stays discoverable.
5. Test a concrete screenshot matrix at 390×844, 430×932, 844×390, tablet 900–1024, desktop 1440×900. Include account, inventory, device details, connected Agent desktop, RDP, terminal, files, settings and restricted-user states.
6. **Visual acceptance must compare the actual authenticated pages against `MeshCentral_UI_Concepts.html` / Concept B reference.** Do not call the work complete based solely on handler mocks or the stylesheet loading.
7. Keep a one-step reversible fallback to upstream UI, independent Cloudflare/PCRN access and no changes to config/database/agents.

This is a structural UI redesign task, not a completed feature of the original CSS-only PR.
