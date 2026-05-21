import chokidar, { type FSWatcher } from "chokidar";
import { join } from "node:path";
import { log } from "../util/logger.js";
import { projectOrqenixDir } from "../util/paths.js";
import type { OrqenixConfig } from "../types/config.js";
import { SyncEngine } from "./engine.js";

/**
 * Watch .orqenix/teams/** for changes and sync the affected team.
 * Debounced to coalesce burst writes.
 */
export class SyncWatcher {
  private timer: NodeJS.Timeout | null = null;
  private pending = new Set<string>();
  private watcher: FSWatcher | null = null;

  /**
   * @param projectRoot - Absolute path to the project root directory
   * @param config - Merged OrqenixConfig (used for engine settings)
   * @param debounceMs - Debounce interval in milliseconds (default: 500)
   */
  constructor(
    private readonly projectRoot: string,
    private readonly config: OrqenixConfig,
    private readonly debounceMs = 500,
  ) {}

  async start(): Promise<void> {
    const watchPath = join(projectOrqenixDir(this.projectRoot), "teams");
    this.watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    this.watcher.on("all", (event: string, p: string) => {
      log.debug("watch: event", { event, path: p });
      this.pending.add(p);
      this.scheduleFlush();
    });
    log.info("sync watcher started", { watchPath });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.watcher?.close();
    this.watcher = null;
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  private async flush(): Promise<void> {
    const batch = Array.from(this.pending);
    this.pending.clear();
    if (batch.length === 0) return;
    log.info("watch: flushing", { count: batch.length });
    const engine = new SyncEngine(this.projectRoot, this.config);
    try {
      const results = await engine.syncAll();
      const total = results.reduce((sum, r) => sum + r.written.length, 0);
      log.info(`watch: synced ${total} file(s)`);
    } catch (err) {
      log.error("watch: sync failed", { err: String(err) });
    }
  }
}
