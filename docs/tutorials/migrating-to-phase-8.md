# Migrating from Phase 7 to Phase 8

> Upgrade an existing Orqenix project (scope) to the Phase 8 hierarchy
> (project + branch + session). Opt-in + reversible within 30 days.

## Before you start

Migration is OPT-IN. Phase 6/7 projects keep working unchanged until you choose
to migrate. The Workbench shows a banner when migration is available.

## Step 1: Check readiness

```bash
orqenix-migrate check
```

Output:
```
Detected phase: 7
Ready to migrate: YES
Estimated entries: 12,847
```

## Step 2: Dry-run

See exactly what would change, no modifications:

```bash
orqenix-migrate to-phase-8 --dry-run
```

Output:
```
Would apply migrations: 500, 501, 502, 540, 550, 560
Would backfill 12,847 entries with branch_id blake3:3a8c91f2...
Branch: main
Estimated disk impact: +2510 KB
No data loss: true
```

## Step 3: Apply

```bash
orqenix-migrate to-phase-8 --apply
```

This:
1. Backs up `.orqenix/` to a timestamped dir
2. Applies the schema migrations
3. Backfills all entries to the `main` branch at project level
4. Creates `project.yaml` (with a `scope.yaml` symlink for compatibility)
5. Records a `project.migrated_from_phase_7` audit entry

## Step 4: Verify

Open the Workbench. Your memory now shows the 3-level hierarchy. The audit
chain remains intact (verify via `Workbench → Audit → Verify Chain`).

## Rollback (within 30 days)

```bash
orqenix-migrate rollback --from .orqenix/_migration_backup_2026-06-11-15-30-00/
```

This restores the Phase 7 state. After 30 days the backup may be removed and
rollback is no longer guaranteed.

## Backward compatibility

- Phase 7 Cloud SDK + plugins keep working (tenant_id resolves to project_id)
- `scope.yaml` symlink keeps Phase 7 tooling functional
- Existing audit chain is preserved + enriched with branch/session metadata
