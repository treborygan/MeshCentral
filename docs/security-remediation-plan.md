# MeshCentral package security remediation plan

**Status:** an isolated, provenance-pinned candidate is built and smoke-tested. Authorization acceptance remains open. No production server package, configuration, database, certificate, agent, service, or security setting has been changed.

## Scope and production boundary

Keep this work separate from Night Shift PR #4 and its frontend-only deployment scope. Production remains on the existing MeshCentral 1.3.1 package. Do not replace it or restart the service until a separately reviewed candidate passes isolated staging and the user explicitly authorizes production replacement.

## Verified starting point — 2026-11-09

- Production package reports `meshcentral@1.3.1`; its installed source files were previously matched to the lockfile tarball. This establishes package integrity against that lock, not upstream-source provenance.
- The official repository's latest release/tag remains 1.3.1 at `f436143527458d56da0336ea3047c006703fb4e4` ([official release page](https://github.com/Ylianst/MeshCentral/releases)).
- Official upstream `master` is `72e40656fcd153226a5af70e2f6e0ea9326ef3ea`. It is active unreleased source and must not be described as the latest released package.
- Read-only inspection found `MESHRIGHT_NOFILES` checks at several installed paths but not in the direct Agent transfer handler in `meshdevicefile.js`; the guarded HTTP GET route does not prove that the handler's direct WebSocket entry is guarded.
- Installed `meshrelay.js` lacks pending-2FA enforcement. Upstream `master` contains `force2factorPending` checks in `meshuser.js` and `webserver.js`; the actual relay authentication path and bypass resistance still need a complete call-path review. Do not accept marker presence alone as proof.
- Upstream master contains additional server and Agent command-right checks absent from the reviewed installed 1.3.1 files. The Nov 4 pinned source candidate predates those changes.
- Production root dependency overrides already supply several newer dependencies, including `compression` 1.8.2. Preserve the current override set unless a full audited package/lock comparison justifies a change.

## Candidate build and isolated staging — 2026-11-09

- Built official source commit `72e40656fcd153226a5af70e2f6e0ea9326ef3ea` with Night Shift overlay commit `73291e23f746cff8a9e9eb76cf54b49aade4ef37`. The package archive and provenance manifest are in `artifacts/upstream-72e40656/`.
- Candidate package remains `meshcentral@1.3.1`; upstream now requires Node `>=22.21.1` (the staging host uses Node 26.13.0).
- Repeated source packing produced identical bytes. Archive SHA-256: `6A7F6B0122A6DF077B141D7E106CC1464A10B1C8C714BE1477FC50AA5C6499E9`. npm integrity: `sha512-tHpJnc23J4pUC00EzzcWgAoCETHPxPWfOMYUq4NF+ZKPWarELAMHSvAEEzk6jrsoLkjj5NLo+wikk+v5BJK22w==`.
- Upstream lock comparison against the 1.3.1 release: 181 package entries in the release, 147 in current upstream; no additions, 34 removals, and 9 changed package entries. The 34 removed lock entries are `@isaacs/cliui`, `@pkgjs/parseargs`, `ansi-regex`, `ansi-styles`, `color-convert`, `color-name`, `cross-spawn`, `eastasianwidth`, `emoji-regex`, `foreground-child`, `is-fullwidth-code-point`, `isexe`, `jackspeak`, `package-json-from-dist`, `path-key`, `shebang-command`, `shebang-regex`, `signal-exit`, `string-width`, `string-width-cjs` and its nested `ansi-regex`, `emoji-regex`, and `strip-ansi`, `strip-ansi` and `strip-ansi-cjs` with its nested `ansi-regex`, `which`, `wrap-ansi`, `wrap-ansi-cjs` with its nested `ansi-regex`, `ansi-styles`, `emoji-regex`, `string-width`, and `strip-ansi`. Changed versions: `balanced-match` 1.0.2→4.0.4, `brace-expansion` 2.1.7→5.0.12, `compression` 1.8.1→1.8.2, `express-handlebars` 7.1.3→8.0.5, `glob` 10.5.0→13.0.7, `lru-cache` 10.4.3→11.5.3, `minimatch` 9.0.9→10.2.6, `node-forge` 1.4.0→1.4.1, and `path-scurry` 1.11.1→2.0.2. Upstream direct dependencies changed for `compression`, `express-handlebars`, and `node-forge`.
- An offline `npm install` in a temporary staging copy passed. The existing overrides resolved to `compression` 1.8.2, `express` 4.22.3, `express-handlebars` 9.0.4, `node-forge` 1.4.2, `qs` 6.17.1, `glob` 14.0.3, and `minimatch` 11.0.2. Candidate CLI help passed, and `node --check` passed for all 269 packaged JavaScript files.
- With a synthetic configuration, the candidate started an HTTPS listener bound to `127.0.0.1` on an ephemeral port; a loopback TCP connection succeeded. Ctrl+C reached MeshCentral's shutdown handler and printed `Server Ctrl-C exit...` (the PTY reported process exit status 1, so a clean zero-status exit is not claimed).
- First startup fetched the package's default agent files into the disposable staging area despite `--noagentupdate`. That staging state is under the user's temporary directory and is separate from production. Cleanup was attempted but the local command policy rejected recursive removal; this residual temporary state is not evidence of production changes.
- The build fixture passed pinned upstream/overlay provenance, packaging of reviewed marker files and schema, the direct dependency delta, reproducible archive integrity, and Night Shift asset hashes. These are source/package checks; they do **not** prove authorization behavior.
- Not run: end-to-end denied/permitted tests for direct Agent file transfer, pending-2FA relay entry/resume, or command-right enforcement. Not run: live agent, browser remote-control, database restore, or service-level tests. The candidate is not release-ready.

## Focused authorization boundary contracts — 2026-11-09

Official GitHub API reads reconfirmed that `72e40656fcd153226a5af70e2f6e0ea9326ef3ea` is current upstream `master` and has a valid GitHub signature; `/releases/latest` still resolves to tag `1.3.1` at `f436143527458d56da0336ea3047c006703fb4e4`. This is unreleased source for a same-version package candidate, not evidence of a new published release. The upstream branch currently includes Nov 9 security-rights work in addition to the Nov 2 file-sharing enforcement and Nov 7 dependency updates. The existing exact-source candidate remains pinned to current `master`.

Added `tests/security-boundaries.test.cjs`, a local Node contract suite that executes extracted production function bodies with isolated mocks. It verifies:

- Direct `devicefile.ashx` tunnel initiation denies No Files and missing remote-control rights, and permits file-capable and administrator rights.
- Agent protocol 10 stops before path access for denied rights and reaches file handling for permitted/admin rights.
- The relay rights helper distinguishes browser RDP file access from TCP-routed protocol 10.
- The actual pending-2FA wrapper closes and resumes the paused socket without entering the relay handler, while completed setup continues.
- The pending-2FA predicate and the standard `webrelay.ashx`, primary `meshrelay.ashx`, and alternate agent-port `meshrelay.ashx` registrations retain their required conditions and wrapper.

The suite must be run with `MESHCENTRAL_SOURCE_ROOT` pointing at the exact source/package under review; this prevents accidentally testing the older MeshCentral files in the overlay worktree. Against an extracted official `72e40656fcd153226a5af70e2f6e0ea9326ef3ea` tree, `node --test tests/security-boundaries.test.cjs` passes 12/12 and `git diff --check` passes. Coverage includes both direct file-transfer gates, local and peer server command routing under remote-control/view-only/admin rights, the Agent's service-stop guard, and denied/permitted mocked paths for process kill, service start/restart, desktop-background changes, URL opening and clipboard writes; pending-2FA close/resume behavior and standard relay route registrations; and protocol-specific relay rights. No live agent or device was contacted.

`tests/Test-PinnedMeshCentralBuild.ps1` now runs the boundary suite against the extracted package root as part of the provenance fixture. The complete fixture passed with upstream `72e40656fcd153226a5af70e2f6e0ea9326ef3ea` and overlay `84f0a75332b9ac4afb26c6b85f205c4bd3453bb7`; the packed candidate hash is `986BD56BD83AC8C6DC3BD6735DD63F8C0D532D56C14D0905E4626EEDBFE07AB0` (npm integrity `sha512-/OlK06a2k5AXiacOSXAPgcmznjHQpeBmMs8GnQvZTxonS4QpDU8ZcSwDMldgUlUJyFOP08zgmFwK+RzTgT0gww==`), and all 12 source-boundary tests passed within the fixture. These source-boundary contracts are not full HTTP/WebSocket integration tests. Other Agent command actions (clipboard reads, notifications, console, software/uninstall), alternate authentication/resume paths outside the covered registrations, live-agent transfers, and restore/service qualification remain unverified. `SECURITY_PROVENANCE_GATE=BLOCKED`; no production package, service, or configuration changed.

## Remediation work

1. Pin an exact official upstream commit and tag/release context. Review its full source and dependency diff against the installed 1.3.1 package and the prior pinned candidate. Record commit IDs, package-lock versions, integrity hashes, and every added, removed, or changed dependency.
2. Trace authorization end to end for: direct Agent file transfers (`meshdevicefile.js` handler and all HTTP/WebSocket callers); pending-2FA users entering relay authentication/resume flows; and server plus Agent command-right checks (including restricted, view-only, and administrator cases).
3. Add focused regression tests at the enforcing boundary and at each reachable entry path. Include denied and permitted cases; prove the request cannot bypass the guard through another handler or relay-resume path.
4. Build the candidate reproducibly from the pinned official source. Preserve required package files omitted by npm's publish allowlist only through a documented, verified packaging step. Compare complete package manifests and dependency trees, repeat the build, and require identical archive integrity.
5. Install only into an isolated staging copy with synthetic data and loopback listeners. Run syntax, authorization, regression, package-integrity, and startup/shutdown checks. Do not use production databases, configuration, agents, or tunnel.
6. Produce a review packet containing source and package hashes, dependency diff, test logs, staging results, rollback archive and manifests, restore steps, expected outage, and the single-service restart plan.
7. Stop before production. Require separate explicit authorization after the candidate and rollback packet are reviewable.

## Release gate

`BLOCKED` until every direct file-transfer and pending-2FA relay entry path has demonstrated correct enforcement; focused authorization tests cover denied and permitted cases including alternate entry/resume paths; the full command-right behavior is reviewed; exact source/package provenance and dependency changes are reviewed; isolated startup/shutdown and restore/rollback are verified; and the handoff packet is complete. The source build fixture and isolated listener smoke test pass, but marker strings alone cannot clear this gate.

## Inputs to verify again before implementation

The official upstream branch, release/tag, package tarball integrity, production package integrity, dependency overrides, and security fixes can change. Recheck them immediately before selecting the candidate. The checkpoint above is evidence for planning only, not a permanent pin or deployment recommendation.
