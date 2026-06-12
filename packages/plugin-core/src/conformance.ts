// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Conformance suite
//
// Verifies a plugin conforms to CSF + kind contract. Used by:
//   - orqenix-official registry (gates publication)
//   - Workbench (flags unverified plugins)
//   - CI (validates reference plugins in D8.δ)
//
// Per CR v8.0 Section 7.5.

import type { CanonicalSkillFormat } from './csf-schema';
import { PluginKindRegistry } from './kinds/registry';
import { validateManifest } from './manifest-validator';
import { PluginConformanceFailedError } from './errors';

export interface ConformanceCheck {
  id: string;
  description: string;
  /** Returns null if passed, or a failure message if failed */
  run(csf: CanonicalSkillFormat): string | null;
}

export interface ConformanceReport {
  pluginName: string;
  pluginVersion: string;
  kind: string;
  passed: number;
  failed: number;
  warnings: number;
  checks: Array<{
    id: string;
    description: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
}

/**
 * Runs conformance checks against a plugin's CSF.
 *
 * Generic checks apply to all kinds; the kind registry provides kind-specific
 * validation. For runtime conformance (actual invocation tests), the caller
 * must provide a live plugin handle (D8.α.4 ships static checks; runtime
 * conformance wired with SandboxManager in Part 4).
 */
export class ConformanceSuite {
  private readonly kindRegistry: PluginKindRegistry;
  private readonly checks: ConformanceCheck[];

  constructor(kindRegistry?: PluginKindRegistry) {
    this.kindRegistry = kindRegistry ?? new PluginKindRegistry();
    this.checks = this.buildGenericChecks();
  }

  /** Runs all conformance checks and returns a report */
  run(csf: CanonicalSkillFormat): ConformanceReport {
    const report: ConformanceReport = {
      pluginName: csf.name,
      pluginVersion: csf.version,
      kind: csf.kind,
      passed: 0,
      failed: 0,
      warnings: 0,
      checks: [],
    };

    // 1. Generic checks
    for (const check of this.checks) {
      const failure = check.run(csf);
      if (failure === null) {
        report.passed += 1;
        report.checks.push({
          id: check.id,
          description: check.description,
          status: 'pass',
        });
      } else {
        report.failed += 1;
        report.checks.push({
          id: check.id,
          description: check.description,
          status: 'fail',
          message: failure,
        });
      }
    }

    // 2. Kind-specific validation
    const kindResult = this.kindRegistry.validateManifest(csf);
    if (kindResult.valid) {
      report.passed += 1;
      report.checks.push({
        id: 'kind-validation',
        description: `Kind-specific validation for '${csf.kind}'`,
        status: 'pass',
      });
    } else {
      report.failed += 1;
      report.checks.push({
        id: 'kind-validation',
        description: `Kind-specific validation for '${csf.kind}'`,
        status: 'fail',
        message: kindResult.errors.join('; '),
      });
    }

    // 3. Warnings (advisory, don't fail conformance)
    if (kindResult.warnings) {
      for (const warning of kindResult.warnings) {
        report.warnings += 1;
        report.checks.push({
          id: 'kind-warning',
          description: 'Kind advisory',
          status: 'warn',
          message: warning,
        });
      }
    }

    return report;
  }

  /** Throws if conformance fails (failed > 0) */
  assert(csf: CanonicalSkillFormat): ConformanceReport {
    const report = this.run(csf);
    if (report.failed > 0) {
      const failures = report.checks
        .filter((c) => c.status === 'fail')
        .map((c) => `${c.id}: ${c.message}`);
      throw new PluginConformanceFailedError(csf.name, failures);
    }
    return report;
  }

  /** Generic conformance checks applicable to all 14 kinds */
  private buildGenericChecks(): ConformanceCheck[] {
    return [
      {
        id: 'has-valid-name',
        description: 'Plugin has a valid npm-style name',
        run: (csf) =>
          /^(@[a-z0-9][\w-]*\/)?[a-z0-9][\w-]*$/.test(csf.name)
            ? null
            : `Invalid name: ${csf.name}`,
      },
      {
        id: 'has-semver-version',
        description: 'Plugin version is valid semver',
        run: (csf) =>
          /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(csf.version)
            ? null
            : `Invalid semver: ${csf.version}`,
      },
      {
        id: 'has-license',
        description: 'Plugin declares a license',
        run: (csf) =>
          csf.manifest.license && csf.manifest.license.length > 0
            ? null
            : 'Missing license declaration',
      },
      {
        id: 'has-compatibility',
        description: 'Plugin declares Orqenix compatibility range',
        run: (csf) =>
          csf.manifest.compatibility.orqenix
            ? null
            : 'Missing compatibility.orqenix range',
      },
      {
        id: 'permissions-valid-format',
        description: 'All permissions follow resource.action[:scope] format',
        run: (csf) => {
          const invalid = csf.manifest.permissions.filter(
            (p) => !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*(:[\w/\-.*]+)?$/.test(p)
          );
          return invalid.length > 0
            ? `Invalid permissions: [${invalid.join(', ')}]`
            : null;
        },
      },
      {
        id: 'has-content-hash',
        description: 'Plugin has computed content hash for provenance',
        run: (csf) =>
          csf.provenance.contentHash &&
          /^[0-9a-f]{32,}$/.test(csf.provenance.contentHash) &&
          csf.provenance.contentHash !== '0'.repeat(32)
            ? null
            : 'Missing or placeholder content hash (loader must compute)',
      },
      {
        id: 'verification-status-valid',
        description: 'Verification status is a recognized value',
        run: (csf) =>
          ['unverified', 'replay_tested', 'verified', 'marketplace-ready'].includes(
            csf.provenance.verification_status
          )
            ? null
            : `Invalid verification_status: ${csf.provenance.verification_status}`,
      },
      {
        id: 'sandbox-mode-not-untrusted-inprocess',
        description: 'Plugin does not use in_process_trusted without justification',
        run: (csf) =>
          csf.manifest.sandboxMode === 'in_process_trusted'
            ? 'Plugin uses in_process_trusted sandbox (discouraged per Anti-pattern 29; requires explicit operator trust)'
            : null,
      },
    ];
  }
}
