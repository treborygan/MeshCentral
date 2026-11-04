# Night Shift 2 — structural, live-data UI integration

Branch: `feature/night-shift-structural` (built on `fix/night-shift-mobile-layout`).

## Scope and implementation boundary

This slice extends the existing `custom.js` and `custom.css` overrides without replacing MeshCentral templates, services, agents, database, authentication, Cloudflare integration, or transport protocol. It adds a structural layer around **real** MeshCentral DOM and native handlers. It is not the standalone HTML prototype, and it does not use any data from its sample fleet.

Included:
- Contextual workspace appbar with live page title, native navigation search, and a functional More menu exposing only original account-accessible sections.
- Responsive overview in the real Devices page: status-free live inventory summary, actionable links to existing pages, clear provenance, and no fake events/devices/connection counts.
- Quick device actions using native Desktop, Terminal and Files handlers. Advanced device tabs, plugins, permissions and original controls remain available.
- Contextual remote-session strip with connection text derived from MeshCentral's existing Disconnect control. Original canvas, RDP, AMT, terminal, keyboard and other session implementations remain untouched.
- Navy/green Night Shift composition for desktop/tablet/phone, accessible labels, focus, reduced-motion styling and mobile session-first chrome.
- Existing mobile touch controls, command search, login2 theming and viewport corrections inherited from previous PRs.

The actual browser must supply MeshCentral's expected IDs. Components are created only after authenticated markup exists. When the corresponding native section or permission-gated control is absent, enhanced actions are withheld. Live session and rendered inventory state are derived from existing DOM and never asserted from mocks.

## Important limits

- A full screenshot-matched replacement of the native list/group/user/server templates is **not yet proven**. These screens are restyled upstream views with additive components, not a complete independent application.
- Core MeshCentral behavior is preserved by delegation, but end-to-end Agent desktop, browser RDP, terminal, file transfer, Android gestures, Intel AMT, guest sessions, recordings, plugins and restricted-role workflows still require real authenticated browser acceptance.
- The count labeled *Rendered device rows* is only the number of loaded checkbox rows currently in the page, **not** the authoritative number of all managed devices. If unavailable, a dash is shown rather than a guessed value.
- A synthetic DOM contract test verifies the UI shell, native navigation and populated device-row count; it does not validate a live browser or remote-control session.
- **No PCRN deployment has been made from this branch.** The previously installed Night Shift CSS/JS may still be live; do not infer that the new structural layer is present.

## Deploying safely to PCRN

Use the existing `scripts/Install-NightShift.ps1` deployment/rollback workflow and the same **verified** MeshCentral root (`C:ProgramDataMeshCentral`). Preserve `meshcentral-data`, certificates, service, Cloudflare Tunnel and Access, database and installed agents.

1. Inspect working-tree changes and confirm the checked-out branch is `feature/night-shift-structural`.
2. Preserve the existing rollback archive (the original pre-Night-Shift backup is documented in `night-shift-deployment.md`).
3. Run the installer with the actual root and confirm the new backup path and both override asset hashes.
4. Test live login, permissions, desktop/device list, Android viewport, genuine MeshAgent and browser RDP sessions, terminal, file transfer, account/admin and session toolbar.
5. If there is any regression, use the exact backup path printed by the installer to restore both assets. Hard-refresh to avoid cached files.

## Verification

- `node --check public/scripts/custom.js`
- `node --test tests/night-shift.test.cjs`
- CI checks JavaScript, native delegation and PowerShell parsing.

Never mark the release accepted based solely on passing source contracts. Real authenticated browser testing on the actual PCRN server is required before merging and making a production claim.
