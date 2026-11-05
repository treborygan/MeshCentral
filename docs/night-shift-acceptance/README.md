# Night Shift screenshot evidence

These Playwright Chromium captures were taken from an earlier PRN override at `http://127.0.0.1:9455/`:

- `prn-login-mobile-390x844.png` — unauthenticated login surface at a 390×844 viewport.
- `prn-login-desktop-1440x900.png` — unauthenticated login surface at a 1440×900 viewport.

These committed images are historical and do not establish current-branch acceptance. On 2026-11-05, the deployed commit `1781be93` was separately rendered in Chrome 156 at 390×844 and 1440×900; the login route and both current override assets returned 200, there was no horizontal overflow or browser console error, and no credentials were entered. Those latest captures are kept outside the repository. This remains unauthenticated login evidence and does not establish authenticated dashboard or remote-session acceptance.

## Approved visual reference

`Concept-B-Night-Shift-Approved.html` is the **user-approved Night Shift / Concept B** interactive HTML prototype. It is a byte-preserving adaptation of `MeshCentral_UI_Concepts.html` except for making Night Shift the initial selected concept, opening its Desktop screen, and setting the dark browser theme color. It includes simulated devices, actions and remote sessions **for design reference only**; never use its mock data or handlers in production. Open this local HTML file directly in a browser to inspect the approved shell, colors, navigation, device cards, session viewer, settings and responsive modes. Acceptance should compare the running authenticated MeshCentral UI against Concept B at 390×844, tablet and desktop viewports, while retaining genuine native authorization and transport behavior. This reference does not itself provide authenticated PCRN/device access or constitute acceptance evidence.
