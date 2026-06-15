// SPDX-License-Identifier: Apache-2.0
// @orqenix/output-adapters , Shared helpers

import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { getOriginalFormat } from '@orqenix/normalization-engine';

export const ADAPTER_VERSION = '0.8.0-alpha.1';

/**
 * Returns the preserved original format if this CSF was imported from the same
 * kind we're now exporting to. This enables byte-identical round-trip (INV-15).
 *
 * Returns undefined if the CSF was NOT imported from this kind (cross-format
 * export, which is necessarily lossy).
 */
export function getPreservedForKind<T = unknown>(
  csf: CanonicalSkillFormat,
  kind: string
): T | undefined {
  if (csf.provenance.imported_from?.kind === kind) {
    return getOriginalFormat<T>(csf);
  }
  return undefined;
}

/** Standard lossy fields when CSF has features the target can't represent */
export function detectGenericLossy(csf: CanonicalSkillFormat, supports: {
  outputSchema?: boolean;
  permissions?: boolean;
  externalAgentCompat?: boolean;
  license?: boolean;
}): string[] {
  const lossy: string[] = [];
  if (supports.outputSchema === false && csf.manifest.tool?.outputSchema) {
    lossy.push('outputSchema');
  }
  if (supports.permissions === false && csf.manifest.permissions.length > 0) {
    lossy.push('permissions');
  }
  if (supports.externalAgentCompat === false && csf.manifest.external_agent_compat.length > 0) {
    lossy.push('external_agent_compat');
  }
  if (supports.license === false) {
    lossy.push('license');
  }
  return lossy;
}
