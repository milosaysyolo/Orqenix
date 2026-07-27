// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Server core
//
// The Orqenix MCP Server. Registers 10 tools + 9 resources + 6 prompts and
// serves over stdio/HTTP/WebSocket. Per CR v8.0 Chapter 9

import type { MemoryEngine } from '@orqenix/memory-engine';
import type { SkillRuntime } from '@orqenix/skill-runtime';
import { ALL_TOOLS, getToolByName, resolveRecallPermission, type ToolContext } from './tools';
import { ALL_RESOURCES, getResource } from './resources';
import { ALL_PROMPTS, getPrompt } from './prompts';
import {  CapabilityTokenVerifier,  tokenFingerprint,  type McpCapabilityToken,} from './capability-token';
export type McpTransport = 'stdio' | 'http' | 'websocket';
export interface OrqenixMcpServerOptions {  engine: MemoryEngine;  skillRuntime: SkillRuntime;  transport: McpTransport;  /** HTTP/WS port (default 27420 for http, 27421 for ws) */  port?: number;  /** Capability token verifier (optional; if omitted, no auth) */  tokenVerifier?: CapabilityTokenVerifier;  /** Client identifier (agent platform name) */  clientId?: string;}
export interface HandshakeResult {  serverName: string;  serverVersion: string;  protocolVersion: string;  capabilities: {    tools: string[];    resources: string[];    prompts: string[];  };}
/** * Orqenix MCP Server. Exposes Orqenix capabilities to MCP clients. * * The server is transport-agnostic at the core; transports (stdio/http/ws) * adapt the request/response loop. This class provides the protocol handlers. */
export class OrqenixMcpServer {  private readonly engine: MemoryEngine;
private readonly skillRuntime: SkillRuntime;
readonly transport: McpTransport;
private readonly tokenVerifier: CapabilityTokenVerifier | undefined;
private readonly clientId: string;
private sessionId: string | undefined;
private branchId: string | undefined;
private authenticatedToken: McpCapabilityToken | undefined;  constructor(options: OrqenixMcpServerOptions) {    this.engine = options.engine;    this.skillRuntime = options.skillRuntime;    this.transport = options.transport;    this.tokenVerifier = options.tokenVerifier;    this.clientId = options.clientId ?? 'unknown';  }
/** MCP handshake: returns server capabilities */  handshake(): HandshakeResult {    return {      serverName: 'orqenix-mcp-server',      serverVersion: '0.8.0-alpha.1',      protocolVersion: '1.0',      capabilities: {        tools: ALL_TOOLS.map((t) => t.name),        resources: ALL_RESOURCES.map((r) => r.uriPattern),        prompts: ALL_PROMPTS.map((p) => p.name),      },    };  }
/** Authenticate a client connection with a capability token */  authenticate(rawToken: unknown): { ok: boolean; reason?: string } {    if (!this.tokenVerifier) {      // No auth configured (local-only mode)
return { ok: true };    }    const result = this.tokenVerifier.verify(rawToken);    if (!result.valid) {      return { ok: false, ...(result.reason ? { reason: result.reason } : {}) };    }    this.authenticatedToken = result.token;    return { ok: true };  }
/** Lists available tools (MCP tools/list) */  listTools(): Array<{ name: string; description: string; inputSchema: unknown }> {    return ALL_TOOLS.map((t) => ({      name: t.name,      description: t.description,      inputSchema: t.inputSchema,    }));  }
/** Invokes a tool (MCP tools/call) */
async callTool(name: string, args: unknown): Promise<unknown> {    const tool = getToolByName(name);    if (!tool) {      throw new Error(`Unknown tool: ${name}`);    }    // Permission check if authenticated
if (this.tokenVerifier && this.authenticatedToken) {      const requiredPerm = this.toolPermission(name, args);      if (        requiredPerm &&        !this.tokenVerifier.hasPermission(this.authenticatedToken, requiredPerm)      ) {        throw new Error(          `Permission denied: tool '${name}' requires '${requiredPerm}'`        );      }    }    const ctx: ToolContext = {      engine: this.engine,      skillRuntime: this.skillRuntime,      ...(this.sessionId ? { sessionId: this.sessionId } : {}),      ...(this.branchId ? { branchId: this.branchId } : {}),      clientId: this.clientId,    };    return tool.handler(args, ctx);  }
/** Lists resources (MCP resources/list) */  listResources(): Array<{ uri: string; description: string }> {    return ALL_RESOURCES.map((r) => ({      uri: r.uriPattern,      description: r.description,    }));  }
/** Reads a resource (MCP resources/read) */
async readResource(uri: string): Promise<unknown> {    const resource = getResource(uri);    if (!resource) {      throw new Error(`Unknown resource: ${uri}`);    }    return resource.read(uri, { engine: this.engine });  }
/** Lists prompts (MCP prompts/list) */  listPrompts(): Array<{ name: string; description: string }> {    return ALL_PROMPTS.map((p) => ({ name: p.name, description: p.description }));  }
/** Gets a prompt (MCP prompts/get) */  getPromptText(name: string, args?: Record<string, unknown>): string {    const prompt = getPrompt(name);    if (!prompt) {      throw new Error(`Unknown prompt: ${name}`);    }    return prompt.render(args ?? {});  }
/** Sets the session context for this connection */  setContext(input: { sessionId?: string; branchId?: string }): void {    if (input.sessionId !== undefined) this.sessionId = input.sessionId;    if (input.branchId !== undefined) this.branchId = input.branchId;  }
/** Returns the authenticated token fingerprint (for diagnostics) */  getClientFingerprint(): string | null {    return this.authenticatedToken      ? tokenFingerprint(this.authenticatedToken)      : null;  }
  /** Maps a tool name to its required permission */  private toolPermission(name: string, args?: unknown): string | null {    const map: Record<string, string> = {      orqenix_record_decision: 'memory.write:decision',      orqenix_record_lesson: 'memory.write:lesson',      orqenix_query_codekb: 'memory.read:code',      orqenix_invoke_skill: 'skill.invoke',      orqenix_link_scope: 'scope.write',      orqenix_verify_audit_chain: 'audit.read',      orqenix_promote_to_branch: 'memory.write:decision',      orqenix_report_session_start: 'scope.read',      orqenix_report_session_resume: 'scope.read',    };    if (name === 'orqenix_recall_memory') {      const kbs = (args as { kbs?: string[] } | undefined)?.kbs;      return resolveRecallPermission(kbs);    }    return map[name] ?? null;  }}