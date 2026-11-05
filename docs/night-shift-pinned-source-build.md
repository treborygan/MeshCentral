# Pinned MeshCentral source build

## Purpose

PRN reports MeshCentral 1.3.1, but its installed package does not contain the reviewed file-permission and forced-two-factor fixes present in the official upstream source. `scripts/Build-PinnedMeshCentral.ps1` creates a reproducible package from the pinned official upstream revision and adds only the Night Shift CSS/JavaScript override assets. It also includes the upstream security configuration schema that the npm `files` allowlist otherwise omits.

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

This artifact is not installed on PRN. The currently authorized deployment boundary limits production deployment to verified frontend overrides through `scripts/Install-NightShift.ps1`; the live package provenance gate therefore remains open. PRN still runs its existing MeshCentral package, configuration, database, agents and services. Before any backend package replacement, preserve the package manifests and installed package for rollback, verify the exact artifact and dependency diff, and schedule a MeshCentral-only restart. Do not treat this source-build candidate as proof that production security behavior has changed.

GitHub Actions currently reports repository permissions enabled and the workflow active, while workflow dispatch returns HTTP 422, `Actions has been disabled for this repository.` The workflow now runs for every update on the two feature branches and all pull request updates, including documentation-only changes. Current-head hosted CI remains unverified until GitHub allows the workflow to execute.
