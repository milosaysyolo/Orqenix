// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , Public API surface
//
// Phase 8 (D8.β) , Charter gates G65 + G66

export { MarketplaceManager } from "./manager";
export type { MarketplaceManagerOptions } from "./manager";

export { MarketplaceCrud, CrudOperationError } from "./crud";
export type { LocalPluginStore, MarketplaceAuditWriter } from "./crud";

export { RegistryResolverRegistry } from "./registry-resolver";
export type { RegistryResolver } from "./registry-resolver";

export type {
  RegistrySource,
  PluginListing,
  SearchFilters,
  CreatePluginInput,
  UpdatePluginInput,
  ForkPluginInput,
  DeletePluginInput,
  ImportInput,
  ExportInput,
  CrudResult,
  ImportResult,
  ExportResult,
  MarketplaceAuditKind,
} from "./types";

export {
  RegistrySourceSchema,
  CreatePluginInputSchema,
  UpdatePluginInputSchema,
  ForkPluginInputSchema,
  DeletePluginInputSchema,
  ImportInputSchema,
  ExportInputSchema,
} from "./types";
