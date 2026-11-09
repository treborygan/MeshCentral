# Pinned MeshCentral source build

## Purpose

PRN reports MeshCentral 1.3.1. A targeted 2026-11-09 source recheck found `MESHRIGHT_NOFILES` enforcement in several installed files, but not in `meshdevicefile.js`: its agent file-transfer handler lacks the reviewed rights check present in the pinned candidate. The webserver GET route has a separate guard, while its WebSocket route calls `CreateMeshDeviceFile` directly. The installed package also lacks `force2factorPending` and `PerformWSRelayAuth`, the pending-2FA relay-auth path present in the pinned candidate. `scripts/Build-PinnedMeshCentral.ps1` creates a reproducible package from the pinned official upstream revision and adds only the Night Shift CSS/JavaScript override assets. It also includes the upstream security configuration schema that the npm `files` allowlist otherwise omits.

## Pins and safeguards

- Official source: `Ylianst/MeshCentral` commit `2e7ec138cf45b09204bf036b500e5e2cf37aaba4`, version 1.3.1.
- Overlay: an explicitly supplied full Git commit from this repository.
- Optional PRN package reference: version and direct dependency signatures must match before packaging.
- The builder packs the normalized source twice and requires byte-identical SHA-512 integrity, then writes a provenance manifest with source pins and asset hashes.
- Build output must be empty or absent. Temporary source is limited to a uniquely named directory under the system temporary directory and removed after a successful build.
- `tests/Test-PinnedMeshCentralBuild.ps1` checks source and overlay provenance, dependency comparison state, security markers, schema inclusion, integrity, reproducibility and byte-identical overlay assets.

## Verification

On 2026-11-05, the builder completed twice against the pinned official source. The package contained `MESHRIGHT_NOFILES`, `force2factorPending` and `meshcentral-config-schema.json`; the two package archives had identical SHA-512 integrity. The packaged CSS and JavaScript matched the selected overlay commit.

The candidate was installed with `npm ci --offline --ignore-scripts --no-audit` in a disposable copy of PRN's package manifests. All 168 lockfile entries installed, the existing direct dependency set was preserved, and `node meshcentral.js --help` succeeded. Six principal server entry/source files passed `node --check`.

A first-start smoke test used only synthetic data under the system temporary directory, bound HTTPS to `127.0.0.1:12443` and redirection to loopback, disabled optional default-agent downloads, returned HTTP 200 for the synthetic login, and stopped the staged server. It did not connect to PRN devices or use production configuration or databases.

## Production status

This artifact is not installed on PRN. The 2026-11-09 read-only recheck found the file/share right enforced at several installed paths, but the agent file-transfer handler in `meshdevicefile.js` lacks the `MESHRIGHT_NOFILES` guard present in the pinned candidate. The `webserver.js` GET route is guarded, but its WebSocket registration calls the handler directly. The installed package also lacks the `force2factorPending` / `PerformWSRelayAuth` path present in the candidate; the force-2FA UI flag alone does not prove relay-auth enforcement. Installed package version remains 1.3.1, and its file contents do not prove source provenance. The production package-security gate therefore remains blocked. The staged candidate is pinned to upstream commit `2e7ec138cf45b09204bf036b500e5e2cf37aaba4`; as of 2026-11-09, the [official release page](https://github.com/Ylianst/MeshCentral/releases) still lists 1.3.1 as the latest tagged release, while [upstream master history](https://github.com/Ylianst/MeshCentral/commits/master) includes later changes, including a Nov 7 compression 1.8.2 CVE update. Refresh and re-review the candidate pin and dependency set before any eventual package deployment. The currently authorized deployment boundary limits production deployment to verified frontend overrides through `scripts/Install-NightShift.ps1`; PRN's existing package, configuration, database, agents and services remain unchanged. Before any backend package replacement, preserve the package manifests and installed package for rollback, verify the exact artifact and dependency diff, and schedule a MeshCentral-only restart. Do not treat this source-build candidate as proof that production security behavior has changed.

Historical CI state (2026-11-05): a push run for commit `d6577919` failed in CodeQL's SARIF upload with `Resource not accessible by integration`; the PR CodeQL and Night Shift checks passed. The CodeQL workflow was updated to grant the scan job `contents: read` and `security-events: write` and use CodeQL Action v4. An earlier manual dispatch returned HTTP 422 `Actions has been disabled for this repository`; that response did not explain the prior push-run failure or prove a global Actions disablement.

Current PR #4 check state (2026-11-09): at head `17b6a5461cc97a3f4270f2e116e9e38132776abb`, GitHub reports success for `ui-syntax` (including generated-bundle and Node contract tests), `windows-installer-parse` (including the disposable install/rollback fixture), `pinned-source-security-build`, and CodeQL with no new alerts. This verifies the pinned candidate build workflow and frontend source checks, not the production package or live device behavior. The source candidate remains undeployed and the production package-security gate remains blocked.
