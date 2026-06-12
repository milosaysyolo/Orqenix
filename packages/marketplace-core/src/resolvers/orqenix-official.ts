// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , orqenix-official resolver
//
// Resolves plugins from plugins.orqenix.dev (the curated registry, Phase 8.2).
// URL is operator-configurable per Anti-pattern 39.

import type {
  RegistryResolver,
  PluginMetadata,
  PluginTarball,
} from '../registry-resolver';
import type { PluginListing, SearchFilters, RegistrySource } from '../types';

export interface OrqenixOfficialOptions {
  /** Registry base URL (default plugins.orqenix.dev; operator-configurable) */
  baseUrl?: string;
  enabled?: boolean;
  fetchImpl?: typeof globalThis.fetch;
}

export class OrqenixOfficialResolver implements RegistryResolver {
  readonly id: RegistrySource = 'orqenix-official';
  readonly name = 'Orqenix Official Registry';
  enabled: boolean;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: OrqenixOfficialOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://plugins.orqenix.dev').replace(/\/$/, '');
    this.enabled = options.enabled ?? true;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    const url = new URL(this.baseUrl + '/api/search');
    url.searchParams.set('q', query);
    if (filters?.kind) url.searchParams.set('kind', filters.kind.join(','));
    if (filters?.verified !== undefined) {
      url.searchParams.set('verified', String(filters.verified));
    }

    try {
      const resp = await this.fetchImpl(url.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: { accept: 'application/json', 'user-agent': '@orqenix/marketplace-core' },
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as { plugins?: PluginListing[] };
      return (data.plugins ?? []).map((p) => ({ ...p, source: this.id, verified: true }));
    } catch {
      return [];
    }
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    const url = this.baseUrl + '/api/plugins/' + encodeURIComponent(packageRef);
    const resp = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(`orqenix-official fetch failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as PluginMetadata;
  }

  async download(packageRef: string): Promise<PluginTarball> {
    // Download flow delegates to Phase 8.2 registry tarball endpoint.
    // For D8.β, return the download ref; actual extraction wired by Phase 8.2.
    const meta = await this.fetch(packageRef);
    return {
      extractedPath: meta.downloadRef,
      hash: '', // computed during Phase 8.2 download
    };
  }

  async reportEvent(event: { kind: string; pluginName: string }): Promise<void> {
    // Opt-in analytics (Phase 8.2). Best-effort, non-blocking.
    try {
      await this.fetchImpl(this.baseUrl + '/api/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // analytics failure is non-fatal
    }
  }
}
