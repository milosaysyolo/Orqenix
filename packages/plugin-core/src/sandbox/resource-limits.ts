// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Resource limits
//
// Enforces CPU / memory / wall-time / filesystem / network limits per plugin.
// Per CR v8.0 Section 7.4 + ADR-E-004

import type { SandboxConfig } from '../csf-schema';/** Default resource limits (configurable via Workbench Settings) */
export const DEFAULT_RESOURCE_LIMITS: Required<  Omit<SandboxConfig, 'fsReadPaths' | 'fsWritePaths'>> & {  fsReadPaths: string[];  fsWritePaths: string[];} = {
  cpuLimitPct: 25,
  memoryLimitMb: 512,
  wallTimeLimitSec: 300,
  fsReadPaths: [],
  fsWritePaths: [],
  networkAllowed: false,
};
export interface ResolvedResourceLimits {  cpuLimitPct: number;  memoryLimitMb: number;  wallTimeLimitSec: number;  fsReadPaths: string[];  fsWritePaths: string[];  networkAllowed: boolean;}
/** * Resolves effective resource limits by merging plugin's sandboxOverrides * with operator defaults. Operator defaults act as a CEILING: a plugin cannot * request MORE than the operator allows. */
export function resolveResourceLimits(  pluginOverrides: SandboxConfig | undefined,  operatorDefaults: Partial<ResolvedResourceLimits> = {}): ResolvedResourceLimits {  const base: ResolvedResourceLimits = {    cpuLimitPct: (operatorDefaults.cpuLimitPct ?? DEFAULT_RESOURCE_LIMITS.cpuLimitPct) as number,    memoryLimitMb:      (operatorDefaults.memoryLimitMb ?? DEFAULT_RESOURCE_LIMITS.memoryLimitMb) as number,    wallTimeLimitSec:      (operatorDefaults.wallTimeLimitSec ?? DEFAULT_RESOURCE_LIMITS.wallTimeLimitSec) as number,    fsReadPaths: operatorDefaults.fsReadPaths ?? DEFAULT_RESOURCE_LIMITS.fsReadPaths,    fsWritePaths:      operatorDefaults.fsWritePaths ?? DEFAULT_RESOURCE_LIMITS.fsWritePaths,    networkAllowed:      (operatorDefaults.networkAllowed ?? DEFAULT_RESOURCE_LIMITS.networkAllowed) as boolean,  };  if (!pluginOverrides) {
return base;  }  // Plugin can request LESS than operator allows, but NOT more (ceiling enforcement)
  return {    cpuLimitPct:      pluginOverrides.cpuLimitPct !== undefined        ? Math.min(pluginOverrides.cpuLimitPct, base.cpuLimitPct)        : base.cpuLimitPct,    memoryLimitMb:      pluginOverrides.memoryLimitMb !== undefined        ? Math.min(pluginOverrides.memoryLimitMb, base.memoryLimitMb)        : base.memoryLimitMb,    wallTimeLimitSec:      pluginOverrides.wallTimeLimitSec !== undefined        ? Math.min(pluginOverrides.wallTimeLimitSec, base.wallTimeLimitSec)        : base.wallTimeLimitSec,    // FS paths: plugin's requested paths must be SUBSETS of operator-allowed paths
    fsReadPaths: intersectPaths(pluginOverrides.fsReadPaths ?? [], base.fsReadPaths),
    fsWritePaths: intersectPaths(
      pluginOverrides.fsWritePaths ?? [],
      base.fsWritePaths
    ),
    // Network: only allowed if BOTH plugin requests AND operator permits
    networkAllowed:      (pluginOverrides.networkAllowed ?? false) && base.networkAllowed,  };}
/** * Returns paths from `requested` that are within `allowed` (prefix match). * If `allowed` is empty, returns empty (deny-by-default). */
function intersectPaths(requested: string[], allowed: string[]): string[] {
  if (allowed.length === 0) return [];
  return requested.filter((req) =>
    allowed.some((a) => req === a || req.startsWith(a + '/'))
  );
}
/** * Builds Node.js child_process spawn options from resolved limits. * Uses --max-old-space-size for memory, env vars for path whitelists. */
export function buildSpawnEnv(
  limits: ResolvedResourceLimits,
  grantedPermissions: string[]): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    ORQENIX_SANDBOX: '1',
    ORQENIX_CPU_LIMIT_PCT: String(limits.cpuLimitPct),
    ORQENIX_MEMORY_LIMIT_MB: String(limits.memoryLimitMb),
    ORQENIX_WALL_TIME_LIMIT_SEC: String(limits.wallTimeLimitSec),
    ORQENIX_FS_READ_PATHS: limits.fsReadPaths.join(':'),
    ORQENIX_FS_WRITE_PATHS: limits.fsWritePaths.join(':'),
    ORQENIX_NETWORK_ALLOWED: limits.networkAllowed ? '1' : '0',
    ORQENIX_GRANTED_PERMISSIONS: grantedPermissions.join(','),
  };
}
/** Node memory flag string for spawn args */
export function memoryLimitFlag(limits: ResolvedResourceLimits): string {
  return `--max-old-space-size=${limits.memoryLimitMb}`;
}