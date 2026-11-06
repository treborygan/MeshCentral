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
- [x] Expandable desktop navigation rail with keyboard-accessible, session-only toggle; native stacked/full-desktop modes and mobile navigation are preserved
- [x] Dark device detail, remote desktop, terminal, files and settings presentation without displacing original MeshCentral controls
- [x] Software page no-response recovery: after 30 seconds of native installed-software loading, show a clear no-usable-response message and release the native in-flight guard so the existing Refresh handler can retry; native success, empty, error and late responses remain authoritative
- [x] Mobile actions wired to existing MeshCentral Connect, RDP, Disconnect, trackpad, right-click, keyboard, zoom, fullscreen, monitor and settings handlers (source-level interaction harness passes; real-session acceptance remains open)
- [x] User-facing Classic UI fallback: choose **More → Classic UI** to disable the Night Shift stylesheet and skip all enhancement modules for this tab; the native Classic pages retain a **Night Shift** return button. The preference is local to the browser and is not synced as MeshCentral user state. Installed-server acceptance remains pending.
- [x] PCRN web override installed and exact CSS/JS assets verified from the local MeshCentral listener
- [ ] Comprehensive MeshCentral feature parity and role permissions validation

**Acceptance boundary:** the Night Shift CSS/JS is installed in `C:\ProgramData\MeshCentral\meshcentral-web\public`. PCRN's local listener serves both files with HTTP 200 and matching SHA-256 content; the public unauthenticated route redirects to Cloudflare Access. The login2 entry page is explicitly themed even though it lacks the application `#container`. Native trackpad, touch, zoom, keyboard and RDP behavior is delegated to MeshCentral 1.3.1 itself. Authenticated browser rendering, real mobile touch input, live RDP, iOS Safari, role permissions and feature parity are **not yet verified**. Classic mobile templates remain as fallback. No RDP/WebSocket/protocol code is modified.

## Suggested delivery slices

### Slice A — Styling (implemented)

Apply CSS and JS via built-in custom overrides. Preserve all IDs, event handlers, form names, network endpoints, and existing surfaces. Verify login, device list, tabs, settings, file/terminal/desktop panels, dark/light semantics, dialogs and permissions.

### Slice B — Structural composition (additive controls implemented; more intrusive template restructuring deferred)

For the primary desktop view, create a modern hierarchy: expandable navigation rail, searchable device inventory, device details, contextual actions and remote-session workspace. Prefer additive components, feature detection and retained upstream DOM IDs/handlers; if a template override is required, make it narrow, keep source diffs reviewable, and retain an immediate classic-UI fallback.

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


## Historical findings — 2026-11-04 live Android screenshots

This section records the first rollout and the follow-up mobile viewport patch. It predates the structural implementation tracked in [the roadmap](night-shift-roadmap.md); do not read its status statements as the current source state.

Owner-provided Android Chrome screenshots of `rdp.treborygan.dev` demonstrate that the first rollout **does not match Night Shift Concept B**:

- Original 60–90 px sidebar and duplicate mobile bar both visible.
- Text, account actions, and device rows render at desktop-sized CSS viewport and become too small on the phone.
- Device inventory is the upstream table/legacy tile with dark colors; not the approved device cards.
- Account page uses legacy scattered links instead of structured, tappable security and settings sections.

### Confirmed immediate root cause

`views/default3.handlebars` contains `<meta name="viewport" content="user-scalable=yes,initial-scale=1.0,minimum-scale=1.0">` **without** `width=device-width`. Android may use a roughly 980px layout viewport. The previous custom.js enabled the mobile toolbar for coarse pointers up to 1100px, but the CSS only hid the desktop sidebar at max-width 900px. This exactly explains the duplicate navigation and compressed presentation.

The follow-up branch `fix/night-shift-mobile-layout` adds a device-width viewport at runtime (without disabling zoom), makes JS and CSS use the same 900px breakpoint, updates mobile list/account styling, and adds regression checks. **It has not been deployed or tested on the actual phone.**

### Design gap at the time (not solved by the viewport patch)

A CSS overlay alone cannot guarantee faithful implementation of the Night Shift prototype. The next work must restructure the *actual* MeshCentral interface rather than recolor it:

1. Preserve upstream MeshCentral handlers/IDs, permission gates, and plugin extension slots while creating the responsive app shell, top bar and device lists from real data.
2. Implement the Night Shift device-detail layout with semantic, functional **General / Desktop / Terminal / Files / More** navigation. No dead mock buttons.
3. Create a mobile session-first desktop layout: active canvas, real connection-status/header and a bottom touch palette connected to existing agent/RDP/AMT handlers; use portrait/landscape safe areas and no overlapping controls.
4. Adapt account, groups, users, events, files and server admin into consistent, accessible mobile layouts. Every original action stays discoverable.
5. Test a concrete screenshot matrix at 390×844, 430×932, 844×390, tablet 900–1024, desktop 1440×900. Include account, inventory, device details, connected Agent desktop, RDP, terminal, files, settings and restricted-user states.
6. **Visual acceptance must compare the actual authenticated pages against `MeshCentral_UI_Concepts.html` / Concept B reference.** Do not call the work complete based solely on handler mocks or the stylesheet loading.
7. Keep a one-step reversible fallback to upstream UI, independent Cloudflare/PCRN access and no changes to config/database/agents.

The later `feature/night-shift-structural` branch implements a structural shell and responsive adaptations in the existing MeshCentral pages. Current module coverage and source checks are recorded in [the roadmap](night-shift-roadmap.md). The implementation still has not passed authenticated screenshot comparison against the approved Concept B, complete remote-session acceptance, or physical Android/iOS acceptance. The only screenshots checked into `docs/night-shift-acceptance/` are unauthenticated PRN login captures; they cannot establish those gates. The Concept B file named above was not found in the repository or connected Drive, and the browser-control host is unavailable for authenticated capture.

### Live layout review corrections (2026-11-06)

Follow-up CSS overrides address authenticated review findings at a 944×1178 CSS-pixel viewport: the fixed MeshCentral content frame now has a vertical scroll surface; the Devices and Server Stats panels can scroll within that frame; inventory controls can be reached horizontally when upstream table content exceeds the viewport; Server General action links and telemetry values are constrained to their cards; Account removes its small horizontal overscroll; and Device Details reserves a readable key column. The More menu now dismisses on outside clicks and on menu navigation, keeping `aria-expanded` synchronized. Focused contract tests cover these regressions. After installation, an authenticated hard reload verified the computed vertical scroll, Devices PageDown movement from 0 to 218px with all cards reached, constrained Server actions and Memory text, and More dismissal with `aria-expanded=false`. Physical mobile acceptance remains open.

The latest remote-session attempt remains unaccepted: although Device Details reports Agent connected and remote desktop available, and browser diagnostics show the MeshCentral control channel and Agent route, native Connect attempts left the page Disconnected with no active session/display. Agent/control-channel availability does not confirm the per-session desktop relay handshake. This remains an open MeshCentral transport/session acceptance gate, outside the frontend layout fix; no backend, service, configuration, agent or tunnel changes were made.

### Follow-up route layout audit (2026-11-06)

The subsequent desktop review at 944px confirmed that horizontal overflow in Devices was attached to the whole `#p1` workspace, so horizontal scrolling could shift and clip the page. The follow-up CSS clips overflow at the workspace boundary, constrains inventory controls, and leaves horizontal scrolling to the native table wrapper when its columns need it. Device Details had its own height-limited `#p10info` scroll region inside the shell's scrollable column; on desktop the inner limit is removed so the outer workspace owns vertical scrolling. The existing mobile inner detail scroll remains in place.

The reported Server Stats heading/chart overlap was not reproducible from the source layout: title, subheading, and chart canvas are normal-flow siblings. A small top margin now separates the plot from its controls as a spacing safeguard; live visual confirmation is still pending. Reports is intentionally a native title, Generate Report action, and empty result container until the user generates a report. Its route now uses natural content height and shows a short empty-state hint, while retaining the native `generateReportDialog()` action. This addresses the visually empty route without inventing report data or replacing its handler.

The route source audit found existing local scroll surfaces for files, terminal, user/group tables, plugins, event lists, and server trace. The review did not supply a verified regression in those routes, so their handlers and scrolling behavior were left intact. The follow-up CSS and regression checks are source changes only and were not deployed in this task. The parent operator owns any later installation and live verification. Physical Android/iOS acceptance remains open.

Additional live review findings in Server General, Stats, and Console were checked against the native DOM: the Server State rows used fixed 300px tables inside inline-block wrappers; the Stats title scrolled beneath the pinned appbar; and the Console footer gave the command input 99% table width alongside fixed controls. The State layout now removes decorative side cells and positions the value within the center cell. An earlier source attempt pinned the Stats title at 184px below the observed tab/appbar stack; that rule was later found to overlap the plot when the route retained a nonzero outer scroll offset, and has since been removed. The Console footer gives the input flexible width while retaining the native Clear and output selector controls. Focused source-contract assertions cover these selectors. These source fixes require live browser confirmation after integration.

The Device Files and Registry toolbar review found long native button sequences clipped at 944px. The actual device Files route is `#p13toolbar`; its action buttons are direct children of the second toolbar cell. A later live check still showed horizontal overflow, so the table, tbody, and rows now use explicit block layout before flex wrapping the cell contents. Registry `#p9toolbar2` and the separate My Files `#p5toolbar` controls also wrap within their existing toolbar areas. All native IDs, disabled states, and inline handlers remain unchanged. Focused source assertions cover the device Files Open and Registry Details controls. Live verification of this newest correction is pending; no deployment was performed.

The latest Console check found the native Clear button outside the visible portion of its footer, and then still clipped at the right edge. The latest source gives the console workspace and footer explicit 100% width constraints, reserves a fixed 76px Clear cell, and sizes the Clear button to 68px. The command cell grows into remaining space, while the output selector uses its content width; the empty spacer cell is hidden. Device Files also continued to overflow after flex wrapping, so all toolbar table rows now use explicit block layout, action buttons get a 110px flex basis, and the sort/path row wraps as a separate flex row. These source changes remain pending live verification.

A follow-up live check showed the prior Server State float/absolute positioning still did not render the numeric values reliably. The stronger override changes the generated table row to a block and its content cell to a flex row, hides the decorative first/last cells, and lays out the native label and value spans as separate flex items. This avoids relying on the upstream float inside a fixed-width table. The regression asserts this exact flex layout and the generator's nested markup; an authenticated live check is still required.

### Latest live desktop check (2026-11-06)

The latest installed CSS and JavaScript are byte-identical to the working-tree assets and are served by the PCRN loopback listener with HTTP 200. The latest responsive layout changes therefore are deployed; the rollback point is recorded in [`night-shift-deployment.md`](night-shift-deployment.md). Focused source checks pass at 71/71.

The live MeshAgent Desktop route reached Connected with the Agent route and a mounted canvas, but the remote viewport rendered only a uniform dark surface and remained blank after native Refresh. Browser RDP was not tested because its native credential prompt was canceled without entry. No remote input or host-changing action was sent. These results supersede earlier disconnected-only observations but do not establish visible desktop streaming or usable input. Physical Android/iOS testing remains open with the owner.

### Mobile remote view recheck — 2026-11-06

At 904×407 CSS pixels with DPR 3, the native device Desktop route opened, but MeshCentral reported **No active display session** and the canvas backing surface remained 300×150. No remote input was sent. This evidence does not establish a Night Shift canvas-sizing defect: without an active native display frame, CSS scaling could enlarge a blank placeholder and may interfere with MeshCentral's coordinate mapping. Leave display size, touch gestures, trackpad input and mobile keyboard acceptance open until a real frame is mounted on a physical phone.

The mobile dock uses horizontal scrolling for its native actions. Earlier narrow portrait review found controls visibly clipped past the edge, and the scrollbars were hidden, leaving no visible cue that more controls were available. The PR #3 source now keeps the existing swipe behavior and shows a thin, high-contrast scrollbar at widths up to 430px; it does not alter handlers or canvas behavior. This source-only discoverability change has a CSS contract test but has not been installed or checked on a physical device.

The installed asset mapping currently recorded above is consistent with PR #3 head `6df24e3500b890f0226e05b91a50ded91cb9e844`: before this documentation-only follow-up, PR #3's CSS/JS hashes matched the installed override hashes and loopback responses. This new scrollbar edit changes the CSS hash and is not deployed. The previously recorded installed hash therefore does not describe the current PR #3 working tree until the next authorized deployment.

Other unresolved live observations from the authenticated route audit remain distinct from this RDP display limitation: stale outer and nested scroll positions after route changes; Events title/filter crowding; Device Files actions clipped at desktop width; Stats controls/title/chart overlap; generic Workspace appbar label on routes whose route metadata is absent; and the Console Clear action below the initial viewport. Those are tracked as UI/source review items where selectors exist. Do not attribute the blank display or repeated device-console `uncaughtException` output to CSS; runtime cause remains unestablished. Mobile command/rail pointer navigation was inconsistent in emulation, while keyboard Enter navigated; no confirmed source-level defect or physical-phone reproduction is available yet.

PR #3 follow-up source-only correction: route transitions now reset `#column_l` and every descendant scroll container within the newly active native page, including `#p3events` and remote desktop nested surfaces. A regression simulates revisiting Events at scrollTop 2049 and entering RDP from a retained outer scroll offset. This resolves the stale-scroll issue in source but is not installed. The Events, Device Files, Stats, Workspace appbar, and Console findings remain unresolved or pending live verification; the preceding list should be read with this scroll-reset update applied.

## Consolidated live-audit disposition — 2026-11-06 (PR #3 source-only follow-up)

This section supersedes older, conflicting status notes above. PR #3 head `6df24e35` was recorded as installed with CSS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C` and JS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`. The fixes below are only in the isolated source worktree; no install occurred. Current source hashes are CSS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C` and JS `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

| Finding | Evidence/status | Source change | Acceptance |
| --- | --- | --- | --- |
| Events title and search/filter controls crowd/wrap | Live confirmed at desktop 944px and mobile emulation | Title stays on one line; search and loaded count reflow into their own rows; label no longer compresses | Source contract passes; not live rechecked |
| Device Files Find/GoTo/Open are clipped although native controls exist | Live confirmed at 944–945px; AX tree showed controls present | Flex wrapping now targets the actual nested action wrapper in `#p13toolbar`, preserving native IDs and inline handlers | Source contract passes; visible live reachability still unverified |
| Stats title/control/chart overlap | Live confirmed at 1441×900 when entering Stats with `#column_l.scrollTop≈153`: title at y290 overlaid canvas at y224. After Refresh reset the outer offset to 0, title y290 and canvas y361 no longer overlapped | Route transitions reset outer/nested scroll; Stats title is normal flow with chart separated from controls | Source contracts pass; deployed/live recheck remains pending |
| Appbar falls back to Workspace for Registry, Console, Software, Stats and other native pages | Live confirmed on reported routes; source route table omitted these page IDs and did not watch pages above `p19` | Explicit route labels and visibility watchers added for native page IDs through `p60` | Source route contract passes; not live rechecked |
| Stale outer and nested scroll after route navigation | Live confirmed for Terminal→Device Files, Account→Events and `#p3events` | Source resets shell and nested active-page scroll positions on route changes | Regression simulates event history offset 2049 and RDP route entry; not live rechecked |

Still open: Console Clear was not visible in the initial viewport despite existing natively; later source changes need a fresh live reachability check. Repeated device-console `uncaughtException` messages are operational/runtime evidence with cause unattributed, not a CSS finding. The mobile RDP check showed no active display session and a blank 300×150 canvas, so canvas scaling, touch gestures and keyboard acceptance remain open pending a real frame and physical-device check. Mobile search/rail pointer navigation was inconsistent only in emulation; keyboard Enter worked and no source defect is confirmed.

Final local verification for this source-only audit patch: `node scripts/build-night-shift.js --check`, `node --check public/scripts/custom.js`, `node --test tests/night-shift.test.cjs` (74/74), and `git diff --check` pass. No viewport/browser visual recheck, installation, commit, or push was performed.

### Server Stats heading contrast recheck — 2026-11-06

After the normal-flow Stats layout was installed, the 944×1178 live page showed the title at y192–241, controls at y256 and chart at y325, so the route-scroll overlap was gone. The heading itself still inherited dark `rgb(33,37,41)` against the Night Shift canvas and was nearly unreadable. The current source adds a narrowly scoped `#p40title > .fs-4` color override using `--ns-foreground`; the CSS contract asserts this rule. This follow-up color fix is source-only and has not been deployed or live-verified. Current local CSS SHA-256 is `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`; JavaScript remains `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

### Appbar Events activation recheck — 2026-11-06

Live review after the first install found that selecting the visible More-menu item “Open Events in MeshCentral” by click or Enter left the app on Server Stats (`viewmode=40`). The native `LeftMenuMyEvents` element exists. Source confirms a real event mismatch: Modern `default3.handlebars` binds its native sidebar anchor to `onclick=go(3,event)`, while the appbar navigation helper dispatched `mouseup`. The isolated source now activates the native element with `.click()` and uses a bubbling `click` event as the fallback, retaining MeshCentral's original route and permission behavior. Regression coverage asserts both the native binding and appbar activation. This correction is not deployed or live-verified. Current local JS SHA-256: `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

### Events title contrast follow-up — 2026-11-06

Post-deployment live review at 944×1178 confirmed Events now opens at `#column_l.scrollTop=0` and its title/search/filter controls fit, but `#p3title` computed to white (`rgb(255,255,255)`) while the `.fs-4` heading remained dark (`rgb(33,37,41)`). The resulting white strip is inconsistent with Night Shift. Source now sets the title strip background to `--ns-canvas`, the strip and heading text to `--ns-foreground`, with a contract test for both. Not deployed or visually rechecked. Local CSS SHA-256: `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`; JS SHA-256 remains `842FCD18C6F5E83E7F0B0FC89220F594C2A7209A437A167FBC08118792ABD17C`.

### Workspace breadcrumb activation check — 2026-11-06

At 904×407 CSS, More → Events now navigates to `viewmode=3` and resets `#column_l.scrollTop` to 0. The Workspace breadcrumb (`aria-label="Open Devices"`) did not return to Devices in the live emulation. Source marks this action as a Devices route by calling `navigate(entries[0])`; after the native click-handler correction, it uses the same `LeftMenuMyDevices.click()` path as More. The shell harness now checks that path from Events back to Devices and verifies scroll reset. It passes locally, but does not reproduce the live discrepancy. No additional source change was made; the live cause remains inconclusive and needs another browser/device interaction check.

### Events sticky-stack overlap and other title surfaces — 2026-11-06

Live review at 1445×903 found a scroll-dependent overlap: with `#column_l.scrollTop=146`, `#p3title` occupied y45–110 and filters y114–158 while sticky `#ns-appbar` occupied y66–170. Follow-up at 944×1178 confirmed `body` includes `is-mobile`; upstream `style-bootstrap.css` applies `position:relative!important; z-index:1!important` to `body.is-mobile #p3title`, overriding the initial custom sticky declaration. Source now adds a more specific important override inside the wide-screen media query (`position:sticky; top:170px; z-index:69`) while preserving the non-sticky small-screen layout. A regression asserts the native conflict and override. This correction is source-only and awaits live verification.

Source review confirms `style-bootstrap.css` applies the native white title bar to `body.is-mobile #p4title`, `#p5title`, `#p6title`, and `#p41title` along with Events. Night Shift now overrides those four title surfaces and headings to the dark canvas/foreground colors on themed mobile-class pages. Regression contracts cover the native white declaration and scoped overrides. This addresses a verified source conflict; those four routes were not individually confirmed with live computed styles, and the new overrides have not been deployed or live-verified.


The live-measured Events geometry is corrected in source, including the is-mobile cascade override; production installation remains pending parent verification.


Follow-up live retest showed the cascade now wins (`position:sticky`, z-index 69), but top 104px still placed title at y149 against appbar bottom y170. Source offsets are now calibrated to viewport coordinates: title top 170px (`appbar top 66 + height 104`), filter top 235px (title bottom plus 65px). A contract asserts both sums and declarations. This second offset correction is not deployed.

Live My Files (#p5) review with no file selected showed native disabled Rename/Delete/Edit/New Folder/Upload/Download/Cut/Copy/Paste buttons still rendered Bootstrap danger red. A narrowly scoped Night Shift rule now mutes fill, border, text, and shadow for natively `:disabled` danger/outline-danger actions in Files and Registry toolbars; it does not alter enabled danger buttons or native disabled state. CSS contract covers both states. Source-only; not deployed or live-rechecked.

### Mobile device-detail and Desktop handoff — 2026-11-06

Portrait (390×844 CSS px) and landscape (904×407 CSS px, DPR 3) emulation showed the Night Shift mobile layouts without document-level horizontal overflow. Device-detail quick actions were comfortably touch-sized; the Desktop action measured 332×44 px in portrait. The fixed mobile nav covers the bottom of the native device-tab row, so the top-level Desktop shortcut is the relevant mobile path. Main-page CDP activation of that shortcut selected native viewmode 11 and displayed the native Remote desktop panel. CDP touch dispatch is unavailable in the in-app browser, so this was a page-native programmatic click rather than physical touch acceptance.

No live desktop image was available: MeshCentral reported Disconnected and the backing canvas remained 0×0. Therefore trackpad gestures, keyboard delivery, zoom, fullscreen, landscape RDP input, and physical handset behavior remain unverified. No remote keystrokes, clipboard content, or commands were sent. The web-only handoff fix is covered by a regression against the native inline handler; the full focused suite passes 77/77.

### Server memory units and desktop route review — 2026-11-06

The Night Shift customization now changes only the rendered memory unit label from `Gb` to `GiB` in `#serverMemoryChartText`. It applies to initial content and later native telemetry updates. MeshCentral's byte calculation and displayed numbers remain untouched; GiB matches its repeated division by 1024. A focused script regression checks the initial display, later refresh, and that network-rate text such as `Gb/s` is not rewritten.

Desktop live inspection at 1440×900 found the Server General labels and values readable, including `3.7 Gb free, 15.9 Gb total` before the unit-label correction. The Server State lower rows extend beyond the viewport but are reachable by the page scroll; the nested `#p6info` scroll also remains available at narrower desktop dimensions. No confirmed row clipping or overlap was evidenced, so no layout change was made on that basis. The More → Server failure is still not reproduced by the source harness: the menu invokes the native anchor's `.click()` handler, as does the working direct click. Further live inspection of the native anchor's current `display`, `aria-hidden`, and rights state is needed before altering permissions or route behavior.

Parent live review also found a mobile route-title inconsistency on Server Stats (`viewmode=40` while the appbar says `Workspace`) and a sticky appbar overlapping the top of native Devices controls at 390×844. The appbar now uses MeshCentral's committed `viewmode` as a title fallback when route elements expose no measurable client rects. Below 900px, it returns to normal document flow so native page controls cannot scroll beneath it. Regressions cover both. These source changes await the parent's live portrait/landscape recheck; physical mobile acceptance remains unverified.

### Installed portrait recheck and remote-session boundary — 2026-11-06

The source changes above were installed in snapshot `20261106-161157-b7f52e`; installed CSS and JavaScript hashes match the current source as recorded in [night-shift-deployment.md](night-shift-deployment.md). At 244×542 CSS pixels (DPR 5), `#column_l` and the document both measured 244px wide with no horizontal overflow. The appbar was `position: relative`, beginning at page y107.99 after native masthead/tabs; the device toolbar remained later in normal flow at y1211–1539. At scrollTop 1627.5 the appbar and toolbar had both moved above the viewport, with no overlap. The route-title fallback and no-overflow behavior were covered in this portrait-equivalent live check; physical-device acceptance is still open.

The native remote desktop session connected and was then disconnected, but the remote canvas remained blank/0×0. This confirms session connection and cleanup only; it does not verify a rendered display, touch/trackpad gestures, zoom, fullscreen, keyboard delivery, or physical handset behavior. No remote input was sent. The earlier statements in this section that the responsive appbar changes were awaiting live recheck describe the pre-install state and are superseded by this entry.

### Desktop server, Events, and Account layout follow-up — 2026-11-06

The latest live desktop review identified three additional layout defects. At 1440×901, the short Server Stats page reached its outer scroll limit while `#p40title` remained at y79–133 behind the appbar at y106–180; the chart began at y205. At 1024×768, Events had a separate scrollable `#p3events` list beneath sticky title/filter controls, so the first and last event rows could pass underneath that header. Account overflow came from a Bootstrap `.row` inside `#p2meshes`: the row measured about 879px wide against an 856px parent because of its negative side gutters, which propagated an 8px horizontal overflow to `#p2info`.

Source-only CSS now keeps the desktop Server Stats title sticky below the 74px appbar and increases the chart's flow margin to keep the two from overlapping. On desktop widths, Events title, filters, and records now share the outer workspace scroll; the native fixed event-list height/overflow is overridden without replacing its native controls or row handlers. The direct Bootstrap row under `#p2meshes` is constrained to the parent and its horizontal negative margins are removed, preserving the generated group fields. Focused CSS regressions cover the 901px desktop breakpoint and each native geometry source. No changes were made to transient native notification cards reported above the Users toolbar; their origin was not established, so native notification behavior is unchanged.

The focused Node suite passes 78/78 and `git diff --check` passes. These fixes are not deployed and have not received a live visual recheck; deployment awaits parent review.

## Redmi portrait viewer priority — 2026-11-06

The primary phone target is portrait 1220×2712 physical pixels, approximated by a 244×542 CSS viewport at DPR 5 (1220×2710 physical-equivalent, two pixels shorter due to integer viewport sizing). The mobile remote page originally placed its connection profile and diagnostics before the native viewer, leaving roughly 1,200 CSS pixels of setup content above the canvas. A narrow phone-only layout order now keeps the native viewer immediately after the device title and session strip; diagnostics and profile settings remain available below it in the same scrollable workspace.

During live portrait emulation, the document width matched the 244px viewport and the viewer began at y215 after the title and session strip. The diagnostics panel began at y776 and the connection profile at y1321. Landscape-equivalent 542×244 CSS emulation also had no horizontal overflow, and the mobile dock reserved primary controls while collapsing secondary controls behind More. The in-app browser's click/touch emulation did not reliably activate the dock button, so this verifies responsive layout only.

The diagnostics visibility helper also stopped walking past DOM elements into the `Document` object before calling `getComputedStyle`; the prior TypeError no longer recurred when the action was activated on the installed source. Desktop Stats was rechecked after the final offset adjustment: at the 944×1178 viewport's scroll limit, the title was 1.10px below the appbar and the chart began 5.80px below the title.

No active remote desktop image was available during acceptance. MeshCentral reported the Agent route/control channel as connected, but the viewer remained Disconnected with no active display. Physical Redmi touch gestures, keyboard delivery, zoom, fullscreen and RDP pixels therefore remain unverified; do not infer those from viewport emulation or unit tests. Final installed hashes and rollback snapshot are recorded in [night-shift-deployment.md](night-shift-deployment.md).

## Redmi Note 14 Pro+ portrait visual recheck — 2026-11-06

The requested primary device target is 1220×2712 physical pixels in portrait. Current live emulation used a 393×873 CSS viewport, approximately equivalent at 3.1 device scale. At this width the workspace dashboard stacked without document-level horizontal overflow and the fixed bottom navigation remained in view. A 1440×900 desktop pass was also used to compare the native Files layout.

The live audit reproduced these visual defects: disabled My Files and Device Files actions still appeared bright red; the portrait RDP dock clipped controls at the right edge; the device subtab strip ended at a cut-off tab with no obvious scroll cue; the Server illustration intruded into the Server actions card; and the appbar page title showed an unexplained gray backing block. Source CSS now mutes file/registry actions when native disabled, ARIA disabled, or disabled-class state is set; uses a four-column wrapping touch dock in portrait with 44px controls; shows the subtab horizontal scrollbar affordance; constrains the Server image; and clears inherited appbar title backing.

Source checks pass: `node --test tests/night-shift.test.cjs` (80/80), `node scripts/build-night-shift.js --check`, and `git diff --check`. This record documents live reproduction followed by source-only fixes; no second live visual check or deployment has occurred. Screenshots were inspected through the active browser session but the capture API did not save image files to the repository.

The native PCRN desktop route reached Connected and mounted its canvas after the authorized connection attempt, but the actual display showed “Waiting for user to grant access…”. No remote input was sent and no access consent was granted. Trackpad movement/click, on-screen keyboard delivery, zoom, fullscreen, orientation changes during a live display, and physical Redmi behavior therefore remain open acceptance items. The fresh live screenshot did not expose a usable desktop frame for those checks.

### Software page narrow-screen overflow — 2026-11-06

Follow-up portrait emulation measured `#column_l` at 407px client width and 475px scroll width while the document itself remained clamped. Source inspection found the Software toolbar's `.areaHead` could wrap, but its nested `.d-flex.align-items-center` child could not; the Refresh, fixed-width search, Store Apps checkbox and status fields therefore established a wider minimum width. Narrow-screen CSS now lets that native child wrap, constrains its controls/status, and keeps any generated software table's horizontal scroll local to `#p18html`. A focused regression checks the page's native nested structure and reflow rules. Remote desktop stayed without an active session during this pass, so trackpad, keyboard, zoom, fullscreen, and physical-device acceptance remain open. This is source-only and was not deployed or live-rechecked.

### Software page no-response recovery — 2026-11-06

Authenticated review found the native installed-software status remained in Loading after waiting and using Refresh. Source review showed the Night Shift styling did not intercept the request; the native view can remain loading indefinitely when it receives no usable response, and its Refresh handler refuses to send another request while the native in-flight flag remains true. The additive `software-timeout.js` enhancement now observes only the native Software status/content. After 30 seconds without completion it explains that the device agent did not return usable software data, clears only the native in-flight guard, and leaves the existing Refresh control to retry. It retains the request type so a late native response can still follow MeshCentral's existing response path; it does not create app rows, alter permissions, or send a separate request. Contract coverage checks timeout/retry, success, empty, error and late-response behavior. Source-only; no deployment or post-change live acceptance has occurred.

### Phone landscape remote dock breakpoint — 2026-11-06

Live landscape emulation at 904×407 CSS px (DPR 3) showed the remote canvas scaling while `#ns-mobile-dock` was hidden. The dock's JavaScript mobile predicate stopped at 900px. It now includes short (≤600px), coarse-pointer landscape viewports up to 1024px; matching CSS keeps the dock compact and reserves bottom clearance for the native canvas. A regression covers the 904px phone profile and confirms a fine-pointer desktop landscape remains on native controls. The remote session had no active connection, so dock action behavior in a live session and physical handset acceptance remain open. Source-only; not deployed.

### Portrait remote footer control wrapping — 2026-11-06

At 407×904 CSS px (DPR 3/coarse pointer), the live native Desktop route showed `#deskarea0` at 360px with clipped overflow; its `.areaFoot` was 359px wide but had 418px scroll width, the nested keyboard/input row measured 396px, and `#deskarea4Icons` measured 410px. Portrait-only rules now constrain both direct footer rows: the native shortcut selector, Send/Clipboard/Type/keyboard buttons and input permission control wrap, while the monitor picker/status/tools/share/refresh icon row also wraps within the panel. Existing MeshCentral IDs, inline handlers and permission semantics are preserved; native icon actions retain 44px targets. The focused source regression checks both rows' width and wrapping constraints, touch targets, and native handler markup. Source-only and not deployed; live post-install confirmation and physical-phone acceptance remain pending.

### Device submenu scroll wrapper correction — 2026-11-06

Follow-up review at 407×904 CSS pixels found the first scrollbar rule targeted `#MainSubMenuScrollInner` while upstream's `display:contents` left it at 0×0. The real fixed viewport is `#MainSubMenuSpan`; its native `.mobile-submenu-scroll` child and `#MainSubMenuScrollInner` now form a width-constrained flex row with visible native arrow controls. Only the inner scroller clips/scrolls horizontally, while its height remains content-driven to avoid clipping the tab row vertically. CSS regression checks the actual default3.handlebars nesting, wrapper width/min-width, inner width/flex/overflow, and scrollbar affordance. The fix was installed through the backup-first customization path and live-verified at 407×904 CSS / DPR 3; the accessibility tree exposes both arrow controls and the inner scroller measures 343px client / 644px content width. The full source/installed/live asset match and rollback snapshot are recorded in `night-shift-deployment.md` and the live audit.

### Desktop Users toolbar settings keyboard access — 2026-11-06

The live desktop Users page exposed the native settings glyph as a non-focusable image (`role=img`, `tabindex=-1`) with no accessible name even though it has a MeshCentral `onclick` handler. Night Shift now adds button semantics, the accessible name “User list settings,” keyboard focus styling, and Enter/Space activation by dispatching a click event to the original native element. A document-subtree observer catches the icon when Users content is inserted after initial page load. Both Modern and default template markup are covered by a focused contract test; MeshCentral templates and the native handler are unchanged. The fix is in source and still needs desktop live verification and deployment review.

### Device and Server Console long-line overflow — 2026-11-06

Live desktop review at 1440×900 found `#p15agentConsoleText` wider than its native console pane, expanding the page's horizontal scroll area past the viewport in both Device → Console (`viewmode=15`) and Server → Console (`viewmode=115`). Night Shift now bounds the console cell and `<pre>` to the available `#p15` width while keeping `white-space:pre` and `overflow-x:auto` on the `<pre>`, so long output remains readable through local horizontal scrolling without widening the page. Focused source contracts cover both native template variants and the existing auto-follow behavior. The fix is source-only and awaits live desktop verification and deployment review.
