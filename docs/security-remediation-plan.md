# MeshCentral package security remediation plan

**Status:** planning and source review only. No server package, configuration, database, certificate, agent, service, or security setting has been changed.

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

## Remediation work

1. Pin an exact official upstream commit and tag/release context. Review its full source and dependency diff against the installed 1.3.1 package and the prior pinned candidate. Record commit IDs, package-lock versions, integrity hashes, and every added, removed, or changed dependency.
2. Trace authorization end to end for: direct Agent file transfers (`meshdevicefile.js` handler and all HTTP/WebSocket callers); pending-2FA users entering relay authentication/resume flows; and server plus Agent command-right checks (including restricted, view-only, and administrator cases).
3. Add focused regression tests at the enforcing boundary and at each reachable entry path. Include denied and permitted cases; prove the request cannot bypass the guard through another handler or relay-resume path.
4. Build the candidate reproducibly from the pinned official source. Preserve required package files omitted by npm's publish allowlist only through a documented, verified packaging step. Compare complete package manifests and dependency trees, repeat the build, and require identical archive integrity.
5. Install only into an isolated staging copy with synthetic data and loopback listeners. Run syntax, authorization, regression, package-integrity, and startup/shutdown checks. Do not use production databases, configuration, agents, or tunnel.
6. Produce a review packet containing source and package hashes, dependency diff, test logs, staging results, rollback archive and manifests, restore steps, expected outage, and the single-service restart plan.
7. Stop before production. Require separate explicit authorization after the candidate and rollback packet are reviewable.

## Release gate

`BLOCKED` until every direct file-transfer and pending-2FA relay entry path has demonstrated correct enforcement; the exact source/package provenance and complete dependency diff are reviewed; focused tests and isolated staging pass; and rollback is verified. A successful frontend workflow or the presence of security marker strings cannot clear this gate.

## Inputs to verify again before implementation

The official upstream branch, release/tag, package tarball integrity, production package integrity, dependency overrides, and security fixes can change. Recheck them immediately before selecting the candidate. The checkpoint above is evidence for planning only, not a permanent pin or deployment recommendation.
