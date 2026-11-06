# Night Shift live UI audit — 2026-11-06

## Scope and setup

- Live authenticated site: `https://rdp.treborygan.dev`.
- Primary phone target: Redmi Note 14 Pro+ portrait, 1220 × 2712 physical pixels. Responsive emulation used 407 × 904 CSS pixels at DPR 3 for the final measurement pass; 393 × 873 CSS pixels was also visually reviewed. Screenshots at DPR 1 preserved the CSS layout for visual inspection because high-DPR screenshot capture timed out on the live page.
- Desktop reference: 1440 × 900 CSS pixels.
- Live source, installed, and fetched asset hashes were compared after deployment; services remained running. No server, database, agent, tunnel, device, or permission settings were changed.
- Source fixes were implemented and deployed through the existing backup-first web customization path. Details and the rollback snapshot are recorded in `docs/night-shift-deployment.md`.

## Reproduced findings

### NS-AUD-01 — Disabled file actions look destructive and enabled (P1)

- Routes: My Files (`?viewmode=5`) and Device Files (`?viewmode=13`).
- Reproduction: open either page with no file selection (Device Files also with its file connection disconnected) at 393 × 873 and 1440 × 900.
- Actual: controls announced as disabled, including Rename, Delete, Edit and, on Device Files, New Folder, New File, Upload, Download, Cut, Copy, Paste, Zip, Unzip, Refresh, Find, GoTo, and Open, render in bright red danger styling. Some grey disabled controls sit beside the red controls, making disabled state especially inconsistent.
- Expected: disabled actions use a subdued disabled appearance; only enabled destructive actions use danger color. Existing CSS has a disabled-danger rule, but live rendering shows that it is ineffective for these controls and needs a computed-style/cascade check.

### NS-AUD-02 — Remote desktop touch dock clips controls in portrait (P1)

- Route: PCRN Remote Desktop (`?viewmode=11&gotonode=…`).
- Reproduction: at 393 × 873 portrait, connect via the native Connect action and inspect the fixed touch dock.
- Actual: the first dock row extends beyond the right edge; the Right-click mode control is visibly clipped. The secondary row also exceeds the available width, cutting off part of the last action. The dock has no visible scroll cue.
- Expected: all primary and secondary touch actions remain discoverable and usable with phone-sized touch targets, without horizontal clipping.
- Limitation: MeshCentral reported “Waiting for user to grant access…” in the remote display. I did not interact with the remote machine or grant consent, so trackpad motion, touch input, keyboard delivery, zoom, and fullscreen with an active display remain unverified.

### NS-AUD-03 — Server illustration overlaps the actions card on phone (P2)

- Route: Server → General (`?viewmode=6`).
- Reproduction: inspect the first viewport at 393 × 873 portrait.
- Actual: the server-and-lock illustration overlaps the upper-right area of the Server actions card and sits across the title/card boundary.
- Expected: the image has its own reserved space or scales/repositions so it never obscures the heading or card content.

### NS-AUD-04 — Device subtab strip is clipped with no swipe cue (P2)

- Routes: PCRN device subpages (General, Desktop, Terminal, Files, Registry, Software, Events, Details, Console).
- Reproduction: inspect the tab strip at 393 × 873 portrait.
- Actual: only the first few tabs are visible; the remaining subpages continue off the right edge without an obvious scroll cue.
- Expected: all subpages remain discoverable through an indicated horizontal scroller or compact menu, while preserving native page tabs.

## Checked without a confirmed defect

- Workspace portrait document/body widths matched the 407 CSS-pixel viewport (no page-level horizontal overflow in the measured state).
- The main workspace content wrapped after the route settled. The appbar briefly showed the previous route title immediately after mobile navigation, then updated to the current route; this was transient and is not listed as a confirmed defect.
- Server statistics fit the portrait column on scroll; the memory value remained readable on one line in the observed state.
- Fullscreen and direct pointer/keyboard testing could not be accepted because the remote display was waiting for user consent. No physical Redmi device input test was performed.

## Follow-up verification and disposition — 2026-11-06

The four portrait findings above have deployed fixes: disabled file actions now look disabled, the touch dock wraps without clipping, the Server illustration clears the actions card, and the device tab strip exposes horizontal scrolling controls. The checked portrait pages retain a 407px document width at 407×904 CSS px / DPR 3.

Additional review findings and outcomes:

- Users settings icon: fixed and live-verified as a named, keyboard-focusable button; Enter opens the existing native settings dialog and Cancel closes it.
- Device and Server Console text overflow: fixed in the shared native console pane. The deployed Device Console at 1440×900 remains within document width 1440 and scrolls the long `<pre>` internally. Server Console has a source regression contract; live Server Console was not separately revisited after install.
- Software narrow-screen overflow: fixed and live-verified; at 407px portrait width its toolbar wraps and `#column_l` stays 407px wide. The native software status still showed loading, so software enumeration remains unresolved.
- Phone landscape dock: fixed and live-verified at 904×407 CSS px with coarse-pointer emulation; the fixed dock is visible and its primary controls fit. Fine-pointer desktop landscape is excluded by the source breakpoint.
- Server statistics, Events, Files, Account, Users, Server overview, and device General/Terminal/Files/Registry/Software/Events/Details/Console routes were included in the responsive route pass; no page-level horizontal overflow was observed on the sampled viewports.

The remote viewer still did not establish an active session after Connect. Trackpad movement/click, right-click gestures, keyboard delivery, zoom, fullscreen while connected, live RDP pixels, and physical Redmi hardware remain unverified. The tests and emulation establish frontend behavior and layout only, not full production acceptance of every MeshCentral feature.

`docs/night-shift-deployment.md` records the installed asset hashes, HTTP asset response, service status, and rollback snapshot. No backend, configuration, database, agent, service, or Cloudflare infrastructure was changed.

## Evidence note

The live screenshots were inspected through the authenticated Chrome computer-use surface. Its screenshot adapter does not currently provide a local file path or filesystem export, so this report records exact routes, viewports, and reproduction steps rather than embedding image files.

## Portrait fix verification — 2026-11-06

The latest UI fixes for the reproduced findings are installed and were checked on the live site at 407 × 904 CSS pixels / DPR 3. The target viewport matches the Redmi Note 14 Pro+ portrait dimensions (1220 × 2712 physical pixels at roughly 3× density).

- NS-AUD-01: Device Files toolbar and selection-detail buttons that MeshCentral marks disabled now render muted; live `Delete` reports `disabled: true`, foreground `rgb(145, 160, 168)`, background `rgb(38, 49, 57)`.
- NS-AUD-02: Portrait touch dock uses a wrapping four-column layout with 44px targets. A prior live portrait screenshot showed all touch actions within the viewport. This verifies layout only, not remote input delivery.
- NS-AUD-03: Server illustration is constrained to its available header space; a live geometry check showed it ended above the Server actions card with no overlap.
- NS-AUD-04: Live accessibility tree exposes “Scroll left” and “Scroll right”. `#MainSubMenuScrollInner` measures 343px client width / 644px scroll width, `overflow-x:auto`, `scrollbar-width:thin`; document and body widths both remain 407px.
- The title backing is the dark appbar canvas (`rgb(16, 24, 33)`), with no unexplained gray block.

Live `/styles/custom.css` and `/scripts/custom.js` both returned HTTP 200 with `Cache-Control: public, max-age=0, no-store` and Cloudflare `BYPASS`. Their SHA-256 values exactly match both source and installed files. Rollback snapshot and hashes are documented in `docs/night-shift-deployment.md`.

The 80-test focused Node suite, generated bundle check, and `git diff --check` pass. This was browser emulation, not testing on a physical Redmi. Remote display remained consent-gated; trackpad/pointer gestures, keyboard delivery, zoom, fullscreen, and orientation changes during an active display remain unverified on a live session. Landscape and non-RDP page regressions have responsive source contracts, but this final live verification pass prioritized portrait.

## Server General scroll review — 2026-11-06

### NS-AUD-05 — Memory value clips at the fixed Server subtab boundary (P2)

- Route: Server → General (`?viewmode=6`).
- Reproduction: on the authenticated page, scroll down through the General content to the Server State rows, then return to the top.
- Actual: at the top, Memory and Server State are readable. At the lower scroll position, the Memory value is visible only as a narrow sliver immediately below the fixed Server subtab row; Server State remains readable. Scrolling back up restores the normal layout.
- Evidence: screenshot captured from the current authenticated Chrome page showed both scrollbars at the lower position and the partial Memory value. The screenshot adapter did not save a local image. Reported screenshot dimensions were 1148×505 px; CSS viewport dimensions were not measured during this pass.
- Source cause: the upstream template assigns `#p6info` a viewport-sized height and its own overflow, while Night Shift also makes `#column_l` scrollable. The resulting nested desktop scroll lets content slide under the persistent workspace header.
- Source fix: desktop `#p6info` now uses automatic height and visible overflow so `#column_l` is the sole vertical scroller. A focused regression covers the native inline height and source override. The fix was installed in rollback snapshot `20261106-192919-07f4c0` and live-retested at 1148×505; the Memory value and Server State rows remained readable while scrolling. Verified for this desktop viewport; mobile and other viewport sizes remain open.

### NS-AUD-06 — Disabled Users bulk action looks active (P2)

- Route: Users (`?viewmode=4`).
- Reproduction: open My Users with no rows selected; the list was filtered to a synthetic no-match query so personal rows were not shown in the capture.
- Actual: `Group Action` is disabled in the accessibility tree but renders bright red, while nearby controls use distinct primary/secondary treatments.
- Expected: a disabled action is visibly subdued and is distinguishable from enabled primary actions.
- Evidence: current authenticated Chrome screenshot at 1148×505 showed the empty result state and red action button; AX identified it as a disabled button. The screenshot adapter did not save a local file.
- Source fix: disabled `GroupActionButton`, `UsersGroupActionButton` and `UsersGroupsGroupActionButton` are now given a muted surface style. Native disabled attributes, click handlers and enabled primary appearance are unchanged. A focused test covers all three. Installed in rollback snapshot `20261106-192919-07f4c0` and live-retested at 1148×505; the disabled Users Group Action rendered muted.

### NS-AUD-07 — More menu clips its last action in a short viewport (P2)

- Route: any Night Shift workspace with the appbar More control open.
- Reproduction: at the current 1148×505 browser screenshot size, open More and inspect the popover's last action.
- Actual: Devices, Events, Files, Account, Users and Server are visible, while “Switch to the native Classic MeshCentral UI” extends below the viewport. Scrolling over the popover did not reveal the last action; Escape closed the popover.
- Expected: every available route and the Classic UI action remain visible or reachable through a contained, indicated popover scroller.
- Evidence: authenticated Chrome screenshots showed the Classic UI action clipped at the lower viewport edge; AX continued to expose it. Screenshot pixels are 1148×505, and CSS viewport size was not independently measured.
- Source fix: the popover now has a viewport-relative maximum height, a thin visible scrollbar and contained vertical scrolling. Native menu links and the Classic UI handler are unchanged. A focused CSS regression covers the height bound and scrolling. Installed in rollback snapshot `20261106-192919-07f4c0` and live-retested at 1148×505; scrolling the popover exposed the Classic UI action.

### NS-AUD-08 — Device Console title clips behind sticky headers on scroll (P2)

- Route: Device → Console (`viewmode=15`).
- Reproduction: at the current 1148×505 browser screenshot size, scroll down in the console workspace.
- Actual: the native `Console - [device]` title/back row slides beneath the appbar/device subtabs and is partially clipped; the console pane and lower input/Clear controls remain reachable.
- Expected: the native title and back control stay readable below the sticky appbar while scrolling.
- Evidence: authenticated Chrome screenshot at the lower scroll position. Screenshot pixels are 1148×505; CSS viewport size was not independently measured. Screenshot adapter did not save a local image.
- Source fix: desktop `#p15title` sticks below the appbar on an opaque canvas surface, below the appbar layer. The native back handler, console input, and clear control remain present. A focused source regression was added. Installed in rollback snapshot `20261106-192919-07f4c0` and live-retested at 1148×505; the title/back row stayed visible while scrolling to the input.

## Desktop fixes deployed and live-retested — 2026-11-06

- Installed the source CSS/JS using `scripts/Install-NightShift.ps1` against the existing PCRN MeshCentral root. The installer created rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-192919-07f4c0`; its manifest confirms both prior overrides existed and records their original SHA-256 values.
- Only `meshcentral-web/public/styles/custom.css` and `meshcentral-web/public/scripts/custom.js` changed. Local HTTP returned 200 for both, with exact response bytes matching the installed files. CRLF-normalized content matches the source. MeshCentral and MeshCentralCloudflared remained running; no restart or server-side configuration, database, agent, tunnel, or permission change occurred.
- After reloading the authenticated desktop page at the available 1148×505 screenshot size, NS-AUD-05's Memory card value and Server State rows were readable while scrolling the single workspace; NS-AUD-06's disabled Users Group Action rendered muted; NS-AUD-07's More popover scrolled internally to reveal the final Classic UI action; and NS-AUD-08's Device Console title stayed fully visible below the fixed header while scrolling to the console input.
- This verifies those desktop visual fixes at the available browser size. It does not complete mobile portrait/RDP session, pointer, keyboard, zoom, fullscreen, landscape, role/plugin, or physical Redmi acceptance checks.

### NS-AUD-09 — Device Details Refresh has no visible request feedback (P2)

- Route: Device → Details (`viewmode=17`).
- Reproduction: activate the native “Refresh details information” icon while the Details page is already populated.
- Actual: the icon sends MeshCentral's `msg/sysinfo` request but displays no pending, completion, or failure state in the current page.
- Source evidence: upstream `refreshDetails()` only calls `meshserver.send({ action: 'msg', type: 'sysinfo', nodeid })`; it has no direct result callback. A later `getsysinfo` response invokes `updateDeviceDetails()` for the active node, which is observable. No explicit error response was found in the page handler.
- Source fix: Night Shift adds an accessible in-page status without replacing the native request. It shows pending state, a “no response yet” retry hint after 12 seconds, and a response message only when the native details update is observed for the same node. It does not claim a failure on timeout. A focused regression covers these states. Installed in rollback snapshot `20261106-195356-b9be0d` and asset hashes verified over loopback HTTP. Live visual and delayed-response recheck remain pending.

### NS-AUD-09 installation update — 2026-11-06

The tested Device Details refresh feedback is installed in the existing web customization overlay. Backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-195356-b9be0d`. Source, installed files and loopback HTTP responses match exactly; both assets return 200. The focused suite passes 92/92. The authenticated browser was already on Desktop when installed, so its Details status was not visually rechecked after installation. Keep the live pending/timeout/response UI check open.

### Mobile live gate — 2026-11-06

At the available portrait browser viewport (screenshot dimensions were not independently measured; not verified at the requested 407×904 CSS px or on a physical Redmi), the complete remote dock is visible and wraps within the page. The MeshCentral session and Agent route report connected, the canvas is mounted, but the native canvas reads “Waiting for user to grant access…”. Input controls therefore remain consent-gated. No remote keystrokes or pointer gestures were sent. Trackpad/pointer, keyboard, zoom, fullscreen, landscape rotation and physical Redmi acceptance remain unverified pending target-side consent/device testing.

## Separate site-wide source review — 2026-11-06

A separate review of the current branch, audit ledger, desktop CSS/route tests and UI/deployment notes found no additional confirmed source defect beyond the tracked findings. The existing issue inventory for the handoff is:

| Finding | Status |
| --- | --- |
| NS-AUD-01 — disabled file actions styled as enabled/dangerous | Fixed, deployed, portrait checked |
| NS-AUD-02 — portrait RDP dock clips touch controls | Fixed, deployed, layout checked; input remains unverified after a black/disconnected live session |
| NS-AUD-03 — Server illustration overlaps actions card | Fixed, deployed, portrait checked |
| NS-AUD-04 — device subtabs lack a discoverability cue | Fixed, deployed, portrait checked |
| NS-AUD-05 — Server General nested scroll clips Memory | Fixed, deployed, desktop live-retested |
| NS-AUD-06 — disabled Users bulk action looks active | Fixed, deployed, desktop live-retested |
| NS-AUD-07 — More menu clips its last action at short heights | Fixed, deployed, desktop live-retested |
| NS-AUD-08 — Device Console title scrolls behind sticky shell | Fixed, deployed, desktop live-retested |
| NS-AUD-09 — Device Details refresh lacks feedback | Implemented and deployed; live UI pending/response check remains open |
| Shared Device/Server Console long-line overflow | Source fix and Device live check recorded; separately verify Server Console route |
| Software page remains in loading state | Native behavior unresolved; no confirmed design defect |

The review ran `node scripts/build-night-shift.js --check`, `node --check public/scripts/custom.js`, and `node --test tests/night-shift.test.cjs`; all passed, with 93/93 tests. The mobile browser remained behind a live Windows User Consent prompt for remote desktop control, so interactive gestures and remote keyboard tests were not attempted.

## Approved typography correction deployed — 2026-11-06

The separate review traced the Avenir-first CSS to an unapproved typography change that followed the overused-font hook. The approved Concept B HTML explicitly specifies the Inter-first system stack. The separate agent restored that exact stack and added a regression comparing the CSS declaration with the approved concept source. It was installed through the backup-first customization path with rollback snapshot `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-200601-25becc`. CSS and JS source/installed/HTTP response hashes match, and both asset routes return 200; services remain running. No font asset or external import was added. A hard-refresh live font check remains pending.

## One-time remote session acceptance attempt — 2026-11-06

After the user chose one-time approval, the authenticated page reported `Remote session connected` and `Canvas mounted`; the screenshot remained black with no target desktop pixels. Approximately 1 minute 21 seconds later the page showed `Remote session ready` / `No active session`. No remote pointer or keyboard input was sent. Do not infer that touch, trackpad, keyboard, zoom or fullscreen work from the connection status. The user authorized only this request, so another session request needs fresh authorization.

## NS-AUD-10 — Landscape device tabs are not discoverable on a phone (P2)

- Route: Device → Desktop or any device subpage showing the native tab strip.
- Reproduction evidence: authenticated narrow-landscape browser review showed General through Events, with Details and Console beyond the visible edge; a swipe on the strip and a gesture over its enclosing area did not move it. CSS viewport dimensions were not independently recorded.
- Source cause: the arrow buttons, horizontal touch scroller and scrollbar cue were enabled only in a `max-width:900px` portrait media rule. At 904 CSS px (the 2712×1220 target at DPR 3), even the generic max-width 900px scroller constraints do not apply. The wide native table is clipped by its ancestors.
- Source fix: submenu controls now use a coarse-pointer rule through 960px in both orientations, so the native left/right buttons, horizontal `overflow-x:auto`, touch-pan behavior and visible scrollbar apply at the 904px landscape target. The portrait-only remote dock grid remains in its original portrait rule.
- Verification: a source regression checks the 960px coarse-pointer breakpoint and retained native wrappers/scroll handler. The 93-test suite, bundle, syntax and diff checks pass. Not deployed; authenticated landscape retest at 904×407 CSS px/DPR3 remains required.

## NS-AUD-10 installation and mobile retest — 2026-11-06

NS-AUD-10's coarse-pointer submenu scroller was installed via `scripts/Install-NightShift.ps1` after a successful dry run. Backup: `C:\ProgramData\MeshCentral\meshcentral-web\.night-shift-backups\20261106-202234-9d6d7b`. CSS and JS source/installed/loopback HTTP response SHA-256 values match; both assets returned 200. MeshCentral, MeshCentralCloudflared and Mesh Agent remained running; no service restart or backend, agent, config, database, tunnel or permission change occurred.

After an authenticated reload in Chrome Pixel 10 emulation (412×924 CSS px portrait), the Remote Desktop route and mobile dock were present. The remote session was disconnected, so remote input controls remained disabled and no pointer or keyboard events were sent. The 904×407 landscape responsive viewport was available, but coarse-pointer tab scrolling was not conclusively exercised in that orientation. Treat exact landscape and physical Redmi acceptance as open. The 93-test Node suite, generated bundle check, JS syntax check and `git diff --check` pass.
