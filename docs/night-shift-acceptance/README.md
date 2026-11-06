# Night Shift screenshot evidence

Current Playwright Chromium captures were taken on 2026-11-05 from PRN through the existing loopback listener at `http://127.0.0.1:9455/`. The page was unauthenticated; no credentials were entered.

- `prn-login-mobile-390x844.png` — login surface at 390×844.
- `prn-login-tablet-768x1024.png` — login surface at 768×1024.
- `prn-login-desktop-1440x900.png` — login surface at 1440×900.

All three returned HTTP 200, loaded the current CSS and JavaScript overrides, had document width equal to viewport width, and produced no page errors. These captures confirm only the responsive login surface. They do not show the authenticated dashboard, native device workflows or remote desktop viewer, and do not count as acceptance against the full Concept B reference.

## Priority portrait target

The primary phone target is the Redmi Note 14 Pro+ portrait screen at 1220×2712 physical pixels. At a device scale factor of 3, this is approximately 407×904 CSS pixels; browser zoom and system display scaling can change the effective CSS viewport. The source contract test checks that this width selects the mobile portrait rules and that the complete remote dock stays available without a separate expansion step. This is not a screenshot or a physical-device test. Authenticated Android portrait rendering and actual remote desktop display/input remain open acceptance gates.

`Concept-B-Night-Shift-Approved.html` is an illustrative design reference. Its demo data and handlers are not production behavior. Acceptance still requires authenticated MeshCentral screenshots at phone, tablet and desktop sizes and live native-session workflows.
