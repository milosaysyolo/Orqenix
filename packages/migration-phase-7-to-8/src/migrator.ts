// SPDX-License-Identifier: Apache-2.0
// @orqenix/migration-phase-7-to-8 , Migrator
//
// Performs the Phase 7 → Phase 8 migration. Per CR v8.0 Section 11.3 + 11.5.

import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
import { existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { blake3 } from "@noble/hashes/blake3";
import {
  MigrationRunner,
  AuditChainWriter,
  ALL_PHASE_8_CORE_MIGRATIONS,
  BranchStore,
} from "@orqenix/memory-engine";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { type MigrationDryRunResult, type MigrationApplyResult, MigrationError } from "./types";

const KB_TABLES = ["chat_entries", "code_entries", "decision_entries", "lesson_entries"];

export class Migrator {
  /**
   * Dry-run: reports what migration would do, no changes.
   */
  async dryRun(projectPath: string): Promise<MigrationDryRunResult> {
    const orqenixDir = join(projectPath, ".orqenix");
    const projectId = await this.readScopeId(orqenixDir);
    if (!projectId) {
      throw new MigrationError("NO_SCOPE", "No scope.yaml found");
    }

    const currentBranch = await this.detectGitBranch(projectPath);
    const branchId = BranchStore.computeBranchId(projectId, currentBranch);

    // Count entries
    let entriesToBackfill = 0;
    const dbPath = join(orqenixDir, "memory.db");
    if (existsSync(dbPath)) {
      const db = new Database(dbPath, { readonly: true });
      for (const table of KB_TABLES) {
        try {
          const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
          entriesToBackfill += row.c;
        } catch {
          // skip
        }
      }
      db.close();
    }

    return {
      migrationsToApply: ALL_PHASE_8_CORE_MIGRATIONS.map((m) => m.id),
      entriesToBackfill,
      branchId,
      branchName: currentBranch,
      estimatedDiskImpactKb: Math.round((entriesToBackfill * 200) / 1024),
      noDataLoss: true,
    };
  }

  /**
   * Apply: backup → migrate → backfill → project.yaml → audit.
   */
  async apply(projectPath: string): Promise<MigrationApplyResult> {
    const orqenixDir = join(projectPath, ".orqenix");
    const projectId = await this.readScopeId(orqenixDir);
    if (!projectId) {
      throw new MigrationError("NO_SCOPE", "No scope.yaml found");
    }

    // Step 1: Backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(orqenixDir, `_migration_backup_${timestamp}`);
    await cp(orqenixDir, backupPath, { recursive: true });

    // Step 2 + 3: Apply schema migrations
    const dbPath = join(orqenixDir, "memory.db");
    const db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    const { applied } = runner.apply(ALL_PHASE_8_CORE_MIGRATIONS);

    // Step 4: Backfill hierarchy columns
    const currentBranch = await this.detectGitBranch(projectPath);
    const branchId = BranchStore.computeBranchId(projectId, currentBranch);
    let entriesBackfilled = 0;
    const now = new Date().toISOString();

    const txn = db.transaction(() => {
      for (const table of KB_TABLES) {
        try {
          const result = db
            .prepare(
              `UPDATE ${table} SET branch_id = @branchId, memory_level = 'project' WHERE branch_id IS NULL`,
            )
            .run({ branchId });
          entriesBackfilled += result.changes;
        } catch {
          // table may not exist
        }
      }

      // Register the main branch
      db.prepare(
        `INSERT INTO branches (branch_id, project_id, branch_name, created_at, cloned_from_branch_id, cell_snapshot)
         VALUES (?, ?, ?, ?, NULL, NULL)
         ON CONFLICT(branch_id) DO NOTHING`,
      ).run(branchId, projectId, currentBranch, now);
    });
    txn();

    // Step 5: Create project.yaml + backward-compat symlink
    const scopeContent = await readFile(join(orqenixDir, "scope.yaml"), "utf-8");
    const scopeYaml = (parseYaml(scopeContent) ?? {}) as Record<string, unknown>;
    const projectYaml = {
      schema_version: 8,
      project_id: projectId,
      name: scopeYaml.name ?? "migrated-project",
      created_at: scopeYaml.created_at ?? now,
      migrated_from_phase_7: {
        migration_date: now,
        cr_version: "v8.0",
        previous_scope_yaml_path: join(backupPath, "scope.yaml"),
      },
      branches: {
        [currentBranch]: { branch_id: branchId, created_at: now, cloned_from_branch: null },
      },
    };
    await writeFile(join(orqenixDir, "project.yaml"), stringifyYaml(projectYaml, { indent: 2 }));

    // Backward-compat: scope.yaml symlink → project.yaml (CR v8.0 Section 11.5)
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(join(orqenixDir, "scope.yaml")).catch(() => undefined);
      symlinkSync("project.yaml", join(orqenixDir, "scope.yaml"));
    } catch {
      // symlink may fail on some filesystems; project.yaml is authoritative
    }

    // Step 6: Audit
    const auditWriter = new AuditChainWriter(db);
    const auditEntry = auditWriter.append({
      project_id: projectId,
      branch_id: branchId,
      kind: "project.migrated_from_phase_7",
      actor: { kind: "user", id: "migration-tool" },
      payload: {
        migration_date: now,
        cr_version: "v8.0",
        previous_phase: 7,
        backup_path: backupPath,
        migrations_applied: applied,
        entries_backfilled: entriesBackfilled,
      },
    });

    db.close();

    const rollbackUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    return {
      success: true,
      projectId,
      branchId,
      backupPath,
      migrationsApplied: applied,
      entriesBackfilled,
      rollbackUntil,
      auditId: auditEntry.id,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async readScopeId(orqenixDir: string): Promise<string | null> {
    const scopePath = join(orqenixDir, "scope.yaml");
    if (!existsSync(scopePath)) return null;
    const content = await readFile(scopePath, "utf-8");
    const parsed = (parseYaml(content) ?? {}) as Record<string, unknown>;
    return (parsed.scope_id as string) ?? (parsed.project_id as string) ?? null;
  }

  private async detectGitBranch(projectPath: string): Promise<string> {
    // Read .git/HEAD to find current branch
    const headPath = join(projectPath, ".git", "HEAD");
    if (existsSync(headPath)) {
      const content = await readFile(headPath, "utf-8");
      const m = /ref:\s*refs\/heads\/(.+)/.exec(content.trim());
      if (m) return m[1] as string;
    }
    return "main";
  }
}
