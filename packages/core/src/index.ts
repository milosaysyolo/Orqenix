export * from "./types/index.js";
export * as Scope from "./scope/index.js";
export * as Config from "./config/index.js";
export * as Storage from "./storage/index.js";
export * as Sync from "./sync/index.js";
export * as Plugin from "./plugin/index.js";
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
export const ORQENIX_VERSION = "0.2.0-dev";
