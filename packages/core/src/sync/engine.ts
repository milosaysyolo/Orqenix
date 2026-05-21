import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { createTwoFilesPatch } from "diff";
import { log } from "../util/logger.js";
import { hashString } from "../util/hash.js";
import { projectOrqenixDir } from "../util/paths.js";
import type { TeamManifest } from "../types/team.js";
import type { OrqenixConfig } from "../types/config.js";
import { compileAgentForOpenCode, readAgentSource } from "./agent-compiler.js";
import { SyncState } from "./state.js";

export type ConflictDecision = "overwrite" | "keep" | "skip";

export interface SyncOptions {
  dryRun?: boolean;
  verify?: boolean;
  conflictPrompt?: (info: ConflictInfo) => Promise<ConflictDecision>;
}

export interface ConflictInfo {
  team: string;
  agentName: string;
  outputPath: string;
  diff: string;
  expectedHash: string;
  actualHash: string;
}

export interface SyncResult {
  team: string;
  written: string[];
  skipped: string[];
  conflicts: string[];
  drift: string[];
  dryRun: boolean;
  verifyOnly: boolean;
}

/**
 * Sync engine that compiles Orqenix team agents and skills into
 * OpenCode-compatible output files. Supports dry-run, verify, conflict
 * resolution, and per-team incremental sync.
 */
export class SyncEngine {
  /**
   * @param projectRoot - Absolute path to the project root directory
   * @param config - Merged OrqenixConfig to use for sync settings
   */
  constructor(
    private readonly projectRoot: string,
    private readonly config: OrqenixConfig,
  ) {}

  async syncAll(opts: SyncOptions = {}): Promise<SyncResult[]> {
    const teamsDir = join(projectOrqenixDir(this.projectRoot), "teams");
    if (!existsSync(teamsDir)) return [];
    const fs = await import("node:fs/promises");
    const teamNames = (await fs.readdir(teamsDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const state = SyncState.forProject(this.projectRoot);
    await state.load();

    const results: SyncResult[] = [];
    for (const name of teamNames) {
      results.push(await this.syncTeam(join(teamsDir, name), state, opts));
    }

    if (!opts.dryRun && !opts.verify) {
      await state.save();
    }
    return results;
  }

  async syncTeam(teamDir: string, state: SyncState, opts: SyncOptions): Promise<SyncResult> {
    const manifestPath = join(teamDir, "team.json");
    if (!existsSync(manifestPath)) throw new Error(`Manifest missing: ${manifestPath}`);
    const manifest = parseJsonc(await readFile(manifestPath, "utf-8")) as TeamManifest;

    const target = manifest.syncTargets?.opencode;
    const result: SyncResult = {
      team: manifest.name,
      written: [],
      skipped: [],
      conflicts: [],
      drift: [],
      dryRun: opts.dryRun ?? false,
      verifyOnly: opts.verify ?? false,
    };

    if (!target?.enabled) {
      result.skipped.push("opencode sync disabled");
      return result;
    }

    const outputDirAbs = join(this.projectRoot, target.outputDir);
    if (!opts.verify && !opts.dryRun) {
      await mkdir(outputDirAbs, { recursive: true });
    }

    const allAgents = [
      manifest.teamLead,
      ...manifest.agents.core,
      ...manifest.agents.optional,
    ];

    for (const decl of allAgents) {
      const sourcePath = join(teamDir, decl.file);
      if (!existsSync(sourcePath)) {
        result.skipped.push(`source missing: ${decl.file}`);
        continue;
      }
      const outputName = target.filenamePattern
        .replace("{prefix}", manifest.namingPrefix)
        .replace("{role}", decl.role);
      const outputPath = join(outputDirAbs, outputName);
      const agentName = outputName.replace(/\.md$/, "");

      const source = await readAgentSource(sourcePath, agentName);
      const compiled = compileAgentForOpenCode(source, {
        teamName: manifest.name,
        teamVersion: manifest.version,
        outputName,
      });
      const compiledHash = `blake3:${hashString(compiled)}`;

      // Verify mode: only report drift, never write
      if (opts.verify) {
        if (!existsSync(outputPath)) {
          result.drift.push(`${outputName} (missing)`);
          continue;
        }
        const actual = await readFile(outputPath, "utf-8");
        const actualHash = `blake3:${hashString(actual)}`;
        const rec = state.get(agentName);
        if (!rec) {
          result.drift.push(`${outputName} (no state record)`);
        } else if (rec.outputHash !== actualHash) {
          result.drift.push(`${outputName} (external edit)`);
        } else if (compiledHash !== actualHash) {
          result.drift.push(`${outputName} (source updated, needs sync)`);
        }
        continue;
      }

      // Dry-run: report intended action without writing
      if (opts.dryRun) {
        if (!existsSync(outputPath)) {
          result.written.push(`${outputName} (would create)`);
        } else {
          const actual = await readFile(outputPath, "utf-8");
          const actualHash = `blake3:${hashString(actual)}`;
          if (actualHash === compiledHash) {
            result.skipped.push(`${outputName} (already in sync)`);
          } else {
            result.written.push(`${outputName} (would update)`);
          }
        }
        continue;
      }

      // Real write with conflict handling
      if (existsSync(outputPath)) {
        const existing = await readFile(outputPath, "utf-8");
        const existingHash = `blake3:${hashString(existing)}`;
        const rec = state.get(agentName);
        const externallyEdited = rec ? rec.outputHash !== existingHash : false;

        if (externallyEdited) {
          const resolution = this.config.sync.conflictResolution;
          if (resolution === "opencode-wins") {
            result.skipped.push(`${outputName} (external edit kept)`);
            continue;
          }
          if (resolution === "prompt") {
            if (!opts.conflictPrompt) {
              result.conflicts.push(outputName);
              continue;
            }
            const diff = createTwoFilesPatch(outputPath, outputPath, existing, compiled);
            const decision = await opts.conflictPrompt({
              team: manifest.name,
              agentName,
              outputPath,
              diff,
              expectedHash: rec?.outputHash ?? "",
              actualHash: existingHash,
            });
            if (decision === "keep") {
              result.skipped.push(`${outputName} (kept user edit)`);
              continue;
            }
            if (decision === "skip") {
              result.skipped.push(`${outputName} (skipped)`);
              continue;
            }
            await this.backupExternalEdit(outputPath, existing);
          } else {
            // orqenix-wins default
            await this.backupExternalEdit(outputPath, existing);
          }
        } else if (existingHash === compiledHash) {
          result.skipped.push(`${outputName} (already in sync)`);
          continue;
        }
      }

      await writeFile(outputPath, compiled, "utf-8");
      state.set(agentName, {
        source: sourcePath,
        output: outputPath,
        sourceHash: source.contentHash,
        outputHash: compiledHash,
        team: manifest.name,
        teamVersion: manifest.version,
      });
      result.written.push(outputName);
    }

    return result;
  }

  private async backupExternalEdit(outputPath: string, content: string): Promise<void> {
    const backupDir = join(projectOrqenixDir(this.projectRoot), "sync", "backups");
    await mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = outputPath.split(/[/\\]/).pop() ?? "agent.md";
    const backupPath = join(backupDir, `${stamp}-${fileName}`);
    await writeFile(backupPath, content, "utf-8");
    log.warn("sync: external edit backed up", { backupPath });
  }
}
