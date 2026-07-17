// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// DEMO STORE — barrel re-export from domain-specific modules under lib/demo/.
// All logic lives in lib/demo/{memory,agents,plugins,skills,marketplace,learning,settings,dashboard}.ts
// ============================================================================

// Types (all defined in memory.ts)
export type {
  KbKind,
  Tier,
  MemoryLevel,
  MemoryEntry,
  LibraryItem,
  TeamNode,
  TeamEdge,
  Session,
  LearningCandidate,
  Branch,
  MarketplaceItem,
  Plugin,
  Skill,
  MeshPeer,
  AuditEntry,
  ObservabilityMetric,
  SubagentDef,
  ReindexAfter,
  AgentDefinition,
  SubagentConstraints,
  SubagentHarnessData,
  SandboxPlugin,
  SubagentInvocationRecord,
  MCPDefinition,
  BindingPlatform,
  BindingDefinition,
  GraphNode,
  GraphEdge,
  SyncMode,
  SyncConflict,
  SyncResult,
  MemoryGraphFilters,
} from './demo/memory';

// Memory operations
export {
  store,
  resetStore,
  getMemoryGraph,
  queryEntries,
  getEntry,
  getLibrary,
  getBranches,
  pinEntry,
  unpinEntry,
  linkEntries,
  promoteToBranch,
  createBranch,
} from './demo/memory';

// Agents & sessions
export {
  getTeam,
  getSessions,
  startSession,
  resumeSession,
  pauseSession,
  abortSession,
  promoteSessionMemory,
  getSubagents,
  getSubagentHarnesses,
  getSubagentInvocations,
  getSandboxPlugins,
  getMCPServers,
  getBindings,
  saveTeam,
  getSyncResults,
  runSync,
  setBindingState,
  spawnSubagent,
  setSubagentStatus,
  createSubagent,
  updateSubagent,
  deleteSubagent,
  getAgentConfig,
  setAgentConfig,
} from './demo/agents';

// Plugins
export {
  getPlugins,
  togglePlugin,
  getPluginLifecycleState,
  advancePluginLifecycle,
  createPlugin,
  updatePlugin,
  deletePlugin,
} from './demo/plugins';

// Skills
export {
  getSkills,
  toggleSkill,
  createSkill,
  updateSkill,
  deleteSkill,
} from './demo/skills';

// Marketplace
export {
  getMarketplace,
  toggleInstall,
  syncMarketplaceInstall,
  syncMarketplaceUninstall,
  issueMCPToken,
  revokeMCPToken,
  getMCPTokens,
  getMCPPrompts,
} from './demo/marketplace';

// Learning
export {
  getCandidates,
  setCandidateStatus,
  getObserverConfig,
  setObserverConfig,
} from './demo/learning';

// Settings
export {
  getSettings,
} from './demo/settings';

// Dashboard
export {
  getDashboard,
  getAudit,
  getMeshPeers,
  getObservability,
} from './demo/dashboard';
