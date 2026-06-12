// SPDX-License-Identifier: Apache-2.0
// Cross-format export tests: importing from one format and exporting to ANOTHER
// is necessarily lossy. These tests verify the lossy report surfaces correctly.

import { describe, it, expect } from 'vitest';
import { npmInputAdapter } from '@orqenix/input-adapters';
import { cursorOutputAdapter, npmOutputAdapter } from '../../src/index';

describe('Cross-format export (lossy by design)', () => {
  const npmPkg = JSON.stringify({
    name: '@example/rich-skill',
    version: '1.0.0',
    license: 'Apache-2.0',
    main: './plugin.js',
    orqenixPlugin: {
      manifestVersion: '1.0',
      kind: 'skill',
      compatibility: { orqenix: '>=0.8.0' },
      permissions: ['git.write', 'scope.read'],
      external_agent_compat: ['claude-code', 'cursor', 'codex'],
      tool: {
        name: 'rich',
        description: 'Rich skill',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
      },
      sandboxMode: 'separate_process',
    },
  });

  it('npm → cursor export is lossy (cursor cannot represent permissions/schema)', async () => {
    const csf = await npmInputAdapter.parse({ content: npmPkg });
    const report = cursorOutputAdapter.validateExportability(csf);
    expect(report.lossyFields.length).toBeGreaterThan(0);
    expect(report.lossyFields).toContain('permissions');
    expect(report.lossyFields).toContain('outputSchema');
  });

  it('npm → npm export is NOT lossy (same format)', async () => {
    const csf = await npmInputAdapter.parse({ content: npmPkg });
    const report = npmOutputAdapter.validateExportability(csf);
    expect(report.lossyFields).toEqual([]);
  });

  it('cross-format export still produces valid output', async () => {
    const csf = await npmInputAdapter.parse({ content: npmPkg });
    const result = await cursorOutputAdapter.serialize(csf);
    expect(result.content).toBeTruthy();
    expect(result.format).toBe('text');
  });
});
