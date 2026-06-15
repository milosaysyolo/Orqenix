// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , Shared UI types

export interface PluginCardData {
  name: string;
  version: string;
  description: string;
  kind: string;
  license: string;
  external_agent_compat: string[];
  verified: boolean;
  publisher: string;
  source: string;
  installed?: boolean;
  active?: boolean;
}

export interface MarketplaceUiCallbacks {
  onInstall?: (name: string) => Promise<void>;
  onUninstall?: (name: string) => Promise<void>;
  onConfigure?: (name: string) => void;
  onCreate?: () => void;
  onImport?: () => void;
  onExport?: (name: string) => void;
  onFork?: (name: string) => void;
  onDelete?: (name: string) => void;
  onSearch?: (query: string, filters: MarketplaceSearchFilters) => Promise<PluginCardData[]>;
}

export interface MarketplaceSearchFilters {
  kinds: string[];
  verifiedOnly: boolean;
  sources: string[];
}
