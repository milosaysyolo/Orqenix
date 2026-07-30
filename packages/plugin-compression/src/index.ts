// SPDX-License-Identifier: Apache-2.0
// Barrel re-export for plugin-compression (merged from compress-context, compress-input, compress-output)
// Conflicting names (plugin, createPlugin) are prefixed per sub-module.

// ---- compress-context exports ----
export { ConfigSchema, createV2Plugin, PLUGIN_COMPRESS_CONTEXT_VERSION } from "./context/index.js";
export type {
  V1Message,
  V1Input,
  V1Output,
  V2Input,
  V2Output,
  CreateV2PluginOptions,
} from "./context/index.js";
// preserve default-import compatibility with original compress-context API
export { default as default } from "./context/index.js";

// ---- compress-input exports ----
export {
  removeWhitespaceNoise,
  deduplicateMessages,
  injectConcision,
  plugin as compressInputPlugin,
  createPlugin as createCompressInputPlugin,
} from "./compress-input.js";
export type { CompressInputMode, CompressInputConfig } from "./compress-input.js";

// ---- compress-output exports ----
export {
  estimateTokens,
  detectOutputType,
  compressFileList,
  compressLogs,
  compressJson,
  compressSearchResults,
  compressOutput,
  plugin as compressOutputPlugin,
  createPlugin as createCompressOutputPlugin,
} from "./compress-output.js";
export type { CompressOutputConfig, OutputType } from "./compress-output.js";
