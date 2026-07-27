// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , private-git resolver
//
// Resolves plugins from a private Git server via SSH. For enterprise teams
// with internal plugin repos.

import type { RegistryResolver, PluginMetadata, PluginTarball } from "../registry-resolver";
import type { PluginListing, SearchFilters, RegistrySource } from "../types";

export interface PrivateGitResolverOptions {
  /** Base Git URL, e.g., git@gitlab.acme.internal:plugins */
  baseGitUrl?: string;
  /** SSH key env var name */
  sshKeyEnvVar?: string;
  /** Catalog endpoint listing available plugins (optional) */
  catalogUrl?: string;
  enabled?: boolean;
  fetchImpl?: typeof globalThis.fetch;
}

export class PrivateGitResolver implements RegistryResolver {
  readonly id: RegistrySource = "private-git";
  readonly name = "Private Git";
  enabled: boolean;

  private readonly baseGitUrl: string | undefined;
  private readonly catalogUrl: string | undefined;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: PrivateGitResolverOptions = {}) {
    this.baseGitUrl = options.baseGitUrl;
    this.catalogUrl = options.catalogUrl;
    this.enabled = options.enabled ?? false; // disabled until configured
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    // Private Git search needs a catalog endpoint; without it, return empty.
    if (!this.catalogUrl) return [];
    try {
      const url = new URL(this.catalogUrl);
      url.searchParams.set("q", query);
      const resp = await this.fetchImpl(url.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: { accept: "application/json" },
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as { plugins?: PluginListing[] };
      let listings = (data.plugins ?? []).map((p) => ({ ...p, source: this.id }));
      if (filters?.kind) {
        listings = listings.filter((l) => filters.kind!.includes(l.kind));
      }
      return listings;
    } catch {
      return [];
    }
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    if (!this.catalogUrl) {
      throw new Error("private-git: catalogUrl not configured");
    }
    const url = `${this.catalogUrl}/plugins/${encodeURIComponent(packageRef)}`;
    const resp = await this.fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      throw new Error(`private-git fetch failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as PluginMetadata;
  }

  async download(packageRef: string): Promise<PluginTarball> {
    // Returns the git SSH clone URL; actual clone happens in install flow
    // with the configured SSH key.
    const gitUrl = this.baseGitUrl ? `${this.baseGitUrl}/${packageRef}.git` : packageRef;
    return { extractedPath: gitUrl, hash: "" };
  }
}
