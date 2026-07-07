// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , CRUD operations
//
// Create / Update / Delete / Fork operations on local plugins. Per CR v8.0
// Section 6.4. Each operation audits + validates via plugin-core conformance.

import { blake3 } from "@noble/hashes/blake3";
import {
  assertValidManifest,
  ConformanceSuite,
  type CanonicalSkillFormat,
  type PluginKind,
} from "@orqenix/plugin-core";
import {
  type CreatePluginInput,
  type UpdatePluginInput,
  type ForkPluginInput,
  type DeletePluginInput,
  type CrudResult,
  type MarketplaceAuditKind,
} from "./types";

/** Interface for persisting local plugin CSF documents */
export interface LocalPluginStore {
  get(name: string): Promise<CanonicalSkillFormat | null>;
  set(csf: CanonicalSkillFormat): Promise<void>;
  delete(name: string): Promise<void>;
  list(): Promise<CanonicalSkillFormat[]>;
}

/** Audit writer interface (provided by memory-engine) */
export interface MarketplaceAuditWriter {
  append(event: {
    kind: MarketplaceAuditKind;
    ts: string;
    actor: { user: string };
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export class CrudOperationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CrudOperationError";
    Object.setPrototypeOf(this, CrudOperationError.prototype);
  }
}

export class MarketplaceCrud {
  private readonly conformance: ConformanceSuite;

  constructor(
    private readonly store: LocalPluginStore,
    private readonly audit: MarketplaceAuditWriter,
    private readonly actor: string = "user",
  ) {
    this.conformance = new ConformanceSuite();
  }

  /** Create a new plugin from a CSF template */
  async create(input: CreatePluginInput): Promise<CrudResult> {
    const existing = await this.store.get(input.name);
    if (existing) {
      throw new CrudOperationError(
        "PLUGIN_EXISTS",
        `Plugin ${input.name} already exists. Use update or fork.`,
      );
    }

    const csf = this.buildCsfFromCreate(input);
    csf.provenance.contentHash = this.computeHash(csf);

    // Validate
    assertValidManifest(this.csfToPackageJson(csf));

    await this.store.set(csf);
    await this.auditEvent("marketplace.crud_create", {
      name: csf.name,
      version: csf.version,
      kind: csf.kind,
    });

    return { ok: true, pluginName: csf.name, version: csf.version };
  }

  /** Update an existing plugin (version bump + re-validate) */
  async update(input: UpdatePluginInput): Promise<CrudResult> {
    const existing = await this.store.get(input.name);
    if (!existing) {
      throw new CrudOperationError("PLUGIN_NOT_FOUND", `Plugin ${input.name} not found`);
    }

    const oldVersion = existing.version;
    const newVersion = this.bumpVersion(oldVersion, input.bump);

    // Apply changes
    const updated: CanonicalSkillFormat = {
      ...existing,
      version: newVersion,
      manifest: { ...existing.manifest, ...((input.changes.manifest as object) ?? {}) },
    };
    updated.provenance.contentHash = this.computeHash(updated);

    // Re-validate + conformance check
    assertValidManifest(this.csfToPackageJson(updated));
    this.conformance.assert(updated);

    await this.store.set(updated);
    await this.auditEvent("marketplace.crud_update", {
      name: input.name,
      oldVersion,
      newVersion,
      changesSummary: input.changesSummary ?? "",
    });

    return { ok: true, pluginName: input.name, version: newVersion };
  }

  /** Delete a plugin (requires typed confirmation) */
  async delete(input: DeletePluginInput): Promise<CrudResult> {
    const expected = `DELETE ${input.name}`;
    if (input.confirmation !== expected) {
      throw new CrudOperationError(
        "CONFIRMATION_MISMATCH",
        `Confirmation must be exactly "${expected}"`,
      );
    }

    const existing = await this.store.get(input.name);
    if (!existing) {
      throw new CrudOperationError("PLUGIN_NOT_FOUND", `Plugin ${input.name} not found`);
    }

    await this.store.delete(input.name);
    await this.auditEvent("marketplace.crud_delete", {
      name: input.name,
      version: existing.version,
    });

    return { ok: true, pluginName: input.name };
  }

  /** Fork a plugin into a new namespace */
  async fork(input: ForkPluginInput): Promise<CrudResult> {
    const source = await this.store.get(input.sourceName);
    if (!source) {
      throw new CrudOperationError(
        "PLUGIN_NOT_FOUND",
        `Source plugin ${input.sourceName} not found`,
      );
    }

    const existing = await this.store.get(input.newName);
    if (existing) {
      throw new CrudOperationError("PLUGIN_EXISTS", `Target ${input.newName} already exists`);
    }

    // Clone + rename + reset version to 0.1.0
    const forked: CanonicalSkillFormat = {
      ...structuredClone(source),
      name: input.newName,
      version: "0.1.0",
    };
    forked.provenance.contentHash = this.computeHash(forked);

    await this.store.set(forked);
    await this.auditEvent("marketplace.fork_created", {
      sourceName: input.sourceName,
      forkedTo: input.newName,
    });

    return { ok: true, pluginName: input.newName, version: "0.1.0" };
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private buildCsfFromCreate(input: CreatePluginInput): CanonicalSkillFormat {
    return {
      name: input.name,
      version: "0.1.0",
      kind: input.kind as PluginKind,
      manifestVersion: "1.0",
      manifest: {
        ...(input.tool ? { tool: input.tool as never } : {}),
        permissions: input.permissions,
        external_agent_compat: input.external_agent_compat,
        license: "Apache-2.0",
        keywords: [],
        compatibility: { orqenix: ">=0.8.0" },
        settingsHotReloadable: false,
        settingsHierarchyOverride: "project",
        sandboxMode: "separate_process",
      },
      implementation: {
        language: "typescript",
        entry: "./dist/plugin.js",
      },
      provenance: {
        verification_status: "unverified",
        contentHash: "0".repeat(32),
      },
    };
  }

  private csfToPackageJson(csf: CanonicalSkillFormat): Record<string, unknown> {
    return {
      name: csf.name,
      version: csf.version,
      license: csf.manifest.license,
      main: csf.implementation.entry,
      keywords: csf.manifest.keywords,
      orqenixPlugin: {
        manifestVersion: csf.manifestVersion,
        kind: csf.kind,
        compatibility: csf.manifest.compatibility,
        permissions: csf.manifest.permissions,
        external_agent_compat: csf.manifest.external_agent_compat,
        tool: csf.manifest.tool,
        sandboxMode: csf.manifest.sandboxMode,
      },
    };
  }

  private bumpVersion(version: string, bump: "patch" | "minor" | "major"): string {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!m) return "0.1.0";
    let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (bump === "major") {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (bump === "minor") {
      minor += 1;
      patch = 0;
    } else {
      patch += 1;
    }
    return `${major}.${minor}.${patch}`;
  }

  private computeHash(csf: CanonicalSkillFormat): string {
    const canonical = JSON.stringify({
      name: csf.name,
      version: csf.version,
      kind: csf.kind,
      manifest: csf.manifest,
    });
    const h = blake3(new TextEncoder().encode(canonical));
    return Array.from(h)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async auditEvent(
    kind: MarketplaceAuditKind,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.append({
      kind,
      ts: new Date().toISOString(),
      actor: { user: this.actor },
      payload,
    });
  }
}
