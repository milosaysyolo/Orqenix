# @orqenix/migration-phase-7-to-8

> Apache-2.0 migration tooling: Phase 7 (scope) → Phase 8 (project + branch + session).
> Phase 8 (D8.δ). Charter gate G70 (Reference Plugins + Migration Tooling).

## Mission

Migrates a Phase 7 Orqenix project to the Phase 8 3-level hierarchy. Per CR v8.0
Chapter 11. Migration is OPT-IN (user-initiated) and REVERSIBLE within 30 days.

## CLI

```bash
# Check migration readiness (no changes)
orqenix-migrate check

# Dry-run (show impact, no changes)
orqenix-migrate to-phase-8 --dry-run

# Apply migration (creates backup first)
orqenix-migrate to-phase-8 --apply

# Rollback within 30 days
orqenix-migrate rollback --from .orqenix/_migration_backup_<timestamp>/
```

## What it does (CR v8.0 Section 11.3)

1. **Backup** , copies .orqenix/ to a timestamped backup dir
2. **Verify Phase 7 state** , reads scope.yaml + verifies audit chain integrity
3. **Apply migrations** , 500/501/502 hierarchy + 540 + 550 + 560
4. **Backfill** , all entries get branch_id (main) + memory_level=project
5. **Create project.yaml** , from scope.yaml + backward-compat symlink
6. **Audit** , project.migrated_from_phase_7

## Backward compatibility (CR v8.0 Section 11.5)

- `scope.yaml` symlink → `project.yaml` (Phase 7 code keeps working)
- `tenant_id` queries resolve to `project_id`
- Phase 7 Cloud SDK + plugins continue to function

## Rollback

Within 30 days, `rollback` restores the backup. After 30 days, the backup may be
garbage-collected and rollback is no longer guaranteed.

## License

Apache-2.0 , see ./LICENSE
