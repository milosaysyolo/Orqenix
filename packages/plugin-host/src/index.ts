import { Plugin } from "@orqenix/core";
import type { OrqenixPlugin, PluginContext } from "@orqenix/core/plugin";

export interface PluginHostOptions {
  projectRoot?: string;
  npmPlugins?: string[];
  builtIns?: OrqenixPlugin[];
  contextProvider?: () => PluginContext;
}

export class PluginHost {
  readonly registry: Plugin.PluginRegistry;
  private loader: Plugin.PluginLoader;

  constructor(private readonly opts: PluginHostOptions = {}) {
    this.registry = new Plugin.PluginRegistry();
    if (opts.contextProvider) {
      this.registry.setContextProvider(opts.contextProvider);
    }
    this.loader = new Plugin.PluginLoader({
      registry: this.registry,
      projectRoot: opts.projectRoot,
      npmPlugins: opts.npmPlugins,
    });
  }

  async start(): Promise<void> {
    await this.loader.loadAll(this.opts.builtIns ?? []);
  }

  async stop(): Promise<void> {
    for (const p of this.registry.list()) {
      await this.registry.unregister(p.name);
    }
  }
}
