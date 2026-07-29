/**
 * Shared utilities for pre-publish checks (C01-C24).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "../../..");
const WHITELIST_PATH = resolve(ROOT, ".orqenix/release/publishable-whitelist.yaml");

let _whitelistCache = null;

/**
 * Load the list of publishable package names from the YAML whitelist.
 * Supports - "name", - 'name', - name, and inline #comments.
 * ponytail: use a real YAML parser if format becomes more complex.
 */
export function loadWhitelist() {
  if (_whitelistCache) return _whitelistCache;
  const content = readFileSync(WHITELIST_PATH, "utf-8");
  const pkgs = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Match lines starting with "- " (YAML list item)
    if (!trimmed.startsWith("- ")) continue;
    // Strip leading "- ", then quotes and inline comments
    const name = trimmed
      .slice(2)
      .trim()
      .replace(/^['"]|['"]$/g, "") // remove surrounding quotes
      .replace(/\s*#.*$/, "") // remove inline comments
      .trim();
    if (name) pkgs.push(name);
  }
  _whitelistCache = pkgs;
  return pkgs;
}

// Cache for preloaded packages across checks
let _packageCache = null;

/**
 * Preload all publishable packages into memory cache.
 * Reduces I/O from O(N*C) to O(N) across all checks.
 */
export function preloadPackages() {
  if (_packageCache) return _packageCache;
  const names = loadWhitelist();
  const map = new Map();
  for (const name of names) {
    const subpath = name.replace("@orqenix/", "");
    const dir = resolve(ROOT, "packages", subpath);
    const p = resolve(dir, "package.json");
    if (!existsSync(p)) {
      throw new Error(
        `[CHECK] package.json not found for ${name} (looked at ${relative(ROOT, p)})`,
      );
    }
    const json = JSON.parse(readFileSync(p, "utf-8"));
    map.set(name, { name, dir, path: p, json });
  }
  _packageCache = map;
  return map;
}

/**
 * Load and parse a package's package.json.
 * Uses cache if preloadPackages() was called, otherwise reads disk.
 * Returns { name, dir, path, json }.
 */
export function loadPackage(pkgName) {
  if (_packageCache && _packageCache.has(pkgName)) {
    return _packageCache.get(pkgName);
  }
  const subpath = pkgName.replace("@orqenix/", "");
  const dir = resolve(ROOT, "packages", subpath);
  const p = resolve(dir, "package.json");
  if (!existsSync(p)) {
    throw new Error(
      `[CHECK] package.json not found for ${pkgName} (looked at ${relative(ROOT, p)})`,
    );
  }
  const json = JSON.parse(readFileSync(p, "utf-8"));
  return { name: pkgName, dir, path: p, json };
}

/**
 * Check that a given set of paths exist on disk.  Returns array of missing paths.
 */
export function missingFiles(pkgDir, filePaths) {
  return filePaths.filter((f) => !existsSync(resolve(pkgDir, f)));
}
