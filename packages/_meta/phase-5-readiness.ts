export const PHASE_5_REQUIREMENTS = {
  nodeMinVersion: "20.0.0",
  typescriptVersion: "^5.5.0",
  vitestVersion: "^2.0.0",
  pnpmVersion: "^9.0.0",
  phaseMarker: "phase-5",
  hashAlgorithm: "blake3",
  requiredFields: ["name", "version", "license", "type", "main", "types"] as const,
  allowedLicenses: ["Apache-2.0", "BSL-1.1"] as const,
  requiredScripts: ["build", "test", "typecheck", "clean"] as const,
  charterGates: Array.from({ length: 35 }, (_, i) => `G${i + 1}`),
  memoryTiers: ["working", "episodic", "semantic", "global"] as const,
  knowledgeBases: ["docs", "code", "decisions", "chat"] as const,
  compressionStrategies: [
    "rtk-refilter",
    "semantic-summary",
    "reference-replace",
    "emergency-purge",
  ] as const,
  injectionStrategies: ["A", "B", "C", "D", "E"] as const,
} as const;

export function isPhase5Version(version: string): boolean {
  return version.includes("phase-5") || version.startsWith("0.5.");
}

export function isAcceptableHashAlgorithm(algorithm: string): boolean {
  return algorithm === "blake3" || algorithm === "sha256";
}

export interface Phase5CompatReport {
  compatible: boolean;
  warnings: string[];
  errors: string[];
  migrationsNeeded: string[];
}

export function checkPhase5Compatibility(manifest: Record<string, unknown>): Phase5CompatReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const migrationsNeeded: string[] = [];

  for (const field of PHASE_5_REQUIREMENTS.requiredFields) {
    if (!manifest[field]) errors.push(`Missing required field: ${field}`);
  }

  const license = manifest.license as string;
  if (license && !PHASE_5_REQUIREMENTS.allowedLicenses.includes(license as any)) {
    errors.push(
      `Invalid license: ${license}. Allowed: ${PHASE_5_REQUIREMENTS.allowedLicenses.join(", ")}`,
    );
  }

  const version = manifest.version as string;
  if (version && !isPhase5Version(version)) {
    warnings.push(`Version may not be Phase 5 compatible: ${version}`);
    migrationsNeeded.push("update-version-to-phase-5");
  }

  const engines = manifest.engines as Record<string, string> | undefined;
  if (!engines?.node) warnings.push("Missing engines.node specification");

  return { compatible: errors.length === 0, warnings, errors, migrationsNeeded };
}
