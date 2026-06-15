# Agent Prompt — Master Closure: Phase 7 Cloud Tier v0.7.0-phase-7

## Mission

Drive Phase 7 from "code-complete + gate-green" to "FULLY CLOSED: published,
validated, signed, safe". Execute 7 blocks IN ORDER. Each block has a hard
gate. Do NOT proceed to the next block until the current block's gate is GREEN.
Checkpoint to long-term memory after each block.

## CRITICAL — Lessons from Phase 5/6 (MUST obey)

1. npm per-package MFA BLOCKS unpublish. NEVER plan to unpublish. If a bad
   version ships, use `npm deprecate` — `latest` dist-tag still resolves correctly.
2. Use an **Automation token** (NODE_AUTH_TOKEN) — it bypasses MFA. A classic
   Granular/fine-grained PAT will fail on publish.
3. **Provenance ON in CI only** (--provenance). Local publish with provenance
   FAILS. The ceremony runs in GitHub Actions with id-token: write.
4. `changesets/changelog-github` requires `read:user` scope — a fine-grained
   PAT is insufficient. Use a classic PAT for the changelog step.
5. npm rate limit E429 fires when publishing many packages fast. Publish in
   batches with a cooldown between batches (default 20s; if E429, wait 2h).
6. Composite GitHub Actions CANNOT reference the `secrets` context — pass
   tokens as explicit `with:` inputs.
7. Enforce publish scope via `.orqenix/release/publishable-whitelist.yaml`.
   Never publish a package not on the whitelist.
8. `.npmrc` must keep `ignore-scripts=true`; `onlyBuiltDependencies` allowlist
   is exactly [better-sqlite3, esbuild, @swc/core].
9. Strip BOM from any package.json before publish. Use `--no-git-checks` to
   bypass prepublishOnly git-state checks where needed.
10. Tag ceremony: verify FIRST (153/153), then tag, then push. All 3 repos
    (Orqenix OSS, Orqenix-Pro, Orqenix-Cloud) MUST be tagged the same
    wall-clock day (CR Ch 11.7 — same day, not same second).

## Execution order (fail-fast, checkpoint after each)

| Block | Name                          | Gate                                    | Where    |
|-------|-------------------------------|-----------------------------------------|----------|
| 1     | Fix code drift                | bench files real + D7.4 clean           | local    |
| 2     | Fix Pro deps + BOM            | no workspace:*/file:, no BOM, build OK  | local    |
| 6sec  | Security pre-flight           | 7 security checks PASS                   | local/CI |
| 3     | Release ceremony              | publish + sign + tag (3 repos)          | CI only  |
| 4     | v2 validation                 | verdict GO on Linux                     | CI only  |
| 5     | Defer limitations             | issues created, milestone v0.7.1        | local    |
| 7     | Docs + announce               | release notes measured, memory written  | local    |

Security pre-flight (6sec) runs BEFORE ceremony so we never publish unsafe code.

## Run

```bash
node scripts/release/close-phase-7/close-phase-7-master.mjs --plan         # dry-run preview
node scripts/release/close-phase-7/close-phase-7-master.mjs --block 1      # run one block
node scripts/release/close-phase-7/close-phase-7-master.mjs --from 1 --to 2 --strict
# Ceremony + validation run on CI (need OIDC + tokens), not local:
gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA
```

Stop conditions
Any block gate RED in --strict → stop, emit remediation, do NOT continue.
Block 3 (publish) is IRREVERSIBLE per lesson #1 — require explicit confirm token I-UNDERSTAND-MFA before executing.
After full GREEN

Write memory: "Orqenix Phase 7 Cloud Tier FULLY CLOSED at v0.7.0-phase-7 on YYYY-MM-DD: 11 OSS pkgs published w/ provenance, 3 images cosign-signed+SBOM, helm OCI signed, tags on 3 repos same day, v2 validation GO on Linux CI, security re-verified. Deferred items tracked under milestone v0.7.1-phase-7."
