// SPDX-License-Identifier: Apache-2.0
// @orqenix/migration-phase-7-to-8 , Migration checker
//
// Verifies a project is in a valid Phase 7 state ready for migration.
// Per CR v8.0 Section 11.3 Step 2.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { AuditChainWriter } from "@orqenix/memory-engine";
import type { MigrationCheckResult } from "./types";

export class MigrationChecker {
  /**
   * Checks whether a project at the given path is ready to migrate to Phase 8.
   */
  async check(projectPath: string): Promise<MigrationCheckResult> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const orqenixDir = join(projectPath, ".orqenix");

    // Detect phase
    const hasScopeYaml = existsSync(join(orqenixDir, "scope.yaml"));
    const hasProjectYaml = existsSync(join(orqenixDir, "project.yaml"));
    let detectedPhase: 7 | 8 | "unknown" = "unknown";

    if (hasProjectYaml) {
      detectedPhase = 8;
      warnings.push("project.yaml already exists; project may already be migrated to Phase 8");
    } else if (hasScopeYaml) {
      detectedPhase = 7;
    } else {
      blockers.push("No scope.yaml or project.yaml found; not an Orqenix project");
    }

    // Verify memory.db + audit chain
    let estimatedEntries = 0;
    const dbPath = join(orqenixDir, "memory.db");
    if (existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true });
        // Count entries across 4 KBs
        for (const table of [
          "chat_entries",
          "code_entries",
          "decision_entries",
          "lesson_entries",
        ]) {
          try {
            const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
            estimatedEntries += row.c;
          } catch {
            // table may not exist
          }
        }

        // Verify audit chain if present
        if (detectedPhase === 7) {
          const projectId = await this.readScopeId(orqenixDir);
          if (projectId) {
            try {
              const writer = new AuditChainWriter(db);
              const verification = writer.verify(projectId);
              if (!verification.valid) {
                blockers.push(`Audit chain corrupted at seq ${verification.firstMismatchSeq}`);
              }
            } catch {
              warnings.push("Could not verify audit chain (may be pre-Phase-7 format)");
            }
          }
        }
        db.close();
      } catch (err) {
        blockers.push(`Could not open memory.db: ${(err as Error).message}`);
      }
    } else {
      warnings.push("No memory.db found; migration will create one");
    }

    return {
      ready: blockers.length === 0 && detectedPhase === 7,
      detectedPhase,
      blockers,
      warnings,
      estimatedEntries,
    };
  }

  private async readScopeId(orqenixDir: string): Promise<string | null> {
    const scopePath = join(orqenixDir, "scope.yaml");
    if (!existsSync(scopePath)) return null;
    const content = await readFile(scopePath, "utf-8");
    const m = /scope_id:\s*(\S+)/.exec(content);
    return m ? (m[1] as string) : null;
  }
}
