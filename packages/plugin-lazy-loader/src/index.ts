import { readFile, stat } from "node:fs/promises";
import { hashString } from "@orqenix/core";
import type { OrqenixPlugin } from "@orqenix/core/plugin";

export interface LazyLoaderConfig {
  enabled: boolean;
  cacheMaxBytes: number;
  hashCheckOnRead: boolean;
}

const DEFAULT_CONFIG: LazyLoaderConfig = {
  enabled: true,
  cacheMaxBytes: 50 * 1024 * 1024,
  hashCheckOnRead: true,
};

export interface FileHandle {
  path: string;
  size: number;
  hash: string;
  lastModified: number;
}

interface CacheEntry {
  handle: FileHandle;
  content: string;
  size: number;
  accessedAt: number;
}

export class LazyContentLoader {
  private cache = new Map<string, CacheEntry>();
  private totalBytes = 0;
  constructor(private config: LazyLoaderConfig = DEFAULT_CONFIG) {}

  async createHandle(path: string): Promise<FileHandle> {
    const st = await stat(path);
    const content = await readFile(path, "utf-8");
    return {
      path,
      size: st.size,
      hash: hashString(content),
      lastModified: st.mtimeMs,
    };
  }

  async load(handle: FileHandle): Promise<string> {
    const cached = this.cache.get(handle.path);
    if (cached && cached.handle.hash === handle.hash) {
      cached.accessedAt = Date.now();
      return cached.content;
    }

    const content = await readFile(handle.path, "utf-8");
    if (this.config.hashCheckOnRead) {
      const currentHash = hashString(content);
      if (currentHash !== handle.hash) {
        throw new Error(
          `Lazy loader: file modified since handle created (${handle.path}). ` +
            `Expected hash ${handle.hash}, got ${currentHash}.`,
        );
      }
    }
    this.evictIfNeeded(content.length);
    this.cache.set(handle.path, {
      handle,
      content,
      size: content.length,
      accessedAt: Date.now(),
    });
    this.totalBytes += content.length;
    return content;
  }

  async tokenizeReferences(
    text: string,
    paths: string[],
  ): Promise<{ transformed: string; handles: Map<string, FileHandle> }> {
    const handles = new Map<string, FileHandle>();
    let transformed = text;
    for (const path of paths) {
      try {
        const handle = await this.createHandle(path);
        handles.set(path, handle);
        const placeholder = `[orqenix:lazy-ref ${path}#${handle.hash.slice(0, 8)} (${handle.size} bytes)]`;
        transformed = transformed.replace(path, placeholder);
      } catch {
        /* skip unreadable paths */
      }
    }
    return { transformed, handles };
  }

  private evictIfNeeded(incomingBytes: number): void {
    while (this.totalBytes + incomingBytes > this.config.cacheMaxBytes && this.cache.size > 0) {
      const entries = [...this.cache.entries()].sort(
        (a, b) => a[1].accessedAt - b[1].accessedAt,
      );
      const oldest = entries[0];
      if (!oldest) break;
      this.cache.delete(oldest[0]);
      this.totalBytes -= oldest[1].size;
    }
  }

  stats() {
    return {
      entries: this.cache.size,
      totalBytes: this.totalBytes,
      capacity: this.config.cacheMaxBytes,
    };
  }

  clear(): void {
    this.cache.clear();
    this.totalBytes = 0;
  }
}

export const loader = new LazyContentLoader();

export function createPlugin(userConfig: Partial<LazyLoaderConfig> = {}): OrqenixPlugin {
  const config: LazyLoaderConfig = { ...DEFAULT_CONFIG, ...userConfig };

  return {
    name: "lazy-loader",
    version: "0.3.0-dev",
    description: "Reference-not-embed file content loader",
    priority: 95,
    capabilities: ["lazy-loading", "context-management"],
    hooks: {
      "session.start": async (_session, ctx) => {
        ctx.log.debug("lazy-loader: ready");
      },
    },
  };
}

export const plugin = createPlugin();
export default plugin;
