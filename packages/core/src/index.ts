export * from "./types/index.js";
export * as Scope from "./scope/index.js";
export * as Config from "./config/index.js";
export * as Storage from "./storage/index.js";
export * as Sync from "./sync/index.js";
export * as Plugin from "./plugin/index.js";
export * as Util from "./util/logger.js";

// Path helpers for CLI use
export {
  userHome,
  orqenixGlobalConfigDir,
  orqenixDataDir,
  opencodeGlobalConfigDir,
  projectOrqenixDir,
  projectOpencodeDir,
} from "./util/paths.js";

export const ORQENIX_VERSION = "0.2.0-dev";
