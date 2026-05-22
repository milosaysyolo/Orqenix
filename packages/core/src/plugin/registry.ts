import { log } from "../util/logger.js";
import type {
  KnowledgeQuery,
  LLMCall,
  LLMResponse,
  MemoryEntry,
  MemoryQuery,
  OrqenixPlugin,
  PluginContext,
  PluginHookName,
  PluginHooks,
  Session,
  Task,
  TaskResult,
  ToolInput,
  ToolOutput,
} from "./types.js";

export class PluginRegistry {
  private plugins = new Map<string, OrqenixPlugin>();
  private contextProvider: (() => PluginContext) | null = null;

  setContextProvider(provider: () => PluginContext): void {
    this.contextProvider = provider;
  }

  async register(plugin: OrqenixPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
    if (plugin.onRegister && this.contextProvider) {
      try {
        await plugin.onRegister(this.contextProvider());
      } catch (err) {
        log.error("plugin: onRegister failed", { plugin: plugin.name, err: String(err) });
        this.plugins.delete(plugin.name);
        throw err;
      }
    }
    log.info("plugin: registered", {
      plugin: plugin.name,
      version: plugin.version,
      capabilities: plugin.capabilities,
    });
  }

  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;
    if (plugin.onUnregister && this.contextProvider) {
      try {
        await plugin.onUnregister(this.contextProvider());
      } catch (err) {
        log.warn("plugin: onUnregister failed", { plugin: name, err: String(err) });
      }
    }
    this.plugins.delete(name);
    log.info("plugin: unregistered", { plugin: name });
  }

  list(): OrqenixPlugin[] {
    return Array.from(this.plugins.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  get(name: string): OrqenixPlugin | undefined {
    return this.plugins.get(name);
  }

  async runBefore<K extends "agent.task.before" | "tool.execute.before" | "session.start" | "session.end">(
    hook: K,
    arg: Parameters<NonNullable<PluginHooks[K]>>[0],
  ): Promise<void> {
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook] as ((a: unknown, c: PluginContext) => Promise<void>) | undefined;
      if (!fn) continue;
      await fn(arg, ctx);
    }
  }

  async runAfter<K extends "agent.task.after" | "llm.call.after">(
    hook: K,
    ...args: K extends "agent.task.after"
      ? [Task, TaskResult]
      : K extends "llm.call.after"
        ? [LLMCall, LLMResponse]
        : never
  ): Promise<void> {
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook] as ((...a: unknown[]) => Promise<void>) | undefined;
      if (!fn) continue;
      try {
        await fn(...args, ctx);
      } catch (err) {
        log.warn("plugin: after-hook failed", { plugin: p.name, hook, err: String(err) });
      }
    }
  }

  async runTransformTool(
    hook: "tool.execute.after",
    initial: ToolOutput,
  ): Promise<ToolOutput> {
    let current = initial;
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook];
      if (!fn) continue;
      current = await fn(current, ctx);
    }
    return current;
  }

  async runTransformMemory(
    hook: "memory.write",
    initial: MemoryEntry,
  ): Promise<MemoryEntry> {
    let current = initial;
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook];
      if (!fn) continue;
      current = await fn(current, ctx);
    }
    return current;
  }

  async runTransformMemoryQuery(
    hook: "memory.query",
    initial: MemoryQuery,
  ): Promise<MemoryQuery> {
    let current = initial;
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook];
      if (!fn) continue;
      current = await fn(current, ctx);
    }
    return current;
  }

  async runTransformKnowledgeQuery(
    hook: "knowledge.query",
    initial: KnowledgeQuery,
  ): Promise<KnowledgeQuery> {
    let current = initial;
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook];
      if (!fn) continue;
      current = await fn(current, ctx);
    }
    return current;
  }

  async runTransformLLM(
    hook: "llm.call.before",
    initial: LLMCall,
  ): Promise<LLMCall> {
    let current = initial;
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks[hook];
      if (!fn) continue;
      current = await fn(current, ctx);
    }
    return current;
  }

  async runKnowledgeUpdate(
    paths: { docs?: string[]; code?: string[] },
  ): Promise<void> {
    const ctx = this.context();
    for (const p of this.list()) {
      const fn = p.hooks["knowledge.update"];
      if (!fn) continue;
      try {
        await fn(paths, ctx);
      } catch (err) {
        log.warn("plugin: knowledge.update failed", { plugin: p.name, err: String(err) });
      }
    }
  }

  private context(): PluginContext {
    if (this.contextProvider) return this.contextProvider();
    return {
      scope: null,
      config: {},
      log,
    };
  }
}

export const globalRegistry = new PluginRegistry();
