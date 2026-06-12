// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , Marketplace manager (top-level facade)
//
// Coordinates CRUD + registry resolution + import/export + install/uninstall.
// Per CR v8.0 Chapter 6.

import { NormalizationEngine } from '@orqenix/normalization-engine';
import { PluginLifecycle } from '@orqenix/plugin-core';
import { MarketplaceCrud, type LocalPluginStore, type MarketplaceAuditWriter } from './crud';
import { RegistryResolverRegistry } from './registry-resolver';
import {
  type PluginListing,
  type SearchFilters,
  type ImportInput,
  type ExportInput,
  type ImportResult,
  type ExportResult,
  type CreatePluginInput,
  type UpdatePluginInput,
  type ForkPluginInput,
  type DeletePluginInput,
  type CrudResult,
} from './types';

export interface MarketplaceManagerOptions {
  store: LocalPluginStore;
  audit: MarketplaceAuditWriter;
  normalizationEngine: NormalizationEngine;
  lifecycle: PluginLifecycle;
  resolverRegistry?: RegistryResolverRegistry;
  actor?: string;
}

/**
 * Top-level marketplace facade. The Workbench + Cloud UI both call this.
 */
export class MarketplaceManager {
  private readonly crud: MarketplaceCrud;
  private readonly normalization: NormalizationEngine;
  private readonly lifecycle: PluginLifecycle;
  private readonly resolvers: RegistryResolverRegistry;
  private readonly store: LocalPluginStore;
  private readonly audit: MarketplaceAuditWriter;
  private readonly actor: string;

  constructor(options: MarketplaceManagerOptions) {
    this.store = options.store;
    this.audit = options.audit;
    this.normalization = options.normalizationEngine;
    this.lifecycle = options.lifecycle;
    this.resolvers = options.resolverRegistry ?? new RegistryResolverRegistry();
    this.actor = options.actor ?? 'user';
    this.crud = new MarketplaceCrud(options.store, options.audit, this.actor);
  }

  // ─── CRUD ────────────────────────────────────────────────────────────

  create(input: CreatePluginInput): Promise<CrudResult> {
    return this.crud.create(input);
  }
  update(input: UpdatePluginInput): Promise<CrudResult> {
    return this.crud.update(input);
  }
  delete(input: DeletePluginInput): Promise<CrudResult> {
    return this.crud.delete(input);
  }
  fork(input: ForkPluginInput): Promise<CrudResult> {
    return this.crud.fork(input);
  }

  // ─── Read (search across registries) ─────────────────────────────────

  /** Search across all enabled registry sources */
  async search(query: string, filters?: SearchFilters): Promise<PluginListing[]> {
    const enabledSources = filters?.source ?? this.resolvers.listEnabled();
    const perSource = await Promise.allSettled(
      enabledSources.map((src) =>
        this.resolvers.getResolver(src).search(query, filters)
      )
    );
    const merged: PluginListing[] = [];
    for (const res of perSource) {
      if (res.status === 'fulfilled') {
        merged.push(...res.value);
      }
    }
    // Sort verified first, then by name
    return merged.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  // ─── Import / Export ─────────────────────────────────────────────────

  /** Import an external plugin → CSF → local store */
  async import(input: ImportInput): Promise<ImportResult> {
    try {
      const result = await this.normalization.import({
        ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
        ...(input.url ? { url: input.url } : {}),
        ...(input.path ? { path: input.path } : {}),
        ...(input.content ? { content: input.content } : {}),
      });

      await this.store.set(result.csf);
      await this.audit.append({
        kind: 'marketplace.import_succeeded',
        ts: new Date().toISOString(),
        actor: { user: this.actor },
        payload: {
          name: result.csf.name,
          adapterKind: result.adapter.kind,
          csfHash: result.csf.provenance.contentHash,
        },
      });

      return {
        ok: true,
        pluginName: result.csf.name,
        csfHash: result.csf.provenance.contentHash,
        warnings: result.warnings,
        adapterKind: result.adapter.kind,
      };
    } catch (err) {
      await this.audit.append({
        kind: 'marketplace.import_failed',
        ts: new Date().toISOString(),
        actor: { user: this.actor },
        payload: { error: (err as Error).message },
      });
      return { ok: false, warnings: [(err as Error).message] };
    }
  }

  /** Export a local plugin → target platform format */
  async export(input: ExportInput): Promise<ExportResult> {
    const csf = await this.store.get(input.pluginName);
    if (!csf) {
      return { ok: false, lossyFields: [`Plugin ${input.pluginName} not found`] };
    }

    const result = await this.normalization.export(csf, input.targetKind);

    // Lossy guard per CR v8.0 Section 8.6
    if (result.report.lossyFields.length > 0 && !input.acceptLossy) {
      await this.audit.append({
        kind: 'marketplace.export_lossy_rejected',
        ts: new Date().toISOString(),
        actor: { user: this.actor },
        payload: {
          name: input.pluginName,
          targetKind: input.targetKind,
          lossyFields: result.report.lossyFields,
        },
      });
      return {
        ok: false,
        lossyFields: result.report.lossyFields,
      };
    }

    await this.audit.append({
      kind: 'marketplace.export_succeeded',
      ts: new Date().toISOString(),
      actor: { user: this.actor },
      payload: {
        name: input.pluginName,
        targetKind: input.targetKind,
        lossy: result.report.lossyFields.length > 0,
      },
    });

    return {
      ok: true,
      output: result.output.content,
      lossyFields: result.report.lossyFields,
      ...(result.output.suggestedPath ? { suggestedPath: result.output.suggestedPath } : {}),
    };
  }

  // ─── Install / Uninstall (delegates to plugin-core lifecycle) ────────

  /** Installs a plugin from a resolved package path */
  async install(packagePath: string): Promise<void> {
    await this.lifecycle.install(packagePath);
  }

  /** Uninstalls a plugin */
  async uninstall(name: string): Promise<void> {
    await this.lifecycle.uninstall(name);
  }

  // ─── Accessors ───────────────────────────────────────────────────────

  getResolverRegistry(): RegistryResolverRegistry {
    return this.resolvers;
  }
}
