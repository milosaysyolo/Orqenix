// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Public API surface
//
// Phase 8 Foundation (D8.+�.4)
// Charter gate: G62 (Plugin Architecture Foundation) , 22 sub-criteria
// G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
// Foundational re-exports (CSF schema, permissions, audit)
// G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G

export type {
  CanonicalSkillFormat,
  PluginKind,
  MCPToolSpec,
  Implementation,
  ImplementationLanguage,
  SandboxConfig,
  SandboxMode,
  Provenance,
  SkillExample,
  PluginLifecycleHooks,
} from "./csf-schema";
export {
  CanonicalSkillFormatSchema,
  PluginKindSchema,
  MCPToolSpecSchema,
  ImplementationSchema,
  ImplementationLanguageSchema,
  SandboxConfigSchema,
  SandboxModeSchema,
  ProvenanceSchema,
  SkillExampleSchema,
  PluginLifecycleHooksSchema,
  CompatibilitySchema,
  ALL_PLUGIN_KINDS,
  KNOWLEDGE_KINDS,
  AGENT_KINDS,
} from "./csf-schema";
export type { Permission } from "./permissions";
export {
  PermissionSchema,
  STANDARD_PERMISSIONS,
  PermissionChecker,
  PermissionDeniedError,
  validatePermissions,
} from "./permissions";
export type { PluginAuditKind, PluginAuditWriter } from "./audit-kinds";
export { isPluginAuditKind, NoopPluginAuditWriter, InMemoryPluginAuditWriter } from "./audit-kinds";
export type {
  PluginLifecycleState,
  RegisteredPlugin,
  PluginInvocationRequest,
  PluginInvocationResult,
  PluginKindHandler,
  ValidationResult,
  PluginRuntimeHandle,
  RuntimeMetrics,
  PluginDiscoveryResult,
} from "./types";
export {
  PluginError,
  ManifestInvalidError,
  PluginKindUnsupportedError,
  PluginNotFoundError,
  PluginInstallFailedError,
  PluginActivateFailedError,
  PluginCrashedError,
  PluginTimeoutError,
  PluginInvalidInputError,
  PluginInvalidOutputError,
  PluginAlreadyRegisteredError,
  PluginNotRegisteredError,
  PluginConformanceFailedError,
} from "./errors";
export { PluginLoader } from "./plugin-loader";
export { PluginRegistry } from "./plugin-registry";
export { PluginLifecycle } from "./lifecycle";
export { validateManifest, assertValidManifest } from "./manifest-validator";
export { ConformanceSuite } from "./conformance";
export { SandboxManager } from "./sandbox/sandbox-manager";
export { ProcessSandbox } from "./sandbox/process-sandbox";
export type { IpcMessage, IpcRequestMessage, IpcResponseMessage } from "./sandbox/ipc-protocol";
export { PluginKindRegistry, getDefaultKindHandlers } from "./kinds/registry";
