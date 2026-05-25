import { defineCommand } from "citty";
import consola from "consola";
import kleur from "kleur";
import Table from "cli-table3";
import { select, confirm } from "@inquirer/prompts";
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  detectGitInfo,
  detectSession,
  generateScopeId,
} from "@orqenix/core";
import { MemoryManager, type RetentionPolicy, type Tier } from "@orqenix/memory-tiers";
import { loadConfig } from "@orqenix/core/config";

function policyFromConfig(cfg: any): RetentionPolicy {
  const m = cfg.memory?.tiers ?? {};
  return {
    workingTTL: m.working?.ttl ?? null,
    episodicTTL: m.episodic?.ttl ?? "7d",
    semanticTTL: m.semantic?.ttl ?? "90d",
    globalEnabled: m.global?.enabled ?? false,
    globalTTL: m.global?.ttl ?? "365d",
    maxSizeMB: {
      working: m.working?.maxSizeMB ?? 50,
      episodic: m.episodic?.maxSizeMB ?? 100,
      semantic: m.semantic?.maxSizeMB ?? 500,
      global: 0,
    },
    cleanup: cfg.memory?.cleanup?.mode === "importance" ? "importance" : "lru",
  };
}

async function getCurrentScope(cwd: string): Promise<string | null> {
  const git = await detectGitInfo(cwd);
  if (!git) return null;
  const session = await detectSession();
  return generateScopeId({
    project: git.repoRoot,
    branch: git.branch,
    worktree: git.worktreePath,
    session,
  }).short;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function renderCleanupPlan(scope: string, plans: Array<any>): void {
  const head = kleur.bold(
    "╔═══════════════════════════════════════════════════════════════════╗",
  );
  const sep = kleur.bold(
    "╠═══════════════════════════════════════════════════════════════════╣",
  );
  const foot = kleur.bold(
    "╚═══════════════════════════════════════════════════════════════════╝",
  );

  consola.log(head);
  consola.log(kleur.bold("║          ⚠️  Memory Cleanup Confirmation                           ║"));
  consola.log(sep);
  consola.log(`║ Scope: ${scope.padEnd(60)}║`);
  consola.log("║                                                                     ║");

  let totalRemove = 0;
  let totalBytes = 0;
  let totalProtected = 0;
  let totalCheckpoints = 0;

  for (const p of plans) {
    if (p.willRemove.length === 0 && p.protectedCount === 0 && p.checkpointCount === 0) continue;
    consola.log(
      `║ ${p.tier.padEnd(12)} ${String(p.willRemove.length).padStart(6)} entries, ` +
        `${fmtBytes(p.totalBytes).padStart(10)} (older than threshold)`.padEnd(50) + "║",
    );
    totalRemove += p.willRemove.length;
    totalBytes += p.totalBytes;
    totalProtected += p.protectedCount;
    totalCheckpoints += p.checkpointCount;
  }

  consola.log("║                                                                     ║");
  consola.log(`║ TOTAL TO REMOVE: ${String(totalRemove).padStart(6)} entries, ${fmtBytes(totalBytes).padStart(10)}                  ║`);
  consola.log("║                                                                     ║");
  consola.log("║ WILL PRESERVE:                                                     ║");
  consola.log(`║   - ${String(totalProtected).padStart(6)} marked-protected entries                                ║`);
  consola.log(`║   - ${String(totalCheckpoints).padStart(6)} checkpoints                                              ║`);
  consola.log(foot);
}

export const memoryCmd = defineCommand({
  meta: { name: "memory", description: "Inspect and manage tiered memory" },
  subCommands: {
    status: defineCommand({
      meta: { name: "status", description: "Show memory usage per tier" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        scope: { type: "string", default: "" },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const scope = (args.scope as string) || (await getCurrentScope(cwd));
          if (!scope) {
            consola.warn("No git scope detected. Showing global stats.");
          }
          const stats = await mm.stats(scope ?? undefined);
          const table = new Table({
            head: [
              kleur.bold("Tier"),
              kleur.bold("Entries"),
              kleur.bold("Size"),
              kleur.bold("TTL"),
            ],
            style: { head: [], border: ["gray"] },
          });
          const ttls = {
            working: policy.workingTTL ?? "no expiry",
            episodic: policy.episodicTTL,
            semantic: policy.semanticTTL,
            global: policy.globalEnabled ? policy.globalTTL : kleur.gray("disabled"),
          };
          for (const tier of ["working", "episodic", "semantic", "global"] as Tier[]) {
            const s = stats[tier];
            table.push([tier, String(s.count), fmtBytes(s.bytes), ttls[tier]]);
          }
          consola.log(table.toString());
          if (scope) consola.info(`Scope: ${scope}`);
        } finally {
          await mm.close();
        }
      },
    }),

    "preview-cleanup": defineCommand({
      meta: { name: "preview-cleanup", description: "Dry-run cleanup and show what would be removed" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        scope: { type: "string", default: "" },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const scope = (args.scope as string) || (await getCurrentScope(cwd));
          if (!scope) {
            consola.error("No scope detected and none provided. Use --scope <short-hash>");
            process.exit(1);
          }
          const plans = await mm.planCleanupForScope(scope);
          renderCleanupPlan(scope, plans);
        } finally {
          await mm.close();
        }
      },
    }),

    cleanup: defineCommand({
      meta: { name: "cleanup", description: "Run cleanup with confirmation prompt" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        scope: { type: "string", default: "" },
        force: { type: "boolean", default: false },
        dryRun: { type: "boolean", default: false, alias: "dry-run" },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const scope = (args.scope as string) || (await getCurrentScope(cwd));
          if (!scope) {
            consola.error("No scope detected. Use --scope <short-hash>");
            process.exit(1);
          }
          const plans = await mm.planCleanupForScope(scope);
          renderCleanupPlan(scope, plans);

          if (args.dryRun) {
            consola.info("Dry run; no changes applied.");
            return;
          }

          const total = plans.reduce((s, p) => s + p.willRemove.length, 0);
          if (total === 0) {
            consola.success("Nothing to clean up.");
            return;
          }

          if (!args.force) {
            const cleanupMode = cfg.memory?.cleanup?.mode ?? "prompt";
            if (cleanupMode === "manual") {
              consola.info("Cleanup mode is 'manual'. Use --force to run cleanup.");
              return;
            }
            if (cleanupMode === "prompt") {
              const decision = await select<"yes" | "no" | "edit">({
                message: `Remove ${total} entries from scope ${scope}?`,
                choices: [
                  { name: "Yes, clean now", value: "yes" },
                  { name: "No, skip this time", value: "no" },
                  { name: "Edit retention config first", value: "edit" },
                ],
              });
              if (decision === "no") {
                consola.info("Skipped.");
                return;
              }
              if (decision === "edit") {
                consola.info("Edit .orqenix/config.jsonc, then re-run.");
                return;
              }
            }
          }

          const results = await mm.executeCleanup(plans);
          for (const r of results) {
            consola.success(`Removed ${r.removed} entries (${fmtBytes(r.bytesFreed)})`);
          }
        } finally {
          await mm.close();
        }
      },
    }),

    sweep: defineCommand({
      meta: { name: "sweep", description: "Remove entries with expired TTL across all tiers" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const r = await mm.sweepAllExpired();
          consola.success(
            `Swept: working=${r.working}, episodic=${r.episodic}, ` +
              `semantic=${r.semantic}, global=${r.global}`,
          );
        } finally {
          await mm.close();
        }
      },
    }),

    vacuum: defineCommand({
      meta: { name: "vacuum", description: "Reclaim disk space (VACUUM)" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          consola.start("Vacuuming all tiers...");
          await mm.vacuum();
          consola.success("Vacuum complete.");
        } finally {
          await mm.close();
        }
      },
    }),

    export: defineCommand({
      meta: { name: "export", description: "Export memory to JSON (no lock-in)" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        scope: { type: "string", default: "" },
        output: { type: "string", required: true },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const scope = args.scope as string;
          const dump = await mm.exportScope(scope || undefined);
          await writeFile(args.output as string, JSON.stringify(dump, null, 2), "utf-8");
          const total =
            (dump.working?.length ?? 0) +
            (dump.episodic?.length ?? 0) +
            (dump.semantic?.length ?? 0) +
            (dump.global?.length ?? 0);
          consola.success(`Exported ${total} entries to ${args.output}`);
        } finally {
          await mm.close();
        }
      },
    }),

    import: defineCommand({
      meta: { name: "import", description: "Import memory from JSON dump" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        input: { type: "string", required: true },
        force: { type: "boolean", default: false },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const inputPath = args.input as string;
        if (!existsSync(inputPath)) {
          consola.error(`Input file not found: ${inputPath}`);
          process.exit(1);
        }
        const cfg = await loadConfig(cwd);
        const policy = policyFromConfig(cfg);
        const mm = new MemoryManager({ projectRoot: cwd, policy });
        await mm.open();
        try {
          const raw = await readFile(inputPath, "utf-8");
          const dump = JSON.parse(raw);
          if (!args.force) {
            const ok = await confirm({
              message: "Importing may overwrite entries with same IDs. Continue?",
              default: false,
            });
            if (!ok) {
              consola.info("Skipped.");
              return;
            }
          }
          const count = await mm.importDump(dump);
          consola.success(`Imported ${count} entries.`);
        } finally {
          await mm.close();
        }
      },
    }),
  },
});
