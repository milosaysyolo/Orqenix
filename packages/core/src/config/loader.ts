import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { orqenixGlobalConfigDir, projectOrqenixDir } from "../util/paths.js";
import { log } from "../util/logger.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import type { OrqenixConfig } from "../types/config.js";

/**
 * Load merged config respecting precedence:
 *   defaults < global < custom dir < project < inline env.
 * See CHAPTER 4.1 of the spec.
 *
 * @param projectRoot - Optional project root directory for project-level .orqenix/config.jsonc
 * @returns Merged OrqenixConfig object
 */
export async function loadConfig(projectRoot?: string): Promise<OrqenixConfig> {
  const layers: Array<Partial<OrqenixConfig>> = [DEFAULT_CONFIG];

  // 1. Global
  const globalPath = join(orqenixGlobalConfigDir(), "config.jsonc");
  const globalConfig = await readJsoncIfExists(globalPath);
  if (globalConfig) {
    layers.push(globalConfig);
    log.debug("config: loaded global", { path: globalPath });
  }

  // 2. Custom config dir (ORQENIX_CONFIG_DIR already factored into orqenixGlobalConfigDir;
  //    but we also support an explicit override path)
  const customPath = process.env.ORQENIX_CONFIG_PATH;
  if (customPath) {
    const cfg = await readJsoncIfExists(customPath);
    if (cfg) {
      layers.push(cfg);
      log.debug("config: loaded custom", { path: customPath });
    }
  }

  // 3. Project
  if (projectRoot) {
    const projectPath = join(projectOrqenixDir(projectRoot), "config.jsonc");
    const proj = await readJsoncIfExists(projectPath);
    if (proj) {
      layers.push(proj);
      log.debug("config: loaded project", { path: projectPath });
    }
  }

  // 4. Inline env
  if (process.env.ORQENIX_CONFIG_CONTENT) {
    const inline = safeJsonc(process.env.ORQENIX_CONFIG_CONTENT);
    if (inline) {
      const safe = stripProtoKeys(inline);
      layers.push(safe);
      log.debug("config: loaded inline");
    }
  }

  return deepMerge(layers) as OrqenixConfig;
}

async function readJsoncIfExists(path: string): Promise<Partial<OrqenixConfig> | null> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  const parsed = safeJsonc(raw);
  return parsed ? (stripProtoKeys(parsed) as Partial<OrqenixConfig>) : null;
}

function safeJsonc(raw: string): Partial<OrqenixConfig> | null {
  const errors: any[] = [];
  const parsed = parseJsonc(raw, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    log.warn("config: jsonc parse errors", { errors });
  }
  return (parsed as Partial<OrqenixConfig>) ?? null;
}

/** Recursively strip `__proto__` and `constructor` keys from untrusted input. */
function stripProtoKeys(input: any): any {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(stripProtoKeys);
  const out: Record<string, any> = {};
  for (const k of Object.keys(input)) {
    if (k === "__proto__" || k === "constructor") continue;
    out[k] = stripProtoKeys((input as Record<string, any>)[k]);
  }
  return out;
}

/** Deep-merge layers; later layers override earlier on conflicts; arrays concat'd + dedup'd. */
function deepMerge(layers: Array<Partial<OrqenixConfig>>): OrqenixConfig {
  const out: any = {};
  for (const layer of layers) {
    mergeInto(out, layer);
  }
  return out as OrqenixConfig;
}

function mergeInto(target: any, source: any): void {
  if (!source || typeof source !== "object") return;
  for (const [k, v] of Object.entries(source)) {
    if (k === "__proto__" || k === "constructor") continue;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && Array.isArray(target[k])) {
      target[k] = [...new Set([...target[k], ...v])];
    } else if (
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k]) &&
      target[k] !== null
    ) {
      mergeInto(target[k], v);
    } else {
      target[k] = v;
    }
  }
}
