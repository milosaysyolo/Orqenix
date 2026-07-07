# Phase 7 Publish Runbook \u2014 release v0.7.0 (clean semver)

## Versioning (LOCKED project-wide)

- npm version: `0.7.0` (NEVER `0.7.0-phase-7`)
- dep range: `^0.7.0` (NEVER `^0.7.0-phase-7`)
- git tag: `v0.7.0` (NEVER `v0.7.0-phase-7`)
- Reason: `-phase-7` is a prerelease; `npm install <pkg>` won't resolve it.

## Pre-flight (do once)

| Item                                                         | Why (lesson)                                    | How                                      |
| ------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------- |
| Automation npm token -> NPM_AUTH_TOKEN                       | MFA blocks classic/fine-grained on publish (#2) | npmjs.com -> Access Tokens -> Automation |
| NPM_CONFIG_PROVENANCE=true CI only                           | local provenance publish fails (#3)             | workflow env only                        |
| Classic PAT w/ read:user -> ORQENIX_CHANGELOG_PAT            | changelog-github needs it (#4)                  | github.com tokens (classic)              |
| ORQENIX_COORDINATOR_PAT write 3 repos                        | cross-repo tag sync (#10)                       | fine-grained, contents:write x3          |
| .npmrc ignore-scripts=true                                   | supply-chain (#8)                               | committed                                |
| onlyBuiltDependencies = [better-sqlite3, esbuild, @swc/core] | only these compile (#8)                         | root package.json                        |
| publishable-whitelist.yaml finalized                         | never publish off-whitelist (#7)                | .orqenix/release/                        |

## Order (IRREVERSIBLE after step 5)

1. Revert any old .bak, scrub -phase-7 ranges (block 0)
2. Verify 153/153 (verify orchestrator)
3. Strip BOM + fix Pro deps -> ^0.7.0
4. Build all packages (version 0.7.0)
5. npm publish in batches of 6, 20s cooldown (E429 #5)
   - OSS Apache-2.0 (Cloud scope) then @orqenix/cli, then Pro --access restricted
6. cosign sign + SBOM attest 3 images (tag 0.7.0)
7. helm OCI publish + sign
8. git tag v0.7.0 on 3 repos, push same day (#10)
9. GitHub release with measured benchmark numbers

## If something goes wrong

| Symptom                                    | Action                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| Bad version published                      | npm deprecate <pkg>@0.7.0 "..." \u2014 NEVER unpublish (#1)  |
| Published a -phase-7 prerelease by mistake | deprecate it; publish clean 0.7.0; latest will resolve clean |
| E429                                       | wait 2h, resume from last batch (#5)                         |
| Provenance error locally                   | you're publishing locally \u2014 STOP, use CI (#3)           |
| 403/EOTP                                   | wrong token \u2014 use Automation token (#2)                 |
| changelog fails                            | PAT lacks read:user \u2014 classic PAT (#4)                  |
| Tag on 1-2 repos only                      | push remaining SAME day (#10)                                |

## Post-publish verification

```bash
for p in relay-protocol relay-transport sdk billing-design phase6-to-phase7; do
  npm view @orqenix-cloud/$p dist-tags   # latest must be 0.7.0
done
npm view @orqenix-cloud/sdk@0.7.0 --json | grep attestations
git ls-remote --tags https://github.com/milosaysyolo/Orqenix.git v0.7.0
```
