// SPDX-License-Identifier: Apache-2.0
// Workbench , Cross-project provider (degrades gracefully if Pro absent)
//
// Cross-project federation is a Pro feature. The OSS Workbench detects whether
// @orqenix-pro/cross-project-federation is installed; if not, the cross-project
// UI shows an upgrade prompt instead of crashing.

export interface CrossProjectCapability {
  available: boolean;
  reason?: string;
}

/**
 * Dynamically probes for the Pro federation package. Returns availability so
 * the UI can render the feature or an upgrade prompt.
 */
export async function probeCrossProjectFederation(): Promise<CrossProjectCapability> {
  try {
    await import(/* webpackIgnore: true */ '@orqenix-pro/cross-project-federation');
    return { available: true };
  } catch {
    return {
      available: false,
      reason:
        "Cross-project federation is an Orqenix Pro feature. Install @orqenix-pro/cross-project-federation.",
    };
  }
}
