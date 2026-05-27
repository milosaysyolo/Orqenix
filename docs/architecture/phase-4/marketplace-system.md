# Federated Marketplace System

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 14 (Marketplace), Chapter 16 (CI).
> Owner: Milo, orqenix.

## 1. Goals

Most marketplace systems for agent skills are single-source, single-tenant,
and unsigned. Orqenix takes the opposite stance:

- Multiple sources, each independently maintained
- Signed entries with cryptographic verification
- Three trust tiers with explicit policy
- SHA-pinned external sources, never tag-or-branch

This design is borrowed in spirit from the Anthropic knowledge-work-plugins
schema, extended for production safety.

## 2. marketplace.json schema

### 2.1 Top-level

```json
{
  "name": "orqenix-default",
  "owner": { "name": "orqenix" },
  "plugins": [ ... ]
}
```

### 2.2 Plugin entry, Form A in-tree

For first-party skills shipped alongside the marketplace:

```json
{
  "name": "productivity",
  "displayName": "Productivity",
  "source": "./skills/productivity",
  "description": "Manage tasks, plan your day"
}
```

`source` is a relative path inside the marketplace repo. Versioning is
derived from the repo's `package.json` at the same path.

### 2.3 Plugin entry, Form B external

For partner skills hosted in their own repos:

```json
{
  "name": "vanta-mcp-plugin",
  "displayName": "Vanta",
  "category": "security",
  "source": {
    "source": "url",
    "url": "https://github.com/VantaInc/vanta-mcp-plugin.git",
    "sha": "345d86b55faa649e955b7ea5569cf52d8425c2d5"
  },
  "homepage": "https://help.vanta.com/...",
  "author": { "name": "Vanta" }
}
```

SHA is mandatory. Tag or branch alone is rejected.

### 2.4 Plugin entry, git-subdir

For partners that publish many skills from one repo:

```json
{
  "name": "bigdata-com",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/Bigdata-com/bigdata-plugins-marketplace.git",
    "path": "plugins/bigdata-com",
    "ref": "main",
    "sha": "c77a09caabdc8783adbcbf8bbe05a0f57da12b19"
  }
}
```

Both ref and sha are stored. Ref is informational; sha is authoritative.

## 3. SHA pinning enforcement

The resolver refuses any external entry without a SHA, and refuses any entry
whose SHA does not match the actual git object at install time.

### 3.1 Bump bot

A scheduled CI job under `.github/workflows/marketplace-sha-bump.yml`:

* Walks every external entry
* Resolves the latest SHA on the declared ref
* Opens a PR with the SHA bump
* Includes a diff summary and link to the upstream commit range

Bump PRs run the full policy scan plus MCP liveness check before merge.

### 3.2 Policy scan

Per CR v6.2 Ch 16, three CI pipelines run on every PR:

* SHA bump validation
* Policy scan: validates manifest, license, no forbidden patterns
* MCP liveness: pings every declared MCP server URL

If any pipeline fails, the PR is blocked.

## 4. Federated sources

A workspace can declare multiple marketplace sources in
`orqenix.config.json`:

```json
{
  "marketplaces": [
    { "name": "orqenix-default", "url": "https://github.com/orqenix/marketplace.git", "ref": "main" },
    { "name": "company-internal", "url": "git@github.com:acme/skills.git", "ref": "main" },
    { "name": "personal", "url": "https://github.com/me/my-skills.git", "ref": "main" }
  ]
}
```

### 4.1 Resolution order

When the user runs `orqenix skill install foo`:

1. Scan all configured marketplaces for a plugin named `foo`
2. If multiple matches, prefer the one with the highest trust tier
3. If tie, prefer the marketplace listed first
4. If still tie, refuse and prompt for explicit `--from <marketplace>`

## 5. Trust tiers

Three tiers, declared per marketplace entry under `trust`:

* `verified`: signed by orqenix and review-passed
* `community`: signed but not reviewed
* `untrusted`: unsigned, requires explicit `--allow-untrusted` flag

### 5.1 Signing

Marketplaces are signed with Ed25519. The signature covers the canonical
serialization of the `plugins` array. Public keys are distributed via
`marketplace-keys.json` at the orqenix domain.

### 5.2 Verification

On every `orqenix marketplace sync`:

* Download `marketplace.json` and `marketplace.json.sig`
* Verify signature against the trusted key set
* Reject if signature is missing or invalid

## 6. RBAC for private marketplaces

For mid-size org use cases (CR v6.2 §1.7):

* A marketplace can declare `access.role` per plugin
* The CLI checks the user's role from the workspace identity
* Plugins with mismatched roles are hidden, not displayed-and-denied

This avoids leaking the existence of a plugin to users who cannot use it.

## 7. Key rotation

* Marketplace owner publishes a new public key in `marketplace-keys.json`
* A grace window of 14 days runs with both keys accepted
* After the window, the old key is removed

The grace window lets downstream consumers refresh without breaking installs
on the rotation day.

## 8. Marketplace UI surface

In Phase 4, marketplace browsing is CLI-only. The Phase 6 web UI exposes:

* Browse by category
* Search by name and description
* Show signature and trust tier
* Diff between SHA pin and latest upstream

## 9. CI integration

Each marketplace repo includes a `.github/workflows/marketplace.yml` template
that runs the three CI pipelines. The template is published as part of
`@orqenix/marketplace-template` for partners to copy.

## 10. Backwards compatibility

`marketplace.json` schema is versioned by the top-level `schemaVersion` field
(default 1). Future schema changes will be additive whenever possible.
Breaking changes bump the major schema version and trigger a migration
prompt in the CLI.

## 11. Threat model

* Compromised partner repo: SHA pin prevents silent updates
* Compromised marketplace owner key: detected by community signature, rotated
* DNS or registry takeover: signatures verify, but availability impacted
* Malicious skill content: policy scan and sandbox executor reduce blast radius
