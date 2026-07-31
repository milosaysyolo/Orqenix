// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Plugin loader
//
// Discovers a plugin on the filesystem, parses its package.json, validates
// the manifest, and computes the CSF content hash for provenance.

import { readFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { blake3 } from "@noble/hashes/blake3";

import { validateManifest } from "./manifest-validator";
import { PluginKindRegistry } from "./kinds/registry";
import type { CanonicalSkillFormat } from "./csf-schema";
import type { PluginDiscoveryResult } from "./types";
import { PluginNotFoundError, ManifestInvalidError } from "./errors";

export interface PluginLoaderOptions {
  /** Optional kind registry override */
  kindRegistry?: PluginKindRegistry;
}

/**
 * Loads plugins from the filesystem.
 *
 * A plugin is a directory containing a package.json with an orqenixPlugin field.
 */
export class PluginLoader {
  private readonly kindRegistry: PluginKindRegistry;

  constructor(options: PluginLoaderOptions = {}) {
    this.kindRegistry = options.kindRegistry ?? new PluginKindRegistry();
  }

  /**
   * Loads and validates a single plugin from a package directory.
   *
   * @param packagePath Path to plugin package directory (containing package.json)
   * @returns Discovery result with parsed CSF + entry path
   */
  async load(packagePath: string): Promise<PluginDiscoveryResult> {
    const absPath = isAbsolute(packagePath) ? packagePath : resolve(process.cwd(), packagePath);

    const packageJsonPath = join(absPath, "package.json");
    if (!existsSync(packageJsonPath)) {
      throw new PluginNotFoundError(packageJsonPath);
    }

    let raw: string;
    try {
      raw = await readFile(packageJsonPath, "utf-8");
    } catch (err) {
      throw new PluginNotFoundError(packageJsonPath);
    }

    let pkg: unknown;
    try {
      pkg = JSON.parse(raw);
    } catch (err) {
      throw new ManifestInvalidError(`Failed to parse package.json at ${packageJsonPath}`, err);
    }

    // Validate manifest
    const result = validateManifest(pkg, this.kindRegistry);
    if (!result.valid || !result.csf) {
      return {
        csf: {} as CanonicalSkillFormat,
        packagePath: absPath,
        entryPath: "",
        isValidPlugin: false,
        issues: result.errors,
      };
    }

    const csf = result.csf;

    // Compute content hash for provenance (over canonical CSF minus signature)
    const contentHash = this.computeContentHash(csf);
    csf.provenance.contentHash = contentHash;

    // Resolve entry path (normalized to forward slashes for cross-platform determinism)
    const entryPath = (
      isAbsolute(csf.implementation.entry)
        ? csf.implementation.entry
        : join(absPath, csf.implementation.entry)
    ).replaceAll("\\", "/");

    return {
      csf,
      packagePath: absPath,
      entryPath,
      isValidPlugin: true,
      issues: result.warnings ?? [],
    };
  }

  /**
   * Loads multiple plugins from a directory (e.g., node_modules/@orqenix-plugins).
   * Skips non-plugin packages silently.
   */
  async loadAll(directory: string): Promise<PluginDiscoveryResult[]> {
    const absDir = isAbsolute(directory) ? directory : resolve(process.cwd(), directory);

    if (!existsSync(absDir)) {
      return [];
    }

    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(absDir, { withFileTypes: true });
    const results: PluginDiscoveryResult[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subPath = join(absDir, entry.name);

      // Handle scoped packages (@scope/pkg)
      if (entry.name.startsWith("@")) {
        const scopedEntries = await readdir(subPath, { withFileTypes: true });
        for (const scoped of scopedEntries) {
          if (!scoped.isDirectory()) continue;
          const scopedPath = join(subPath, scoped.name);
          if (existsSync(join(scopedPath, "package.json"))) {
            try {
              const r = await this.load(scopedPath);
              if (r.isValidPlugin) results.push(r);
            } catch {
              // Skip invalid packages silently in loadAll
            }
          }
        }
      } else if (existsSync(join(subPath, "package.json"))) {
        try {
          const r = await this.load(subPath);
          if (r.isValidPlugin) results.push(r);
        } catch {
          // Skip invalid packages silently in loadAll
        }
      }
    }

    return results;
  }

  /** Computes BLAKE3 content hash over canonical CSF (excludes signature) */
  private computeContentHash(csf: CanonicalSkillFormat): string {
    // Canonical form: stable key order, exclude provenance.sigstore_signature
    const canonical = JSON.stringify({
      name: csf.name,
      version: csf.version,
      kind: csf.kind,
      manifestVersion: csf.manifestVersion,
      manifest: csf.manifest,
      implementation: {
        language: csf.implementation.language,
        entry: csf.implementation.entry,
        // exclude source (may be large/external) from hash
      },
    });
    const bytes = new TextEncoder().encode(canonical);
    const hash = blake3(bytes);
    return Array.from(hash)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
