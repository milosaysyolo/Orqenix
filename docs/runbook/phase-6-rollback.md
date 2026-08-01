# Orqenix Phase 6 Rollback Runbook

> **Audience:** operators of an Orqenix mesh node.
> **When to use:** you upgraded to Phase 6 and need to revert to the Phase 5 in-process mesh.
> **Property:** Phase 6 transports are opt-in. Disabling them is sufficient for most rollbacks; the migration `down` step is only required if you want to drop the Phase 6 tables.

## 1. Pre-rollback checks

1. **Confirm the node is stopped.** Rolling back while the node is running risks lost state.
   ```bash
   pgrep -af orqenix-node
   ```
   If a process is listed, stop it via SIGINT:
   ```bash
   pkill -INT -f orqenix-node
   ```
2. **Back up `.orqenix/`** before touching anything.
   ```bash
   tar -czf orqenix-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz .orqenix
   ```
3. **Snapshot the SQLite DB** so a forensic copy survives even if the rollback misbehaves.
   ```bash
   sqlite3 .orqenix/state.db ".backup '.orqenix/state.db.before-rollback'"
   ```

## 2. Soft rollback (recommended)

Disabling transports reverts to Phase 5 in-process mesh behavior without touching schemas.

1. Edit `.orqenix/mesh/transports.yaml` and set every `enabled: true` to `enabled: false`.
2. Restart any in-process consumers. The router now sees no reachable transports; cross-scope
   calls inside the same Node process continue to work via the Phase 5 in-process path.

This rollback is reversible at any time by flipping `enabled: true` back.

## 3. Hard rollback (drop Phase 6 tables)

Use this path only if you want to remove every trace of Phase 6 transport state.

1. Drop migration 201 (`mesh_dedup_state`):
   ```bash
   pnpm --filter @orqenix/migrations run migrate:down --id 201
   ```
2. Drop migration 200 (`mesh_transports`):
   ```bash
   pnpm --filter @orqenix/migrations run migrate:down --id 200
   ```
3. Verify the Phase 5 tables remain intact:
   ```bash
   sqlite3 .orqenix/state.db ".tables"
   ```
   The output must still include every Phase 5 table (e.g. `chat_sessions`, `_orqenix_migrations`).
4. Delete the now-orphaned Phase 6 configuration files (optional):
   ```bash
   rm -f .orqenix/mesh/transports.yaml .orqenix/mesh/bootstrap.yaml .orqenix/mesh/peers.yaml
   ```

## 4. Post-rollback verification

1. Start a Phase 5 node (without `orqenix-node`):
   ```bash
   pnpm --filter <your-application> start
   ```
2. Confirm Phase 5 features (chat KB, memory, recall) work as before. The Phase 5 gate set
   (G1 to G35) is sufficient if you want a full sanity sweep.

## 5. Restoring from backup

If anything goes wrong:

```bash
tar -xzf orqenix-backup-<timestamp>.tar.gz
sqlite3 .orqenix/state.db ".restore '.orqenix/state.db.before-rollback'"
```

## 6. Anti-patterns

- **Do NOT delete `.orqenix/identity/`.** Doing so loses the scope identity. Every capability
  token issued by other scopes to you becomes unusable.
- **Do NOT manually edit `_orqenix_migrations`.** Migration tracking depends on its integrity.
- **Do NOT run rollback while the node is serving traffic.** Stop the node first.
