// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , Type definitions

import { z } from "zod";
import type { PluginKind } from "@orqenix/plugin-core";

// ─────────────────────────────────────────────────────────────────────────
// Registry source identifiers
// ─────────────────────────────────────────────────────────────────────────

export type RegistrySource =
  | "orqenix-official"
  | "npm"
  | "github"
  | "local-file"
  | "private-git"
  | "enterprise";

export const RegistrySourceSchema = z.enum([
  "orqenix-official",
  "npm",
  "github",
  "local-file",
  "private-git",
  "enterprise",
]);

// ─────────────────────────────────────────────────────────────────────────
// Plugin listing (search result)
// ─────────────────────────────────────────────────────────────────────────

export interface PluginListing {
  name: string;
  version: string;
  description: string;
  kind: PluginKind;
  license: string;
  external_agent_compat: string[];
  verified: boolean;
  publisher: string;
  source: RegistrySource;
  installCount?: number;
  rating?: number;
  homepageUrl?: string;
  repositoryUrl?: string;
}

export interface SearchFilters {
  kind?: PluginKind[];
  license?: string[];
  external_agent_compat?: string[];
  verified?: boolean;
  source?: RegistrySource[];
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD inputs
// ─────────────────────────────────────────────────────────────────────────

export const CreatePluginInputSchema = z.object({
  name: z.string().regex(/^(@[a-z0-9][\w-]*\/)?[a-z0-9][\w-]*$/),
  kind: z.string(),
  description: z.string(),
  /** Initial CSF template fields */
  tool: z.record(z.unknown()).optional(),
  permissions: z.array(z.string()).default([]),
  external_agent_compat: z.array(z.string()).default([]),
});

export type CreatePluginInput = z.infer<typeof CreatePluginInputSchema>;

export const UpdatePluginInputSchema = z.object({
  name: z.string(),
  /** Semver bump kind */
  bump: z.enum(["patch", "minor", "major"]),
  /** Changed CSF fields */
  changes: z.record(z.unknown()),
  changesSummary: z.string().optional(),
});

export type UpdatePluginInput = z.infer<typeof UpdatePluginInputSchema>;

export const ForkPluginInputSchema = z.object({
  sourceName: z.string(),
  /** New namespace, e.g., @local/my-fork */
  newName: z.string().regex(/^(@[a-z0-9][\w-]*\/)?[a-z0-9][\w-]*$/),
});

export type ForkPluginInput = z.infer<typeof ForkPluginInputSchema>;

export const DeletePluginInputSchema = z.object({
  name: z.string(),
  /** Typed confirmation phrase: "DELETE @<name>" */
  confirmation: z.string(),
});

export type DeletePluginInput = z.infer<typeof DeletePluginInputSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Import / Export inputs
// ─────────────────────────────────────────────────────────────────────────

export const ImportInputSchema = z.object({
  /** Source format hint, or auto-detect if omitted */
  sourceKind: z.string().optional(),
  /** Source URL (npm/github/direct) */
  url: z.string().optional(),
  /** Local file path */
  path: z.string().optional(),
  /** Inline content (for paste) */
  content: z.string().optional(),
});

export type ImportInput = z.infer<typeof ImportInputSchema>;

export const ExportInputSchema = z.object({
  pluginName: z.string(),
  /** Target output adapter kind */
  targetKind: z.string(),
  /** Proceed even if export is lossy */
  acceptLossy: z.boolean().default(false),
});

export type ExportInput = z.infer<typeof ExportInputSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Marketplace audit kinds (CR v8.0 Section 4.9)
// ─────────────────────────────────────────────────────────────────────────

export type MarketplaceAuditKind =
  | "marketplace.crud_create"
  | "marketplace.crud_update"
  | "marketplace.crud_delete"
  | "marketplace.fork_created"
  | "marketplace.import_succeeded"
  | "marketplace.import_failed"
  | "marketplace.export_succeeded"
  | "marketplace.export_lossy_rejected";

// ─────────────────────────────────────────────────────────────────────────
// Operation results
// ─────────────────────────────────────────────────────────────────────────

export interface CrudResult {
  ok: boolean;
  pluginName: string;
  version?: string;
  auditId?: string;
}

export interface ImportResult {
  ok: boolean;
  pluginName?: string;
  csfHash?: string;
  warnings: string[];
  /** The adapter that handled the import */
  adapterKind?: string;
}

export interface ExportResult {
  ok: boolean;
  /** Serialized output */
  output?: string;
  /** Lossy fields if export was lossy */
  lossyFields: string[];
  /** Target file path suggestion */
  suggestedPath?: string;
}
