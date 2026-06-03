import chokidar, { type FSWatcher } from "chokidar";
import { relative, sep } from "node:path";
import {
  WatcherConfigSchema,
  WatcherError,
  type FileEvent,
  type FileEventBatchListener,
  type FileEventKind,
  type WatcherConfig,
} from "./contracts.js";

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

export type WatcherStatus = "idle" | "running" | "stopping" | "stopped";

export class FileWatcher {
  private readonly cfg: WatcherConfig;
  private watcher: FSWatcher | null = null;
  private pending: FileEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private listener: FileEventBatchListener | null = null;
  status: WatcherStatus = "idle";

  constructor(cfg: WatcherConfig) {
    this.cfg = WatcherConfigSchema.parse(cfg);
  }

  async start(listener: FileEventBatchListener): Promise<void> {
    if (this.status === "running") throw new WatcherError("already running");
    this.listener = listener;
    this.watcher = chokidar.watch(this.cfg.patterns, {
      cwd: this.cfg.rootDir,
      ignored: this.cfg.ignore,
      ignoreInitial: true,
      followSymlinks: this.cfg.followSymlinks,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });
    const onEvent = (kind: FileEventKind, p: string): void => this.enqueue(kind, p);
    this.watcher.on("add", (p) => onEvent("add", p));
    this.watcher.on("change", (p) => onEvent("change", p));
    this.watcher.on("unlink", (p) => onEvent("unlink", p));
    this.watcher.on("error", (e) => {
      this.listener = null;
      this.status = "stopped";
      throw new WatcherError((e as Error).message);
    });
    await new Promise<void>((res) => {
      this.watcher?.once("ready", () => {
        this.status = "running";
        res();
      });
    });
  }

  private enqueue(kind: FileEventKind, p: string): void {
    const abs = `${this.cfg.rootDir}${sep}${p}`;
    const rel = toPosix(relative(this.cfg.rootDir, abs));
    const evt: FileEvent = {
      kind,
      path: abs,
      relPath: rel,
      timestamp: new Date().toISOString(),
    };
    this.pending.push(evt);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, this.cfg.debounceMs);
  }

  private async flush(): Promise<void> {
    const batch = this.pending;
    this.pending = [];
    this.debounceTimer = null;
    if (!this.listener || batch.length === 0) return;
    try {
      await this.listener(batch);
    } catch {
      /* listener errors are caller's problem */
    }
  }

  async stop(): Promise<void> {
    if (this.status !== "running") return;
    this.status = "stopping";
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    await this.flush();
    this.listener = null;
    this.status = "stopped";
  }
}
