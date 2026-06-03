# First Publish Runbook: Orqenix v0.5.0

This runbook walks through the first end-to-end publish of Orqenix OSS and Pro to npm. After first publish, subsequent releases use the same workflow but with optional auto-trigger for Pro.

## Prerequisites

- [ ] `NPM_TOKEN` secret set in OSS repo (`@orqenix/*` write access)
- [ ] `NPM_TOKEN_PRO` secret set in Pro repo (`@orqenix-pro/*` write access)
- [ ] `ORQENIX_COORDINATOR_PAT` set in BOTH repos
- [ ] Whitelist reviewed: 27 OSS packages, 7 Pro packages
- [ ] Batch S1-S4 PRs merged in both repos
- [ ] Local `pnpm install` succeeds in both repos

## Phase 1: Dry-run OSS

Goal: Verify all workflows run end-to-end without publishing.

```bash
cd ~/Documents/GitHub/Orqenix
gh workflow run release.yml -f dry_run=true
gh run watch
```

Expected:

- pre-flight: pass (verdict = "go" or "go-with-warnings")
- build-and-verify: pass
- publish: SKIPPED (dry_run=true)
- No tag created, no npm publish

If pre-flight fails: read `.orqenix/pre-publish-report.json` from artifacts, fix issues.

## Phase 2: Add changeset and trigger OSS publish

```bash
cd ~/Documents/GitHub/Orqenix
pnpm changeset
# Select all @orqenix/* packages
# Bump: minor (0.4 → 0.5)
# Summary: "Phase 5: Memory Foundation Refactor"
git add .changeset/*.md
git commit -m "chore: add v0.5.0 changeset"
git push origin main
```

This triggers `release.yml` automatically. It will:

1. Pre-flight check
2. Open "chore(release): version packages" PR
3. Wait for human merge

Review the PR carefully:

- Check version bumps (all → 0.5.0)
- Check CHANGELOG entries
- Check no unexpected file changes

Merge the PR when ready.

## Phase 3: OSS publishes

After merging the version PR, `release.yml` runs again. This time:

1. Pre-flight + build + verify pass
2. `changesets/action` detects version bump, runs `pnpm ci:publish`
3. 27 packages published to npm with provenance
4. Git tag `v0.5.0-phase-5` created
5. Smoke test installs @orqenix/cli@0.5.0
6. Notification issue created in OSS repo with `awaiting-pro-trigger` label

## Phase 4: Manual verification of OSS

```bash
# Verify on npm
npm view @orqenix/core
npm view @orqenix/cli

# Install and test in fresh project
mkdir /tmp/test-oss && cd /tmp/test-oss
npm init -y
npm install @orqenix/core @orqenix/cli
node -e "console.log(require('@orqenix/core'))"
npx orqenix --version
npx orqenix doctor
```

Check provenance badge on https://www.npmjs.com/package/@orqenix/core

**Stop here if anything looks wrong**. Do NOT trigger Pro until OSS is confirmed good.

## Phase 5: Manual trigger for Pro

When OSS is verified:

```bash
# Dry-run first
gh workflow run trigger-pro.yml \
  -f oss_version=0.5.0 \
  -f pro_dry_run=true \
  -f reason="First Pro dry-run after OSS verified"

# Watch
gh run list --workflow trigger-pro.yml --limit 1
gh run watch
```

This dispatches to Pro repo. Pro will:

1. Wait for `@orqenix/core@0.5.0` (already on npm, instant)
2. Convert `workspace:*` → `^0.5.0` for 26 deps
3. Re-install
4. Build, test, charter gates
5. Pre-publish-check
6. Skip publish (dry_run=true)

Verify Pro dry-run is clean before proceeding.

## Phase 6: Real Pro publish

```bash
gh workflow run trigger-pro.yml \
  -f oss_version=0.5.0 \
  -f pro_dry_run=false \
  -f reason="First Pro publish after OSS verified and dry-run OK"
```

Pro will:

1. Same as Phase 5 but actually publish
2. 7 packages published to npm
3. Git tag `v0.5.0-phase-5` created in Pro repo
4. Combined smoke test installs both OSS + Pro
5. Comment on OSS release issue, label changed to `release-complete`

## Phase 7: Post-publish

```bash
# Verify Pro on npm
npm view @orqenix-pro/blast-radius
npm view @orqenix-pro/mesh-delegation

# Combined smoke test locally
mkdir /tmp/test-combined && cd /tmp/test-combined
npm init -y
npm install @orqenix/core@0.5.0 @orqenix-pro/blast-radius@0.5.0
node -e "
  require('@orqenix/core');
  require('@orqenix-pro/blast-radius');
  console.log('Combined OK');
"
```

Update README badges, announce in LinkedIn/Discord, close release issue.

## Rollback procedures

### If Pro publish fails after OSS published

OSS stays on npm (acceptable). Fix Pro, retry trigger-pro.yml. Cross-scope deps already correct on OSS.

### If wrong package published

Within 72h: `npm unpublish @orqenix/<pkg>@0.5.0` (requires manual confirmation).
After 72h: `npm deprecate @orqenix/<pkg>@0.5.0 "Published in error"`.

### If secret leaked in tarball

1. Revoke leaked secret immediately
2. Unpublish version (within 72h)
3. Bump patch, republish from clean source
4. Audit: review git history for the leak

## After first publish: enable auto-trigger (optional)

To make Pro auto-trigger after OSS for subsequent releases, edit OSS `release.yml`:

```yaml
# Add this job after `publish:`
trigger-pro-auto:
  needs: publish
  if: needs.publish.outputs.published == 'true'
  uses: ./.github/workflows/trigger-pro.yml
  with:
    oss_version: ${{ needs.publish.outputs.version }}
    pro_dry_run: false
    reason: "Auto-trigger after OSS publish"
  secrets: inherit
```

Em recommend keep manual trigger until 3-5 successful releases.
