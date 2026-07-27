// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , GitHub resolver
//
// Discovers Orqenix plugins via GitHub repository topic search (orqenix-plugin).

import type { RegistryResolver, PluginMetadata, PluginTarball } from "../registry-resolver";
import type { PluginListing, SearchFilters, RegistrySource } from "../types";

export interface GithubResolverOptions {
  apiUrl?: string;
  token?: string;
  enabled?: boolean;
  fetchImpl?: typeof globalThis.fetch;
}

export class GithubResolver implements RegistryResolver {
  readonly id: RegistrySource = "github";
  readonly name = "GitHub";
  enabled: boolean;

  private readonly apiUrl: string;
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: GithubResolverOptions = {}) {
    this.apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.token = options.token;
    this.enabled = options.enabled ?? false; // disabled by default (rate limits)
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async search(query: string, _filters?: SearchFilters): Promise<PluginListing[]> {
    const url = new URL(this.apiUrl + "/search/repositories");
    url.searchParams.set("q", `${query} topic:orqenix-plugin`);
    url.searchParams.set("per_page", "30");

    try {
      const headers: Record<string, string> = {
        accept: "application/vnd.github+json",
        "user-agent": "@orqenix/marketplace-core",
      };
      if (this.token) headers.authorization = `Bearer ${this.token}`;

      const resp = await this.fetchImpl(url.toString(), {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        items?: Array<{
          full_name: string;
          description?: string;
          html_url: string;
          owner: { login: string };
        }>;
      };
      return (data.items ?? []).map((repo) => ({
        name: repo.full_name,
        version: "latest",
        description: repo.description ?? "",
        kind: "skill" as const,
        license: "unknown",
        external_agent_compat: [],
        verified: false,
        publisher: repo.owner.login,
        source: this.id,
        homepageUrl: repo.html_url,
        repositoryUrl: repo.html_url,
      }));
    } catch {
      return [];
    }
  }

  async fetch(packageRef: string): Promise<PluginMetadata> {
    // packageRef is owner/repo; fetch package.json from default branch
    const url = `${this.apiUrl}/repos/${packageRef}/contents/package.json`;
    const headers: Record<string, string> = {
      accept: "application/vnd.github.raw+json",
      "user-agent": "@orqenix/marketplace-core",
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    const resp = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      throw new Error(`github fetch failed: HTTP ${resp.status}`);
    }
    const pkg = (await resp.json()) as Record<string, unknown>;
    const op = (pkg.orqenixPlugin ?? {}) as Record<string, unknown>;
    return {
      name: pkg.name as string,
      version: (pkg.version as string) ?? "latest",
      kind: (op.kind as string) ?? "skill",
      license: (pkg.license as string) ?? "unknown",
      description: (pkg.description as string) ?? "",
      permissions: (op.permissions as string[]) ?? [],
      external_agent_compat: (op.external_agent_compat as string[]) ?? [],
      verified: false,
      packageJson: pkg,
      downloadRef: `https://github.com/${packageRef}`,
    };
  }

  async download(packageRef: string): Promise<PluginTarball> {
    // git clone delegated to install flow; return repo URL
    return { extractedPath: `https://github.com/${packageRef}`, hash: "" };
  }
}
