import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { log } from "../util/logger.js";
import {
  orqenixGlobalConfigDir,
  opencodeGlobalConfigDir,
  projectOpencodeDir,
  projectOrqenixDir,
} from "../util/paths.js";
import type { PluginRegistry } from "./registry.js";
import type { OrqenixPlugin } from "./types.js";

export interface LoaderOptions {
  registry: PluginRegistry;
  projectRoot?: string;
  npmPlugins?: string[];
}

export class PluginLoader {
  constructor(private readonly opts: LoaderOptions) {}

  async loadAll(builtIns: OrqenixPlugin[] = []): Promise<void> {
    for (const p of builtIns) {
      await this.opts.registry.register(p);
    }

    if (this.opts.projectRoot) {
      await this.loadDir(join(projectOpencodeDir(this.opts.projectRoot), "plugin"));
      await this.loadDir(join(projectOrqenixDir(this.opts.projectRoot), "plugins"));
    }

    await this.loadDir(join(opencodeGlobalConfigDir(), "plugin"));
    await this.loadDir(join(orqenixGlobalConfigDir(), "plugins"));

    if (this.opts.npmPlugins) {
      for (const pkg of this.opts.npmPlugins) {
        await this.loadNpmPackage(pkg);
      }
    }
  }

  private async loadDir(dir: string): Promise<void> {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/\.(ts|js|mjs)$/.test(e.name)) continue;
      const file = resolve(join(dir, e.name));
      await this.loadFile(file);
    }
  }

  private async loadFile(file: string): Promise<void> {
    try {
      const mod = await import(pathToFileURL(file).href);
      const exported = this.extractPlugin(mod);
      if (!exported) {
        log.warn("plugin loader: no plugin export", { file });
        return;
      }
      await this.opts.registry.register(exported);
    } catch (err) {
      log.error("plugin loader: failed to load file", { file, err: String(err) });
    }
  }

  private async loadNpmPackage(pkg: string): Promise<void> {
    const name = pkg.replace(/@[^@/]+$/, "").replace(/^@latest$/, "");
    try {
      const mod = await import(name);
      const exported = this.extractPlugin(mod);
      if (!exported) {
        log.warn("plugin loader: npm package has no plugin export", { name });
        return;
      }
      await this.opts.registry.register(exported);
    } catch (err) {
      log.warn("plugin loader: npm package not installed or failed", {
        name,
        err: String(err),
      });
    }
  }

  private extractPlugin(mod: Record<string, unknown>): OrqenixPlugin | null {
    const candidates = [mod.default, mod.plugin, mod.Plugin, mod];
    for (const c of candidates) {
      if (this.isPlugin(c)) return c;
      if (typeof c === "function") {
        try {
          const result = (c as () => OrqenixPlugin)();
          if (this.isPlugin(result)) return result;
        } catch {
          /* skip */
        }
      }
    }
    return null;
  }

  private isPlugin(x: unknown): x is OrqenixPlugin {
    if (!x || typeof x !== "object") return false;
    const p = x as Record<string, unknown>;
    return typeof p.name === "string" && typeof p.version === "string" && typeof p.hooks === "object";
  }
}
