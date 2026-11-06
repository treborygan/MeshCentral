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
