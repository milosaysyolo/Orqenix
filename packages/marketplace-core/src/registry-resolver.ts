// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , Registry resolver
//
// Registry sources are interchangeable via the RegistryResolver interface.
// Per CR v8.0 Section 6.3.1 + Anti-pattern 39 (no hardcoded URLs in core).

import type { PluginListing, SearchFilters, RegistrySource } from "./types";

/** Plugin metadata (fetched before install) */
export interface PluginMetadata {
  name: string;
  version: string;
  kind: string;
  license: string;
  description: string;
  permissions: string[];
  external_agent_compat: string[];
  verified: boolean;
  /** package.json with orqenixPlugin field */
  packageJson: Record<string, unknown>;
  /** Download URL or local path */
  downloadRef: string;
}

/** Downloaded plugin tarball / directory reference */
export interface PluginTarball {
  /** Local path where plugin was extracted */
  extractedPath: string;
  /** BLAKE3 hash of the tarball */
  hash: string;
}

/** Optional analytics event reported to registry */
export interface RegistryEvent {
  kind: "install" | "uninstall" | "view";
  pluginName: string;
}

/**
 * RegistryResolver , the contract each registry source implements.
 *
 * Per Anti-pattern 39: the marketplace MUST resolve registries through these
 * implementations, never hardcode URLs in core code.
 */
export interface RegistryResolver {
  /** Unique resolver identifier */
  readonly id: RegistrySource;
  /** Display name */
  readonly name: string;
  /** Whether this resolver is currently enabled */
  enabled: boolean;

  /** Search plugins by query string with optional filters */
  search(query: string, filters?: SearchFilters): Promise<PluginListing[]>;

  /** Fetch plugin metadata by name@version */
  fetch(packageRef: string): Promise<PluginMetadata>;

  /** Download a plugin tarball for install */
  download(packageRef: string): Promise<PluginTarball>;

  /** Optional: report analytics back to the registry */
  reportEvent?(event: RegistryEvent): Promise<void>;
}

/**
 * Registry of resolvers. Operators enable/disable sources here.
 */
export class RegistryResolverRegistry {
  private resolvers: Map<RegistrySource, RegistryResolver> = new Map();

  constructor(resolvers?: RegistryResolver[]) {
    if (resolvers) {
      for (const r of resolvers) this.resolvers.set(r.id, r);
    }
  }

  /** Registers a resolver */
  register(resolver: RegistryResolver): void {
    this.resolvers.set(resolver.id, resolver);
  }

  /** Returns a resolver by source, or throws */
  getResolver(source: RegistrySource): RegistryResolver {
    const r = this.resolvers.get(source);
    if (!r) {
      throw new Error(
        `No resolver registered for source '${source}'. Register one via RegistryResolverRegistry.register().`,
      );
    }
    return r;
  }

  /** Returns true if a resolver exists for the source */
  has(source: RegistrySource): boolean {
    return this.resolvers.has(source);
  }

  /** Lists all enabled source identifiers */
  listEnabled(): RegistrySource[] {
    return Array.from(this.resolvers.values())
      .filter((r) => r.enabled)
      .map((r) => r.id);
  }

  /** Lists all registered source identifiers (enabled or not) */
  listAll(): RegistrySource[] {
    return Array.from(this.resolvers.keys());
  }

  /** Enables or disables a resolver */
  setEnabled(source: RegistrySource, enabled: boolean): void {
    const r = this.resolvers.get(source);
    if (r) r.enabled = enabled;
  }
}
