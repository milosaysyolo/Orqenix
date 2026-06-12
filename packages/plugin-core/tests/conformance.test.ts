// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { ConformanceSuite } from '../src/conformance';
import { PluginConformanceFailedError } from '../src/errors';
import type { CanonicalSkillFormat } from '../src/csf-schema';

function makeCsf(overrides: Partial<CanonicalSkillFormat> = {}): CanonicalSkillFormat {
  return {
    name: '@example/skill',
    version: '1.0.0',
    kind: 'skill',
    manifestVersion: '1.0',
    manifest: {
      tool: {
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
      },
      permissions: ['scope.read'],
      external_agent_compat: ['claude-code'],
      license: 'Apache-2.0',
      keywords: [],
      compatibility: { orqenix: '>=0.8.0' },
      settingsHotReloadable: false,
      settingsHierarchyOverride: 'project',
      sandboxMode: 'separate_process',
    },
    implementation: {
      language: 'typescript',
      entry: './plugin.js',
      examples: [{ name: 'ex1', input: {}, expectedOutput: {} }],
    },
    provenance: {
      verification_status: 'unverified',
      contentHash: 'abc123def4567890',
    },
    ...overrides,
  };
}

describe('ConformanceSuite', () => {
  it('passes a well-formed CSF', () => {
    const suite = new ConformanceSuite();
    const report = suite.run(makeCsf());
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThanOrEqual(8);
  });

  it('fails on placeholder content hash', () => {
    const suite = new ConformanceSuite();
    const report = suite.run(
      makeCsf({
        provenance: {
          verification_status: 'unverified',
          contentHash: '0'.repeat(32),
        },
      })
    );
    expect(report.failed).toBeGreaterThan(0);
    expect(report.checks.some((c) => c.id === 'has-content-hash' && c.status === 'fail')).toBe(true);
  });

  it('fails on missing license', () => {
    const csf = makeCsf();
    csf.manifest.license = '';
    const suite = new ConformanceSuite();
    const report = suite.run(csf);
    expect(report.checks.some((c) => c.id === 'has-license' && c.status === 'fail')).toBe(true);
  });

  it('flags in_process_trusted sandbox mode', () => {
    const csf = makeCsf();
    csf.manifest.sandboxMode = 'in_process_trusted';
    const suite = new ConformanceSuite();
    const report = suite.run(csf);
    expect(
      report.checks.some(
        (c) => c.id === 'sandbox-mode-not-untrusted-inprocess' && c.status === 'fail'
      )
    ).toBe(true);
  });

  it('fails on invalid permission format', () => {
    const csf = makeCsf();
    csf.manifest.permissions = ['NotAValidPermission'];
    const suite = new ConformanceSuite();
    const report = suite.run(csf);
    expect(
      report.checks.some((c) => c.id === 'permissions-valid-format' && c.status === 'fail')
    ).toBe(true);
  });

  it('produces warnings without failing (skill missing outputSchema)', () => {
    const csf = makeCsf();
    delete csf.manifest.tool!.outputSchema;
    const suite = new ConformanceSuite();
    const report = suite.run(csf);
    expect(report.warnings).toBeGreaterThan(0);
  });

  it('assert() throws on conformance failure', () => {
    const csf = makeCsf({
      provenance: { verification_status: 'unverified', contentHash: '0'.repeat(32) },
    });
    const suite = new ConformanceSuite();
    expect(() => suite.assert(csf)).toThrow(PluginConformanceFailedError);
  });

  it('assert() returns report on pass', () => {
    const suite = new ConformanceSuite();
    const report = suite.assert(makeCsf());
    expect(report.failed).toBe(0);
  });
});
