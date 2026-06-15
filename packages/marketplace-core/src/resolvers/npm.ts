// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , npm resolver
//
// Discovers Orqenix plugins on the npm registry by their orqenixPlugin field.

import type {
  RegistryResolver,
  PluginMetadata,
  PluginTarball,
} from '../registry-resolver';
import type { PluginListing, SearchFilters, RegistrySource } from '../types';

export interface NpmResolverOptions {
  registryUrl?: string;
  enabled?: boolean;
  fetchImpl?: typeof globalThis.fetch;
}

export class NpmRegistryResolver implements RegistryResolver {
  readonly id: RegistrySource = 'npm';
  readonly name = 'npm Registry';
  enabled: boolean;

  private readonly registryUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: NpmResolverOptions = {}) {
    this.registryUrl = (options.registryUrl ?? 'https://registry.npmjs.org').replace(/\/$/, '');
    this.enabled = options.enabled ?? true;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    // npm search API: -/v1/search?text=...
    const url = new URL(this.registryUrl + '/-/v1/search');
    // Bias search toward orqenix plugins
    url.searchParams.set('text', `${query} keywords:orqenix-plugin`);
    url.searchParams.set('size', '50');

    try {
      const resp = await this.fetchImpl(url.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: { accept: 'application/json' },
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        objects?: Array<{
          package: {
            name: string;
            version: string;
            description?: string;
            keywords?: string[];
            links?: { homepage?: string; repository?: string };
          };
        }>;
      };

      const listings: PluginListing[] = [];
      for (const obj of data.objects ?? []) {
        const pkg = obj.package;
        // Only include packages flagged as orqenix plugins
        if (!pkg.keywords?.includes('orqenix-plugin') && !pkg.keywords?.includes('orqenix')) {
          continue;
        }
        listings.push({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description ?? '',
          kind: 'skill', // refined on fetch
          license: 'unknown',
          external_agent_compat: [],
          verified: false, // npm packages unverified by default
          publisher: 'npm',
          source: this.id,
          ...(pkg.links?.homepage ? { homepageUrl: pkg.links.homepage } : {}),
          ...(pkg.links?.repository ? { repositoryUrl: pkg.links.repository } : {}),
        });
      }
      // Apply kind filter if requested
      if (filters?.kind) {
        return listings.filter((l) => filters.kind!.includes(l.kind));
      }
      return listings;
    } catch {
      return [];
    }
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    const url = this.registryUrl + '/' + packageRef.replace('@', '%40');
    const resp = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(`npm fetch failed: HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as {
      'dist-tags'?: { latest?: string };
      versions?: Record<string, Record<string, unknown>>;
    };
    const latest = data['dist-tags']?.latest;
    const pkg = latest ? data.versions?.[latest] : undefined;
    if (!pkg) {
      throw new Error(`npm package ${packageRef} has no latest version`);
    }
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
      downloadRef: ((pkg.dist as { tarball?: string })?.tarball) ?? '',
    };
  }

  async download(packageRef: string): Promise<PluginTarball> {
    const meta = await this.fetch(packageRef);
    return { extractedPath: meta.downloadRef, hash: '' };
  }
}
