export type {
  MarketplaceManifest,
  PluginEntry,
  InTreePlugin,
  ExternalPlugin,
  GitSubdirPlugin,
  ValidationError,
} from "./schema.js";
export { validateManifest } from "./schema.js";
export { loadManifest, findPlugin, listByCategory, resolveSource } from "./loader.js";
export { isValidSha, proposeBumps } from "./sha-pin.js";
export type { ShaBumpProposal } from "./sha-pin.js";
