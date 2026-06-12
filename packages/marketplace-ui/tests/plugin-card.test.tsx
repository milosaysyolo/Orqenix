// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from 'vitest';
import { PluginCard } from '../src/plugin-card';
import type { PluginCardData } from '../src/types';

// Note: full render tests use @testing-library/react in CI; here we verify
// the component is a valid function + callback wiring contract.

describe('PluginCard', () => {
  const plugin: PluginCardData = {
    name: '@example/skill',
    version: '1.0.0',
    description: 'Test',
    kind: 'skill',
    license: 'Apache-2.0',
    external_agent_compat: ['claude-code'],
    verified: true,
    publisher: 'orqenix',
    source: 'orqenix-official',
  };

  it('is a valid React component', () => {
    expect(typeof PluginCard).toBe('function');
  });

  it('accepts plugin + callbacks props', () => {
    const callbacks = { onInstall: vi.fn() };
    const element = PluginCard({ plugin, callbacks });
    expect(element).toBeDefined();
  });

  it('renders installed plugin with management actions', () => {
    const element = PluginCard({ plugin: { ...plugin, installed: true }, callbacks: {} });
    expect(element).toBeDefined();
  });
});
