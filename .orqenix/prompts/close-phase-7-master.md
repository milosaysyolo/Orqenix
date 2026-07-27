# Agent Prompt — Master Closure: Phase 7 Cloud Tier (release v0.7.0)

## Mission

Drive Phase 7 from "code-complete + gate-green" to "FULLY CLOSED: published,
validated, signed, safe". Execute blocks IN ORDER. Each block has a hard gate.
Do NOT proceed until the current block's gate is GREEN. Checkpoint to long-term
memory after each block.

## VERSIONING — clean semver ONLY (project-wide LOCKED decision)

- npm published version: `0.7.0` (NEVER `0.7.0-phase-7`)
- dependency range in package.json: `^0.7.0` (NEVER `^0.7.0-phase-7`)
- git tag: `v0.7.0` (NEVER `v0.7.0-phase-7`)
- Rationale: `-phase-7` is a semver PRERELEASE. `npm install <pkg>` without a
  version will NOT resolve a prerelease, breaking default install (Phase 5 bug).
- Internal report/dir names (D7.x, out/...) may keep a phase label — they do
  not affect npm/git resolution.

## CRITICAL — Lessons from Phase 5/6 (MUST obey)

1. npm per-package MFA BLOCKS unpublish. NEVER plan to unpublish. Bad version →
   `npm deprecate`. `latest` dist-tag keeps resolving correctly.
2. Use an **Automation token** (NODE_AUTH_TOKEN) — bypasses MFA. Classic/
   fine-grained PAT will fail publish (403/EOTP).
3. **Provenance ON in CI only** (--provenance / NPM_CONFIG_PROVENANCE=true).
   Local publish with provenance FAILS. Ceremony runs in GitHub Actions.
4. `changesets/changelog-github` needs `read:user` — use a classic PAT.
5. npm E429 on bulk publish. Publish in batches with cooldown (6 pkgs / 20s).
   If E429 fires, wait 2h, resume from last batch.
6. Composite Actions CANNOT read `secrets` context — pass tokens via `with:`/env.
7. Enforce publish scope via `.orqenix/release/publishable-whitelist.yaml`.
8. `.npmrc` keeps `ignore-scripts=true`; onlyBuiltDependencies allowlist exactly
   [better-sqlite3, esbuild, @swc/core].
9. Strip BOM from package.json before publish. Use `--no-git-checks` where needed.
10. Tag ceremony: verify FIRST (153/153), then tag, then push. All 3 repos
    tagged the SAME wall-clock day (CR Ch 11.7 — same day, not same second).

## Execution order (fail-fast, checkpoint each)

| Block | Name                | Gate                                   | Where    |
| ----- | ------------------- | -------------------------------------- | -------- |
| 0     | Revert bad -phase-7 | .bak restored, no `-phase-7` in deps   | local    |
| 1     | Fix code drift      | bench files real + D7.4 clean          | local    |
| 2     | Fix Pro deps + BOM  | workspace:\*/file: → ^0.7.0, build OK  | local    |
| 6sec  | Security pre-flight | 7 security checks PASS (Cloud repo)    | CI/Cloud |
| 3     | Release ceremony    | publish 0.7.0 + sign + tag v0.7.0 (x3) | CI only  |
| 4     | v2 validation       | verdict GO on Linux                    | CI only  |
| 5     | Defer limitations   | issues filed, milestone v0.7.1         | local    |
| 7     | Docs + announce     | release notes measured, memory written | local    |

## Run

```bash
node scripts/release/close-phase-7/close-phase-7-master.mjs --plan
node scripts/release/close-phase-7/close-phase-7-master.mjs --block 0          # revert bad refs first
node scripts/release/close-phase-7/close-phase-7-master.mjs --from 1 --to 2 --strict
gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA
```

Stop conditions
Any block gate RED in --strict → stop, emit remediation.
Block 3 (publish) IRREVERSIBLE (lesson #1) — require --confirm I-UNDERSTAND-MFA AND Linux+OIDC. Windows local runs BLOCK it.
After full GREEN

Write memory: "Orqenix Phase 7 Cloud Tier FULLY CLOSED, released v0.7.0 on YYYY-MM-DD: 11 OSS pkgs published (clean semver 0.7.0) w/ provenance, 3 images cosign-signed+SBOM, helm OCI signed, tags v0.7.0 on 3 repos same day, v2 validation GO on Linux CI, security re-verified. Deferred under milestone v0.7.1."
