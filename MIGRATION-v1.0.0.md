# Migration Guide: v0.9.x to v1.0.0

## Overview

v1.0.0 is the first stable release. It removes all Phase-X stubs, hardens the engine init pipeline, fixes event bus ID collisions, ships real CLI commands (`init`, `doctor`), and requires explicit scope initialization before any scoped operation.

**Estimated migration time: 15-30 minutes.**

---

## Breaking Changes Summary

| Change | Impact | Action Required |
|--------|--------|----------------|
| `@orqenix/security` barrel exports | Imports from bare `@orqenix/security` now pull 3 sub-packages. No breakage unless you had a local shadow. | Verify no local file shadows the package. |
| CLI no default scope ID | `ORQENIX_SCOPE` defaults to `""`. All scoped commands reject with "run `orqenix init` first". | Run `orqenix init` in each project. |
| Node 22 for `@orqenix/local-node` | Mesh node binary requires Node 22+. Other packages stay at >=20. | Upgrade Node if running local-node. |
| DB schema additions | 3 new table groups added. No downgrade path. | Automatic on first boot. Manual migration steps below. |
| Engine `failOnDrift` = true in production | Schema drift at startup is now fatal. | Ensure DB is up to date. Run `orqenix doctor` to verify. |

---

## Step-by-Step Upgrade

### 1. Check Node.js version

```bash
node --version
```

Workbench requires Node >=20.10.0.
`@orqenix/local-node` (mesh node binary) requires Node >=22.0.0.

If running the mesh node and on Node <22:

```bash
# install Node 22 (example with nvm)
nvm install 22
nvm use 22
```

### 2. Update dependencies

```bash
# In your project that depends on @orqenix/*
pnpm update "@orqenix/*"

# Or if installing from scratch
pnpm add -D @orqenix/cli@^1.0.0
pnpm add @orqenix/security@^1.0.0
```

### 3. Run `orqenix init` in each scope

Previously the CLI defaulted `ORQENIX_SCOPE` to `"placeholder"` which let commands run with a fake scope ID. v1.0.0 removes that default.

```bash
cd path/to/your/repo
pnpm exec orqenix init
```

This generates:

- `.orqenix/scope.yaml` - scope identity with BLAKE3-hashed ID
- `.orqenix/identity.key` - Ed25519 private key (mode 0600)

Verify the setup:

```bash
pnpm exec orqenix doctor
```

Expected output: all checks pass (node-version, scope-yaml, identity-key, sqlite, keypair).

### 4. Verify scope identity

```bash
pnpm exec orqenix scope info
```

If this returns `"error: no scope ID"` instead of JSON, the init did not complete. Check `.orqenix/` directory exists and contains `scope.yaml`.

### 5. Update environment variables

If you had `ORQENIX_SCOPE=placeholder` in your `.env` or shell config, remove it. The empty default is now correct.

```bash
# Remove this line if present
# ORQENIX_SCOPE=placeholder
```

Set `ORQENIX_STRICT=1` for production deployments to enable `failOnDrift` (already enabled when `NODE_ENV=production`).

### 6. DB migration (workbench users)

If you run the workbench, the engine applies new schema tables automatically on first boot:

- `memory_links` - cross-project memory linking (migration 570)
- `agent_definitions`, `teams`, `team_edges` - agent orchestration (migration 580)
- `config_overrides`, `mcp_tokens`, `bindings` - workbench state (migration 590)

The migration is idempotent and runs on first `getRuntime()` call.

To migrate manually before booting the workbench:

```bash
# From the monorepo root
pnpm exec tsx scripts/verify/wb-preflight.mjs

# Or run the workbench in verify mode
pnpm wb:verify
```

**No downgrade path.** The new tables are additive and do not modify existing ones, but reverting to v0.9.x with these tables present will leave orphan schema.

### 7. Check `@orqenix/security` imports

If you import from `@orqenix/security` directly:

```typescript
// Before (v0.9.x - no barrel existed, you imported from sub-packages)
import { createScopeId } from '@orqenix/scope-identity';
import { issueToken } from '@orqenix/capability-tokens';

// After (v1.0.0 - barrel re-exports all three)
import { createScopeId, issueToken } from '@orqenix/security';
```

Both import styles work. The barrel is added, not replacing sub-packages.

If you have a local file or module that shadows `@orqenix/security`, rename it to avoid the shadow.

### 8. Enable CSP headers

v1.0.0 ships Content-Security-Policy-Report-Only headers. Review the policy in `apps/workbench/next.config.mjs`:

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:;
```

To switch from report-only to enforced in production, change the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`:

```javascript
// next.config.mjs - only after verifying no breakage
key: 'Content-Security-Policy',
```

### 9. Verify event bus upgrade

The event bus now uses `evt_${crypto.randomUUID()}` for event IDs. If you have code that depends on the old ID format (bare hex strings), update your ID parsing:

```typescript
// Old format: "a1b2c3d4e5f6..."
// New format: "evt_550e8400-e29b-41d4-a716-446655440000"

// Switch from exact match to startsWith or ignore the prefix
if (event.id.startsWith('evt_')) {
  // new format
}
```

---

## Rollback

If you need to revert to v0.9.x:

1. Revert package versions to `^0.9.x`
2. Restore the old `ORQENIX_SCOPE=placeholder` env var if you relied on it
3. Run `pnpm install --frozen-lockfile`
4. The new DB tables are additive - they will not break v0.9.x code, but they will remain as orphan schema

There is no automated rollback tool for v1.0.0. The new engine init pipeline with `failOnDrift` will refuse to start if you revert engine code while the new tables exist. In that case, drop the three workbench tables:

```sql
DROP TABLE IF EXISTS memory_links;
DROP TABLE IF EXISTS agent_definitions;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS team_edges;
DROP TABLE IF EXISTS config_overrides;
DROP TABLE IF EXISTS mcp_tokens;
DROP TABLE IF EXISTS bindings;
```

---

## Checklist

- [ ] Node.js version checked (>=20.10.0 for workbench, >=22.0.0 for local-node)
- [ ] `pnpm exec orqenix init` run in each project scope
- [ ] `pnpm exec orqenix doctor` passes all checks
- [ ] `ORQENIX_SCOPE=placeholder` removed from env
- [ ] `ORQENIX_STRICT=1` set for production (recommended)
- [ ] `@orqenix/security` imports reviewed if used directly
- [ ] DB auto-migration verified (workbench boots without error)
- [ ] CSP report-only headers reviewed before enabling enforcement
- [ ] Event bus consumers updated to handle `evt_` prefixed IDs
