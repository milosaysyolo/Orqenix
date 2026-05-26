import { homedir } from "node:os";
import { join, normalize } from "node:path";

/** Cross-platform user home with normalized path. */
export function userHome(): string {
  return normalize(homedir());
}

/** ~/.config/orqenix */
export function orqenixGlobalConfigDir(): string {
  if (process.env.ORQENIX_CONFIG_DIR) return normalize(process.env.ORQENIX_CONFIG_DIR);
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "orqenix");
  return join(userHome(), ".config", "orqenix");
}

/** ~/.local/share/orqenix */
export function orqenixDataDir(): string {
  if (process.env.XDG_DATA_HOME) return join(process.env.XDG_DATA_HOME, "orqenix");
  return join(userHome(), ".local", "share", "orqenix");
}

/** ~/.config/opencode */
export function opencodeGlobalConfigDir(): string {
  if (process.env.OPENCODE_CONFIG_DIR) return normalize(process.env.OPENCODE_CONFIG_DIR);
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "opencode");
  return join(userHome(), ".config", "opencode");
}

/** Project-level Orqenix dir. */
export function projectOrqenixDir(projectRoot: string): string {
  return join(projectRoot, ".orqenix");
}

/** Project-level OpenCode dir. */
export function projectOpencodeDir(projectRoot: string): string {
  return join(projectRoot, ".opencode");
}
