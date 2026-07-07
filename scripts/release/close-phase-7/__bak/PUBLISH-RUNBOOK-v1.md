# Phase 7 Publish Runbook \u2014 applying Phase 5/6 lessons

## Pre-flight (do once)

| Item                                                         | Why (lesson)                                    | How                                              |
| ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| Automation npm token in NPM_AUTH_TOKEN                       | MFA blocks classic/fine-grained on publish (#2) | npmjs.com \u2192 Access Tokens \u2192 Automation |
| NPM_CONFIG_PROVENANCE=true only in CI                        | Local provenance publish fails (#3)             | Set in workflow env, never local                 |
| Classic PAT w/ read:user in ORQENIX_CHANGELOG_PAT            | changelog-github needs it (#4)                  | github.com \u2192 Tokens (classic)               |
| ORQENIX_COORDINATOR_PAT write to 3 repos                     | cross-repo tag sync (#10)                       | Fine-grained PAT, 3 repos, contents:write        |
| .npmrc has ignore-scripts=true                               | supply-chain safety (#8)                        | committed                                        |
| onlyBuiltDependencies = [better-sqlite3, esbuild, @swc/core] | only these compile (#8)                         | root package.json                                |
| publishable-whitelist.yaml finalized                         | never publish off-whitelist (#7)                | .orqenix/release/                                |

## Order of operations (IRREVERSIBLE after step 4)

1. Verify 153/153 (verify orchestrator)
2. Strip BOM + fix Pro deps (workspace:\*/file: \u2192 ^0.7.0)
3. Build all packages
4. npm publish in batches of 6 with 20s cooldown (avoid E429 #5)
   - OSS Apache-2.0 first (Orqenix-Cloud scope), then @orqenix/cli
   - Pro BSL-1.1 with --access restricted
5. Build + cosign sign + SBOM attest 3 images (OIDC keyless)
6. Helm chart OCI publish + sign
7. git tag v0.7.0-phase-7 on all 3 repos \u2014 push same day (#10)
8. GitHub release with measured benchmark numbers

## If something goes wrong

| Symptom                  | Action                                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| Bad version published    | npm deprecate <pkg>@<ver> "use 0.7.x" \u2014 NEVER unpublish (#1)         |
| E429 rate limit          | Wait 2h, resume from last batch (#5)                                      |
| Provenance error locally | You are publishing locally \u2014 STOP, use CI (#3)                       |
| Publish 403/EOTP         | Wrong token type \u2014 use Automation token (#2)                         |
| changelog step fails     | PAT lacks read:user \u2014 use classic PAT (#4)                           |
| Tag on only 1-2 repos    | Push remaining same day; CR Ch 11.7 allows same-day not same-second (#10) |

## Post-publish verification

```bash
# Confirm latest dist-tag resolves to 0.7.0-phase-7 (not legacy)
for p in relay-protocol relay-transport sdk billing-design phase6-to-phase7; do
  npm view @orqenix-cloud/$p dist-tags
done
npm view @orqenix/cli dist-tags

# Confirm provenance attestations present
npm view @orqenix-cloud/sdk@0.7.0-phase-7 --json | grep attestations
```
