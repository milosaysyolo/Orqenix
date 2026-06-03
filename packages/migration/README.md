# @orqenix/migration

Phase 4 → Phase 5 migration tooling with automatic rollback (CR v7.1 Ch.18).

## What it does

1. Backs up the SQLite database to `backupDir/phase-4.<timestamp>.sqlite.bak` with BLAKE3 integrity checksum
2. Applies all Phase 5 schema migrations in topological ID order (1, 2, 10, 20, 21, 30)
3. On any failure: automatically restores from backup + throws `MigrationError`
4. Idempotent on re-run (already-applied migrations are skipped)

## Rollback

```ts
import { PhaseFourToFiveMigrator } from "@orqenix/migration";

const migrator = new PhaseFourToFiveMigrator({
  dbPath: "./kb.sqlite",
  backupDir: "./.orqenix/backups",
});

const report = await migrator.migrate();
// later, if something went wrong:
await migrator.rollback(report.backupPath);
```

Charter gate: **G24 Migration Tooling**.
