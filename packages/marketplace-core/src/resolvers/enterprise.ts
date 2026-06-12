// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , enterprise resolver
//
// Generic resolver for custom internal registries. Operators provide a base
// URL implementing the Orqenix registry API contract.

import type {
  RegistryResolver,
  PluginMetadata,
  PluginTarball,
} from '../registry-resolver';
import type { PluginListing, SearchFilters, RegistrySource } from '../types';

export interface EnterpriseResolverOptions {
  /** Custom registry base URL */
  baseUrl?: string;
  /** Auth token for the enterprise registry */
  authToken?: string;
  enabled?: boolean;
  fetchImpl?: typeof globalThis.fetch;
}

export class EnterpriseResolver implements RegistryResolver {
  readonly id: RegistrySource = 'enterprise';
  readonly name = 'Enterprise Registry';
  enabled: boolean;

  private readonly baseUrl: string | undefined;
  private readonly authToken: string | undefined;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: EnterpriseResolverOptions = {}) {
    this.baseUrl = options.baseUrl ? options.baseUrl.replace(/\/$/, '') : undefined;
    this.authToken = options.authToken;
    this.enabled = options.enabled ?? false; // disabled until configured
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      accept: 'application/json',
      'user-agent': '@orqenix/marketplace-core',
    };
    if (this.authToken) h.authorization = `Bearer ${this.authToken}`;
    return h;
  }

  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    if (!this.baseUrl) return [];
    try {
      const url = new URL(this.baseUrl + '/api/search');
      url.searchParams.set('q', query);
      if (filters?.kind) url.searchParams.set('kind', filters.kind.join(','));
      const resp = await this.fetchImpl(url.toString(), {
        headers: this.headers(),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as { plugins?: PluginListing[] };
      return (data.plugins ?? []).map((p) => ({ ...p, source: this.id }));
    } catch {
      return [];
    }
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    if (!this.baseUrl) {
      throw new Error('enterprise: baseUrl not configured');
    }
    const url = this.baseUrl + '/api/plugins/' + encodeURIComponent(packageRef);
    const resp = await this.fetchImpl(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      throw new Error(`enterprise fetch failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as PluginMetadata;
  }

  async download(packageRef: string): Promise<PluginTarball> {
    const meta = await this.fetch(packageRef);
    return { extractedPath: meta.downloadRef, hash: '' };
  }
}
