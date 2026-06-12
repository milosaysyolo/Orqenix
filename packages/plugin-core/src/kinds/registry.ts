// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Plugin Kind Registry
//
// Aggregates the 14 plugin kind handlers. The registry itself is pluggable
// (meta-plugin pattern per ADR-E-006): future kinds can register without
// modifying core, though the 14 are locked for Phase 8.

import type { PluginKind } from '../csf-schema';
import { ALL_PLUGIN_KINDS } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';
import type { CanonicalSkillFormat } from '../csf-schema';
import { PluginKindUnsupportedError } from '../errors';

// Knowledge Ecosystem (9)
import { knowledgeSourceHandler } from './knowledge-source';
import { embeddingModelHandler } from './embedding-model';
import { rerankerHandler } from './reranker';
import { compressionStrategyHandler } from './compression-strategy';
import { memoryInjectionStrategyHandler } from './memory-injection-strategy';
import { promptRewriterHandler } from './prompt-rewriter';
import { visualizationHandler } from './visualization';
import { codeAnalyzerHandler } from './code-analyzer';
import { kbSchemaHandler } from './kb-schema';

// Agent Ecosystem (5)
import { mcpServerHandler } from './mcp-server';
import { agentHandler } from './agent';
import { subagentHandler } from './subagent';
import { skillHandler } from './skill';
import { agentBindingHandler } from './agent-binding';

/**
 * Returns the 14 default plugin kind handlers (locked per ADR-E-006).
 */
export function getDefaultKindHandlers(): Map<PluginKind, PluginKindHandler> {
  const handlers = new Map<PluginKind, PluginKindHandler>();

  // Knowledge Ecosystem (9)
  handlers.set('knowledge-source', knowledgeSourceHandler);
  handlers.set('embedding-model', embeddingModelHandler);
  handlers.set('reranker', rerankerHandler);
  handlers.set('compression-strategy', compressionStrategyHandler);
  handlers.set('memory-injection-strategy', memoryInjectionStrategyHandler);
  handlers.set('prompt-rewriter', promptRewriterHandler);
  handlers.set('visualization', visualizationHandler);
  handlers.set('code-analyzer', codeAnalyzerHandler);
  handlers.set('kb-schema', kbSchemaHandler);

  // Agent Ecosystem (5)
  handlers.set('mcp-server', mcpServerHandler);
  handlers.set('agent', agentHandler);
  handlers.set('subagent', subagentHandler);
  handlers.set('skill', skillHandler);
  handlers.set('agent-binding', agentBindingHandler);

  return handlers;
}

/**
 * Registry of plugin kind handlers.
 *
 * Phase 8 locks 14 kinds (ADR-E-006), but the registry supports the
 * meta-plugin pattern for future extension via CR amendment.
 */
export class PluginKindRegistry {
  private handlers: Map<PluginKind, PluginKindHandler>;

  constructor(handlers?: Map<PluginKind, PluginKindHandler>) {
    this.handlers = handlers ?? getDefaultKindHandlers();
  }

  /** Returns the handler for a kind, or throws if unsupported */
  getHandler(kind: string): PluginKindHandler {
    const handler = this.handlers.get(kind as PluginKind);
    if (!handler) {
      throw new PluginKindUnsupportedError(kind);
    }
    return handler;
  }

  /** Returns true if the kind is supported */
  isSupported(kind: string): boolean {
    return this.handlers.has(kind as PluginKind);
  }

  /** Lists all supported kinds */
  listKinds(): PluginKind[] {
    return Array.from(this.handlers.keys());
  }

  /** Returns count of registered handlers (should be 14 for default) */
  count(): number {
    return this.handlers.size;
  }

  /**
   * Validates a manifest against its kind-specific handler.
   * Returns combined result; throws PluginKindUnsupportedError if kind unknown.
   */
  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const handler = this.getHandler(csf.kind);
    return handler.validateManifest(csf);
  }

  /**
   * Registers a new kind handler (meta-plugin pattern).
   * Phase 8: only for testing or CR-amended kinds. Logs a warning if
   * registering a kind not in the locked 14.
   */
  registerHandler(handler: PluginKindHandler): void {
    if (!ALL_PLUGIN_KINDS.includes(handler.kind)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plugin-core] Registering handler for kind '${handler.kind}' not in the locked 14 (ADR-E-006). This requires a CR amendment.`
      );
    }
    this.handlers.set(handler.kind, handler);
  }
}
