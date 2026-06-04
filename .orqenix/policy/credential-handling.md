# Orqenix Credential Handling Policy

## Scope

All GitHub Actions workflows in milosaysyolo/Orqenix (OSS), milosaysyolo/Orqenix-Pro (Pro), and future milosaysyolo/Orqenix-Cloud (Cloud) repositories.

## Token Classification

| Token | Storage | Scope | Lifetime in workflow |
|-------|---------|-------|----------------------|
| GITHUB_TOKEN | Auto-injected | Current repo only | Job duration, auto-rotated |
| ORQENIX_COORDINATOR_PAT | Repo Secret | Read or write Pro/Cloud | Until manually rotated |
| NPM_TOKEN | Repo Secret | npm publish OSS scope | Until manually rotated |
| NPM_TOKEN_PRO | Repo Secret | npm publish Pro scope | Until manually rotated |

## Mandatory Handling Rules

### Rule 1: Never inline tokens in command-line URLs

Forbidden:

```bash
git clone https://x-access-token:$PAT@github.com/owner/repo.git
```

The token will appear in `ps aux` output and in step logs if any step uses `set -x`. It also persists in `.git/config` of the cloned repo.

Allowed (token via env, URL via stdin or env expansion in run block):

```bash
- name: Clone Pro
  env:
    PRO_TOKEN: ${{ secrets.ORQENIX_COORDINATOR_PAT }}
  run: |
    git clone --depth 1 --branch "$REF" \
      "https://x-access-token:${PRO_TOKEN}@github.com/milosaysyolo/Orqenix-Pro.git" \
      ../Orqenix-Pro
```

GitHub Actions masks secret values in logs automatically, but only if the literal value matches. The above pattern is safe because the URL is constructed at runtime in the runner shell.

### Rule 2: Sanitize `.git/config` immediately after token-injected clone

After any clone that injected a token into the URL, the next step MUST reset the remote URL to the non-tokenized form:

```bash
- name: Sanitize cloned credentials
  run: |
    cd ../Orqenix-Pro
    git remote set-url origin https://github.com/milosaysyolo/Orqenix-Pro.git
    if grep -q "x-access-token" .git/config; then
      echo "ERROR: token still present in .git/config"
      exit 1
    fi
    echo "Credentials sanitized"
```

This prevents credential leak when:

* The cloned repo is uploaded as a build artifact
* A subsequent step runs `git remote -v` for debugging
* A subsequent step fetches additional refs and re-uses the stored URL

### Rule 3: Never use `pull_request_target` for cross-repo workflows

`pull_request_target` runs with write permissions on PRs and exposes secrets to fork PR code. Use `pull_request` and skip secret-requiring jobs for forks via `if` guard:

```yaml
if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
```

### Rule 4: Token validation before use

Every job that uses a secret MUST validate the secret is present before consuming it. This converts confusing "permission denied" errors into clear "missing secret" errors:

```yaml
- name: Validate ORQENIX_COORDINATOR_PAT
  env:
    PAT: ${{ secrets.ORQENIX_COORDINATOR_PAT }}
  run: |
    if [ -z "$PAT" ]; then
      echo "ERROR: ORQENIX_COORDINATOR_PAT is missing or unavailable."
      echo "Forks PRs do not have access to repo secrets by design."
      exit 1
    fi
```

### Rule 5: No tokens in pull_request_review_comment, comment body, or PR title

When the bot posts a comment, it MUST NOT include tokens, even truncated. The bot is allowed to mention secret names (e.g., "ORQENIX_COORDINATOR_PAT") but never values.

### Rule 6: Token rotation cadence

| Token                       | Rotation cadence | Trigger                                  |
| --------------------------- | ---------------- | ---------------------------------------- |
| ORQENIX_COORDINATOR_PAT   | Every 90 days    | Calendar reminder                        |
| NPM_TOKEN, NPM_TOKEN_PRO | Every 180 days   | Calendar reminder                        |
| Any token                   | Immediately      | Suspected leak or contributor offboarded |

Rotation procedure documented in `.orqenix/runbooks/rotate-tokens.md`.

### Rule 7: Composite action enforcement

All cross-repo checkouts (OSS to Pro, Pro to OSS, Cloud to OSS, Cloud to Pro) MUST use the composite action `.github/actions/checkout-orqenix-repo/action.yml`. Direct invocation of `actions/checkout@v4` or raw `git clone` for cross-repo checkout is forbidden. The composite action enforces Rules 1, 2, and 4 automatically.

## Enforcement

A CI guard workflow `policy-credential-guard.yml` runs on every PR. It:

* Greps workflow files for `git clone https://x-access-token:` patterns missing the sanitize step
* Greps for tokens passed as workflow inputs
* Checks all cross-repo checkouts go through the composite action

Violations block PR merge.

## Review Schedule

This policy is reviewed every 6 months or after any incident involving credential exposure. Last reviewed: 2026-06-04.
