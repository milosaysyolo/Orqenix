export * from "./types/index.js";
export * as Scope from "./scope/index.js";
export * as Config from "./config/index.js";
export * as Storage from "./storage/index.js";
export * as Sync from "./sync/index.js";
export * as Plugin from "./plugin/index.js";
export * from "./plugin/index.js";
export * as Util from "./util/logger.js";

// Direct re-exports for plugin/parent usage
export { detectGitInfo } from "./scope/git-info.js";
export { detectSession } from "./scope/session-detect.js";
export { generateScopeId } from "./scope/id-generator.js";
export { log } from "./util/logger.js";

// Path helpers for CLI use
export {
  userHome,
  orqenixGlobalConfigDir,
  orqenixDataDir,
  opencodeGlobalConfigDir,
  projectOrqenixDir,
  projectOpencodeDir,
} from "./util/paths.js";

export { hashString, hashFile } from "./util/hash.js";

// Phase 5 foundation utilities
export * from "./blake3.js";
export * from "./canonical-json.js";
export * from "./result.js";
export * from "./errors.js";
export * from "./branded-types.js";

export const ORQENIX_VERSION = "0.2.0-dev";
export const ORQENIX_CORE_VERSION = "0.5.0-phase-5" as const;
export const ORQENIX_PHASE = "phase-5" as const;
