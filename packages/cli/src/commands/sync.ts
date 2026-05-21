import { defineCommand } from "citty";
import consola from "consola";
import kleur from "kleur";
import { select } from "@inquirer/prompts";
import { loadConfig } from "@orqenix/core/config";
import { SyncEngine, SyncWatcher, type ConflictInfo } from "@orqenix/core/sync";

export const syncCmd = defineCommand({
  meta: { name: "sync", description: "Sync Orqenix sources to OpenCode outputs" },
  args: {
    cwd: { type: "string", default: process.cwd() },
    dryRun: { type: "boolean", default: false, alias: "dry-run" },
    verify: { type: "boolean", default: false },
    watch: { type: "boolean", default: false },
  },
  async run({ args }) {
    const root = args.cwd;
    const cfg = await loadConfig(root);

    if (args.watch) {
      const watcher = new SyncWatcher(root, cfg, cfg.knowledge.indexing.debounceMs);
      await watcher.start();
      consola.success(`Watching ${root}/.orqenix/teams ... (Ctrl+C to stop)`);
      // initial sync
      const engine = new SyncEngine(root, cfg);
      const initial = await engine.syncAll();
      printResults(initial);
      await new Promise<void>((resolve) => {
        process.on("SIGINT", async () => {
          consola.info("Stopping watcher...");
          await watcher.stop();
          resolve();
        });
      });
      return;
    }

    const engine = new SyncEngine(root, cfg);
    const opts: Parameters<typeof engine.syncAll>[0] = {
      dryRun: args.dryRun,
      verify: args.verify,
    };

    if (cfg.sync.conflictResolution === "prompt" && !args.verify && !args.dryRun) {
      opts.conflictPrompt = async (info: ConflictInfo) => {
        consola.warn(`Conflict in ${info.agentName} (team ${info.team})`);
        consola.log(kleur.gray(info.diff));
        const decision = await select<"overwrite" | "keep" | "skip">({
          message: `Resolve ${info.agentName}:`,
          choices: [
            { name: "Overwrite (use Orqenix source)", value: "overwrite" },
            { name: "Keep external edit", value: "keep" },
            { name: "Skip this file", value: "skip" },
          ],
        });
        return decision;
      };
    }

    consola.start(args.verify ? "Verifying" : args.dryRun ? "Dry-run" : "Syncing");
    const results = await engine.syncAll(opts);
    printResults(results);
  },
});

function printResults(results: any[]): void {
  for (const r of results) {
    const tag = r.verifyOnly
      ? kleur.cyan("[verify]")
      : r.dryRun
        ? kleur.yellow("[dry-run]")
        : kleur.green("[sync]");
    consola.log(`${tag} team ${kleur.bold(r.team)}`);
    if (r.written.length) consola.log(`  ${kleur.green("written")}: ${r.written.length}`);
    for (const w of r.written) consola.log(`    + ${w}`);
    if (r.skipped.length) consola.log(`  ${kleur.gray("skipped")}: ${r.skipped.length}`);
    for (const s of r.skipped) consola.log(`    ${kleur.gray("-")} ${s}`);
    if (r.drift.length) consola.log(`  ${kleur.yellow("drift")}: ${r.drift.length}`);
    for (const d of r.drift) consola.log(`    ${kleur.yellow("~")} ${d}`);
    if (r.conflicts.length) consola.log(`  ${kleur.red("conflicts")}: ${r.conflicts.length}`);
    for (const c of r.conflicts) consola.log(`    ${kleur.red("!")} ${c}`);
  }
}
