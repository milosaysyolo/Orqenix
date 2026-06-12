// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Public API surface
//
// Phase 8 Foundation (D8.α.7) , Charter gate G63

export { OrqenixMcpServer } from './server';
export type {
  OrqenixMcpServerOptions,
  McpTransport,
  HandshakeResult,
} from './server';

export { ALL_TOOLS, getToolByName } from './tools';
export type { McpToolDefinition, ToolContext } from './tools';

export { ALL_RESOURCES, getResource } from './resources';
export type { McpResourceDefinition, ResourceContext } from './resources';

export { ALL_PROMPTS, getPrompt } from './prompts';
export type { McpPromptDefinition } from './prompts';

export {
  CapabilityTokenVerifier,
  tokenFingerprint,
  McpCapabilityTokenSchema,
} from './capability-token';
export type { McpCapabilityToken, TokenVerifyResult } from './capability-token';

export { StdioTransport } from './transports/stdio';
export { HttpTransport } from './transports/http';
export { WebSocketTransport } from './transports/websocket';
export type { JsonRpcRequest, JsonRpcResponse } from './transports/stdio';
