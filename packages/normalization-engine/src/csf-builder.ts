// SPDX-License-Identifier: Apache-2.0
// @orqenix/normalization-engine , CSF builder
//
// Helper to construct well-formed CSF from adapter-parsed fields, with
// provenance + content hash. Used by all input adapters.

import { blake3 } from "@noble/hashes/blake3";
import type { CanonicalSkillFormat, PluginKind } from "@orqenix/plugin-core";

export interface CsfBuilderInput {
  name: string;
  version: string;
  kind: PluginKind;
  /** Manifest fields */
  tool?: Record<string, unknown>;
  permissions?: string[];
  external_agent_compat?: string[];
  license?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
  /** Implementation fields */
  language?: "typescript" | "javascript" | "python" | "shell" | "wasm" | "declarative";
  entry?: string;
  source?: string;
  examples?: Array<{ name: string; input: unknown; expectedOutput: unknown }>;
  /** Provenance: the source format this was imported from */
  importedFromKind: string;
  importedFromUrl?: string;
  importedFromPath?: string;
  normalizerVersion: string;
  /** Original format payload preserved for lossless round-trip */
  originalFormatPreserved: unknown;
}

/**
 * Builds a CSF document from adapter-parsed fields, computing provenance +
 * content hash. The originalFormatPreserved field is critical for round-trip
 * fidelity (INV-15).
 */
export function buildCsf(input: CsfBuilderInput): CanonicalSkillFormat {
  const csf: CanonicalSkillFormat = {
    name: input.name,
    version: input.version,
    kind: input.kind,
    manifestVersion: "1.0",
    manifest: {
      ...(input.tool ? { tool: input.tool as never } : {}),
      permissions: input.permissions ?? [],
      external_agent_compat: input.external_agent_compat ?? [],
      license: input.license ?? "Apache-2.0",
      ...(input.homepage ? { homepage: input.homepage } : {}),
      ...(input.repository ? { repository: input.repository } : {}),
      keywords: input.keywords ?? [],
      compatibility: { orqenix: ">=0.8.0" },
      settingsHotReloadable: false,
      settingsHierarchyOverride: "project",
      sandboxMode: "separate_process",
    },
    implementation: {
      language: input.language ?? "declarative",
      entry: input.entry ?? "./index.js",
      ...(input.source ? { source: input.source } : {}),
      ...(input.examples ? { examples: input.examples } : {}),
    },
    provenance: {
      imported_from: {
        kind: input.importedFromKind,
        ...(input.importedFromUrl ? { original_url: input.importedFromUrl } : {}),
        ...(input.importedFromPath ? { original_path: input.importedFromPath } : {}),
        normalized_at: new Date().toISOString(),
        normalizer_version: input.normalizerVersion,
      },
      original_format_preserved: input.originalFormatPreserved,
      verification_status: "unverified",
      contentHash: "0".repeat(32), // computed below
    },
  };

  csf.provenance.contentHash = computeContentHash(csf);
  return csf;
}

/** Computes BLAKE3 content hash over canonical CSF (excludes signature + preserved) */
export function computeContentHash(csf: CanonicalSkillFormat): string {
  const canonical = JSON.stringify({
    name: csf.name,
    version: csf.version,
    kind: csf.kind,
    manifestVersion: csf.manifestVersion,
    manifest: csf.manifest,
    implementation: {
      language: csf.implementation.language,
      entry: csf.implementation.entry,
    },
  });
  const h = blake3(new TextEncoder().encode(canonical));
  return Array.from(h)
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Retrieves the original format payload from CSF provenance (for round-trip) */
export function getOriginalFormat<T = unknown>(csf: CanonicalSkillFormat): T | undefined {
  return csf.provenance.original_format_preserved as T | undefined;
}
