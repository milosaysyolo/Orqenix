// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  ALL_INPUT_ADAPTERS,
  claudeCodeInputAdapter,
  cursorInputAdapter,
  npmInputAdapter,
  mcpInputAdapter,
  userCustomInputAdapter,
} from '../src/index';
import { getOriginalFormat } from '@orqenix/normalization-engine';

describe('Input adapters', () => {
  it('exports exactly 14 adapters', () => {
    expect(ALL_INPUT_ADAPTERS).toHaveLength(14);
  });

  it('all adapters have unique kinds', () => {
    const kinds = ALL_INPUT_ADAPTERS.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(14);
  });

  it('claude-code detects + parses frontmatter skill', async () => {
    const content = `---
skill: git-helper
description: Helps with git
permissions:
  - git.write
---
# Git Helper
Run git commands.`;
    const detection = await claudeCodeInputAdapter.detect({ content });
    expect(detection.matched).toBe(true);

    const csf = await claudeCodeInputAdapter.parse({ content });
    expect(csf.name).toBe('@local/git-helper');
    expect(csf.kind).toBe('skill');
    expect(csf.manifest.permissions).toContain('git.write');
    expect(getOriginalFormat(csf)).toBeDefined();
  });

  it('cursor detects .cursorrules by path', async () => {
    const detection = await cursorInputAdapter.detect({ path: '/proj/.cursorrules' });
    expect(detection.matched).toBe(true);
    expect(detection.confidence).toBeGreaterThan(0.9);
  });

  it('npm detects orqenixPlugin field with high confidence', async () => {
    const content = JSON.stringify({
      name: '@example/skill',
      version: '1.0.0',
      orqenixPlugin: { kind: 'skill', permissions: ['scope.read'], external_agent_compat: ['claude-code'] },
    });
    const detection = await npmInputAdapter.detect({ content });
    expect(detection.confidence).toBe(0.99);

    const csf = await npmInputAdapter.parse({ content });
    expect(csf.name).toBe('@example/skill');
    expect(csf.kind).toBe('skill');
  });

  it('mcp detects mcpServer field', async () => {
    const content = JSON.stringify({
      name: '@example/mcp',
      version: '1.0.0',
      mcpServer: { name: 'example', transport: 'stdio', tools: ['do_thing'] },
    });
    const detection = await mcpInputAdapter.detect({ content });
    expect(detection.matched).toBe(true);

    const csf = await mcpInputAdapter.parse({ content });
    expect(csf.kind).toBe('mcp-server');
  });

  it('user-custom detects __orqenix_custom wrapper', async () => {
    const content = JSON.stringify({
      __orqenix_custom: { name: 'my-tool', kind: 'skill', description: 'custom' },
    });
    const detection = await userCustomInputAdapter.detect({ content });
    expect(detection.matched).toBe(true);

    const csf = await userCustomInputAdapter.parse({ content });
    expect(csf.name).toBe('@local/my-tool');
  });

  it('user-custom rejects content without wrapper', async () => {
    await expect(
      userCustomInputAdapter.parse({ content: JSON.stringify({ random: 'data' }) })
    ).rejects.toThrow(/__orqenix_custom/);
  });

  it('non-matching content yields no detection', async () => {
    const detection = await npmInputAdapter.detect({ content: 'not json at all' });
    expect(detection.matched).toBe(false);
  });

  it('all adapters preserve original format in provenance', async () => {
    const content = JSON.stringify({
      name: '@a/b',
      version: '1.0.0',
      orqenixPlugin: { kind: 'skill', external_agent_compat: [] },
    });
    const csf = await npmInputAdapter.parse({ content });
    expect(csf.provenance.original_format_preserved).toBeDefined();
    expect(csf.provenance.imported_from?.kind).toBe('npm');
  });
});
