// SPDX-License-Identifier: Apache-2.0

import { eventBus } from '../event-bus';
import { store } from './memory';
import type { MarketplaceItem } from './memory';

// ---- READS -----------------------------------------------------------------

export function getMarketplace() {
  const s = store();
  return s.marketplace.map((m) => ({ ...m, installed: s.installedItems.includes(m.name) }));
}

export function toggleInstall(name: string): boolean {
  const s = store();
  const idx = s.installedItems.indexOf(name);
  if (idx >= 0) {
    s.installedItems.splice(idx, 1);
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'marketplace.uninstall', name } });
  } else {
    s.installedItems.push(name);
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'marketplace.install', name } });
  }
  return true;
}

// ---- Marketplace sync helpers ----------------------------------------------

export function syncMarketplaceInstall(name: string): void {
  const s = store();
  const mkItem = s.marketplace.find((m) => m.name === name);
  if (!mkItem) return;

  if (mkItem.kind === 'skill' && !s.skills.some((sk) => sk.name === name)) {
    s.skills.push({
      id: `sk_auto_${Date.now().toString(36)}`,
      name,
      category: 'marketplace',
      version: mkItem.version,
      enabled: true,
      description: mkItem.description,
    });
    eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'marketplace.skill.installed', name } });
  }

  const PLUGIN_LIKE_KINDS = ['agent-binding', 'embedding-model', 'compression-strategy', 'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer', 'kb-schema', 'mcp-server', 'agent'];
  if (PLUGIN_LIKE_KINDS.includes(mkItem.kind) && !s.plugins.some((p) => p.name === name)) {
    s.plugins.push({
      id: `pl_auto_${Date.now().toString(36)}`,
      name,
      version: mkItem.version,
      enabled: true,
      description: mkItem.description,
      author: mkItem.author,
    });
    eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'marketplace.plugin.installed', name } });
  }
}

export function syncMarketplaceUninstall(name: string): void {
  const s = store();
  s.skills = s.skills.filter((sk) => sk.name !== name);
  s.plugins = s.plugins.filter((p) => p.name !== name);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'marketplace.uninstalled', name } });
}

// ---- MCP Tokens ------------------------------------------------------------

export function issueMCPToken(client: string, scopes: string[]): { id: string; client: string; scopes_json: string; expires_at: string } {
  const tok = {
    id: `tok_${Date.now().toString(36)}`,
    client,
    scopes_json: JSON.stringify(scopes),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  const s = store();
  if (!Array.isArray(s.mcpTokens)) s.mcpTokens = [];
  s.mcpTokens.push(tok);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'mcp.token.issue', client, id: tok.id } });
  return tok;
}

export function revokeMCPToken(id: string): boolean {
  const s = store();
  if (!Array.isArray(s.mcpTokens)) return false;
  const before = s.mcpTokens.length;
  s.mcpTokens = s.mcpTokens.filter((t: any) => t.id !== id);
  if (s.mcpTokens.length !== before) {
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'mcp.token.revoke', id } });
    return true;
  }
  return false;
}

export function getMCPTokens(): Array<{ id: string; client: string; scopes_json: string; expires_at: string }> {
  const s = store();
  return Array.isArray(s.mcpTokens) ? s.mcpTokens : [];
}

// ---- MCP Prompts -----------------------------------------------------------

export function getMCPPrompts(): Array<{ name: string; description: string }> {
  return [
    { name: 'code-review', description: 'Review a pull request for common issues' },
    { name: 'summarize-session', description: 'Summarize a session transcript into memory entries' },
    { name: 'generate-tests', description: 'Generate test cases for a code file' },
  ];
}
