// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , local-file resolver
//
// Resolves plugins from a local filesystem directory (development mode).

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import type {
  RegistryResolver,
  PluginMetadata,
  PluginTarball,
} from '../registry-resolver';
import type { PluginListing, SearchFilters, RegistrySource } from '../types';

export interface LocalFileResolverOptions {
  /** Directory to scan for plugins (default cwd/plugins) */
  pluginsDir?: string;
  enabled?: boolean;
}

export class LocalFileResolver implements RegistryResolver {
  readonly id: RegistrySource = 'local-file';
  readonly name = 'Local Filesystem';
  enabled: boolean;

  private readonly pluginsDir: string;

  constructor(options: LocalFileResolverOptions = {}) {
    this.pluginsDir = options.pluginsDir ?? join(process.cwd(), 'plugins');
    this.enabled = options.enabled ?? true;
  }

  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    if (!existsSync(this.pluginsDir)) return [];
    const entries = await readdir(this.pluginsDir, { withFileTypes: true });
    const listings: PluginListing[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(this.pluginsDir, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as Record<string, unknown>;
        if (!pkg.orqenixPlugin) continue;
        const op = pkg.orqenixPlugin as Record<string, unknown>;
        const listing: PluginListing = {
          name: pkg.name as string,
          version: (pkg.version as string) ?? '0.0.0',
          description: (pkg.description as string) ?? '',
          kind: (op.kind as PluginListing['kind']) ?? 'skill',
          license: (pkg.license as string) ?? 'unknown',
          external_agent_compat: (op.external_agent_compat as string[]) ?? [],
          verified: false,
          publisher: 'local',
          source: this.id,
        };
        // Text match
        const haystack = `${listing.name} ${listing.description}`.toLowerCase();
        if (query.length === 0 || haystack.includes(query.toLowerCase())) {
          listings.push(listing);
        }
      } catch {
        // skip invalid
      }
    }

    if (filters?.kind) {
      return listings.filter((l) => filters.kind!.includes(l.kind));
    }
    return listings;
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    const safeRef = packageRef.replace('@', '').replace(/[\\/]+/g, '-');
    const dir = resolve(this.pluginsDir, safeRef);
    if (!dir.startsWith(resolve(this.pluginsDir) + sep)) {
      throw new Error(`local-file: invalid package ref ${packageRef}`);
    }
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) {
      throw new Error(`local-file: plugin ${packageRef} not found at ${dir}`);
    }
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as Record<string, unknown>;
    const op = (pkg.orqenixPlugin ?? {}) as Record<string, unknown>;
    return {
      name: pkg.name as string,
      version: pkg.version as string,
      kind: (op.kind as string) ?? 'skill',
      license: (pkg.license as string) ?? 'unknown',
      description: (pkg.description as string) ?? '',
      permissions: (op.permissions as string[]) ?? [],
      external_agent_compat: (op.external_agent_compat as string[]) ?? [],
      verified: false,
      packageJson: pkg,
      downloadRef: dir,
    };
  }

  async download(packageRef: string): Promise<PluginTarball> {
    const safeRef = packageRef.replace('@', '').replace(/[\\/]+/g, '-');
    const dir = resolve(this.pluginsDir, safeRef);
    if (!dir.startsWith(resolve(this.pluginsDir) + sep)) {
      throw new Error(`local-file: invalid package ref ${packageRef}`);
    }
    return { extractedPath: dir, hash: '' };
  }
}
