// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Manifest validator
//
// Validates a package.json's orqenixPlugin field against CSF schema +
// kind-specific rules. The first gate in the plugin install flow.

import { CanonicalSkillFormatSchema, type CanonicalSkillFormat } from "./csf-schema";
import { PluginKindRegistry } from "./kinds/registry";
import { validatePermissions } from "./permissions";
import type { ValidationResult } from "./types";
import { ManifestInvalidError } from "./errors";

export interface ManifestValidationOutcome extends ValidationResult {
  /** Parsed CSF when valid */
  csf?: CanonicalSkillFormat;
}

/**
 * Extracts the orqenixPlugin field from a package.json object and validates it.
 *
 * @param packageJson Parsed package.json (must have orqenixPlugin + name + version)
 * @param kindRegistry Optional registry override (default: 14 locked kinds)
 */
export function validateManifest(
  packageJson: unknown,
  kindRegistry?: PluginKindRegistry,
): ManifestValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. package.json must be an object
  if (typeof packageJson !== "object" || packageJson === null) {
    return { valid: false, errors: ["package.json is not an object"] };
  }

  const pkg = packageJson as Record<string, unknown>;

  // 2. Must have orqenixPlugin field
  if (!("orqenixPlugin" in pkg) || typeof pkg.orqenixPlugin !== "object") {
    return {
      valid: false,
      errors: ["package.json missing orqenixPlugin field (not an Orqenix plugin)"],
    };
  }

  const op = pkg.orqenixPlugin as Record<string, unknown>;

  // 3. Build CSF candidate from package.json + orqenixPlugin
  const csfCandidate = {
    name: pkg.name,
    version: pkg.version,
    kind: op.kind,
    manifestVersion: op.manifestVersion,
    manifest: {
      tool: op.tool,
      permissions: op.permissions ?? [],
      external_agent_compat: op.external_agent_compat ?? [],
      license: pkg.license ?? op.license,
      homepage: pkg.homepage ?? op.homepage,
      repository:
        typeof pkg.repository === "object"
          ? (pkg.repository as { url?: string }).url
          : pkg.repository,
      bugs: typeof pkg.bugs === "object" ? (pkg.bugs as { url?: string }).url : pkg.bugs,
      keywords: pkg.keywords ?? op.keywords ?? [],
      compatibility: op.compatibility,
      settingsSchema: op.settingsSchema,
      settingsDefaults: op.settingsDefaults,
      settingsHotReloadable: op.settingsHotReloadable ?? false,
      settingsHierarchyOverride: op.settingsHierarchyOverride ?? "project",
      lifecycle: op.lifecycle,
      sandboxMode: op.sandboxMode ?? "separate_process",
      sandboxOverrides: op.sandboxOverrides,
    },
    implementation: {
      language: op.implementationLanguage ?? inferLanguage(pkg),
      entry: op.entry ?? pkg.main ?? "./dist/plugin.js",
      source: op.source,
      dependencies: op.dependencies,
      examples: op.examples,
    },
    provenance: op.provenance ?? {
      verification_status: "unverified",
      contentHash: "0".repeat(32), // placeholder; computed by loader
    },
  };

  // 4. Validate against generic CSF schema
  const schemaResult = CanonicalSkillFormatSchema.safeParse(csfCandidate);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const csf = schemaResult.data;

  // 5. Validate permissions format
  const permResult = validatePermissions(csf.manifest.permissions);
  if (!permResult.valid) {
    errors.push(...permResult.errors);
  }

  // 6. Kind-specific validation
  const registry = kindRegistry ?? new PluginKindRegistry();
  if (!registry.isSupported(csf.kind)) {
    errors.push(
      `Unsupported plugin kind '${csf.kind}'. Must be one of 14 locked kinds (ADR-E-006).`,
    );
    return { valid: false, errors };
  }

  const kindResult = registry.validateManifest(csf);
  errors.push(...kindResult.errors);
  if (kindResult.warnings) {
    warnings.push(...kindResult.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    ...(errors.length === 0 ? { csf } : {}),
  };
}

/**
 * Throws ManifestInvalidError if invalid, returns CSF if valid.
 */
export function assertValidManifest(
  packageJson: unknown,
  kindRegistry?: PluginKindRegistry,
): CanonicalSkillFormat {
  const result = validateManifest(packageJson, kindRegistry);
  if (!result.valid || !result.csf) {
    throw new ManifestInvalidError(
      `Plugin manifest validation failed: ${result.errors.join("; ")}`,
      result.errors,
    );
  }
  return result.csf;
}

/** Infer implementation language from package.json hints */
function inferLanguage(pkg: Record<string, unknown>): string {
  const main = (pkg.main as string) ?? "";
  if (main.endsWith(".wasm")) return "wasm";
  if (main.endsWith(".py")) return "python";
  if (main.endsWith(".sh")) return "shell";
  // Default to typescript (most plugins ship compiled JS but author TS)
  if ("types" in pkg || "typings" in pkg) return "typescript";
  return "javascript";
}
