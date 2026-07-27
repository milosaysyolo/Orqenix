// SPDX-License-Identifier: Apache-2.0
// Barrel re-export for plugin-ecosystem (merged from cost-tracker, knowledge-workflow, lazy-loader, picker, semantic-cache, snapshot)
// Conflicting names (plugin, createPlugin) are prefixed per sub-module.

// ---- cost-tracker exports ----
export { ledger, computeCost, priceFor, plugin as costTrackerPlugin } from "./cost-tracker/index.js";

// ---- knowledge-workflow exports ----
export { createKnowledgeWorkflowPlugin, noopDeps } from "./knowledge-workflow.js";
export type { KnowledgeWorkflowDeps } from "./knowledge-workflow.js";

// ---- lazy-loader exports ----
export {
  LazyContentLoader,
  loader,
  plugin as lazyLoaderPlugin,
  createPlugin as createLazyLoaderPlugin,
} from "./lazy-loader.js";
export type { LazyLoaderConfig, FileHandle } from "./lazy-loader.js";

// ---- picker exports ----
export { pickTopN, plugin as pickerPlugin, createPlugin as createPickerPlugin } from "./picker.js";
export type { PickerConfig, ScoredCandidate } from "./picker.js";

// ---- semantic-cache exports ----
export { cache, plugin as semanticCachePlugin } from "./semantic-cache.js";

// ---- snapshot exports ----
export { createSnapshot, listSnapshots, deleteSnapshot, verifySnapshot, planGc } from "./snapshot/index.js";
export type { SnapshotMeta, State, RetentionPolicy, GcDecision } from "./snapshot/index.js";
