// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryEngine } from '@orqenix/memory-engine';
import { OrqenixMcpServer } from '../src/server';
import { CapabilityTokenVerifier } from '../src/capability-token';

const PROJECT = 'blake3:proj0001';

describe('OrqenixMcpServer', () => {
  let engine: MemoryEngine;
  let server: OrqenixMcpServer;

  beforeEach(async () => {
    engine = await MemoryEngine.open(':memory:', {
      projectId: PROJECT,
      bootstrapBaseTables: true,
    });
    server = new OrqenixMcpServer({
      engine,
      skillRuntime: { invoke: async () => ({ output: 'x', durationMs: 1, outputValid: true }) } as never,
      transport: 'stdio',
      clientId: 'test',
    });
  });

  afterEach(() => engine.close());

  it('handshake returns capabilities (10 tools, 9 resources, 6 prompts)', () => {
    const hs = server.handshake();
    expect(hs.serverName).toBe('orqenix-mcp-server');
    expect(hs.capabilities.tools).toHaveLength(10);
    expect(hs.capabilities.resources).toHaveLength(9);
    expect(hs.capabilities.prompts).toHaveLength(6);
  });

  it('listTools returns 10 tools', () => {
    expect(server.listTools()).toHaveLength(10);
  });

  it('listResources returns 9 resources', () => {
    expect(server.listResources()).toHaveLength(9);
  });

  it('listPrompts returns 6 prompts', () => {
    expect(server.listPrompts()).toHaveLength(6);
  });

  it('callTool record_decision works', async () => {
    const result = (await server.callTool('orqenix_record_decision', {
      title: 'T',
      rationale: 'R',
    })) as { entryId: string };
    expect(result.entryId).toBeTruthy();
  });

  it('callTool unknown throws', async () => {
    await expect(server.callTool('nope', {})).rejects.toThrow(/Unknown tool/);
  });

  it('readResource memory matrix returns matrix', async () => {
    const result = (await server.readResource('orqenix://memory/matrix')) as {
      matrix: Record<string, unknown>;
    };
    expect(result.matrix).toBeDefined();
  });

  it('getPromptText renders decision template with placeholder', () => {
    const text = server.getPromptText('orqenix_decision_template', { topic: 'billing' });
    expect(text).toContain('billing');
  });

  it('local-only mode allows without token', () => {
    const result = server.authenticate({});
    expect(result.ok).toBe(true);
  });

  it('with verifier, rejects malformed token', () => {
    const verifier = new CapabilityTokenVerifier(() => true);
    const authedServer = new OrqenixMcpServer({
      engine,
      skillRuntime: {} as never,
      transport: 'stdio',
      tokenVerifier: verifier,
    });
    const result = authedServer.authenticate({ garbage: true });
    expect(result.ok).toBe(false);
  });

  it('setContext updates session + branch', async () => {
    server.setContext({ sessionId: 'sess1', branchId: 'br1' });
    // record_decision now writes at session level
    const result = (await server.callTool('orqenix_record_decision', {
      title: 'session-scoped',
      rationale: 'R',
    })) as { entryId: string };
    expect(result.entryId).toBeTruthy();
  });
});
