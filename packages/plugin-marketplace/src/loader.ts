import { readFile } from "node:fs/promises";
import type { MarketplaceManifest, PluginEntry } from "./schema.js";
import { validateManifest } from "./schema.js";

export async function loadManifest(path: string): Promise<MarketplaceManifest> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  const v = validateManifest(parsed);
  if (!v.ok) {
    throw new Error(`Invalid manifest: ${JSON.stringify(v.errors)}`);
  }
  return parsed as MarketplaceManifest;
}

export function findPlugin(
  manifest: MarketplaceManifest,
  name: string
): PluginEntry | undefined {
  return manifest.plugins.find((p) => p.name === name);
}

export function listByCategory(
  manifest: MarketplaceManifest,
  category: string
): PluginEntry[] {
  return manifest.plugins.filter((p) => p.category === category);
}

export function resolveSource(entry: PluginEntry): {
  kind: "in-tree" | "url" | "git-subdir";
  identifier: string;
} {
  if (typeof entry.source === "string") {
    return { kind: "in-tree", identifier: entry.source };
  }
  if (entry.source.source === "url") {
    return { kind: "url", identifier: `${entry.source.url}@${entry.source.sha}` };
  }
  return {
    kind: "git-subdir",
    identifier: `${entry.source.url}/${entry.source.path}@${entry.source.sha}`,
  };
}
