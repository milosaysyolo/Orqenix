// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Canonical Skill Format (CSF) schema
//
// CSF is the intermediate representation for all 14 plugin kinds.
// Defined in CR v8.0 Chapter 8 + ADR-E-015.
//
// All imports/exports flow through CSF; round-trip fidelity is required.

import { z } from 'zod';
import { PermissionSchema } from './permissions';

// ─────────────────────────────────────────────────────────────────────────
// Plugin kinds (14 total, per ADR-E-006)
// ─────────────────────────────────────────────────────────────────────────

export const PluginKindSchema = z.enum([
  // Knowledge Ecosystem (9)
  'knowledge-source',
  'embedding-model',
  'reranker',
  'compression-strategy',
  'memory-injection-strategy',
  'prompt-rewriter',
  'visualization',
  'code-analyzer',
  'kb-schema',
  // Agent Ecosystem (5)
  'mcp-server',
  'agent',
  'subagent',
  'skill',
  'agent-binding',
]);

export type PluginKind = z.infer<typeof PluginKindSchema>;

/** All 14 plugin kinds (for iteration) */
export const ALL_PLUGIN_KINDS: readonly PluginKind[] = [
  'knowledge-source',
  'embedding-model',
  'reranker',
  'compression-strategy',
  'memory-injection-strategy',
  'prompt-rewriter',
  'visualization',
  'code-analyzer',
  'kb-schema',
  'mcp-server',
  'agent',
  'subagent',
  'skill',
  'agent-binding',
];

export const KNOWLEDGE_KINDS: readonly PluginKind[] = [
  'knowledge-source',
  'embedding-model',
  'reranker',
  'compression-strategy',
  'memory-injection-strategy',
  'prompt-rewriter',
  'visualization',
  'code-analyzer',
  'kb-schema',
];

export const AGENT_KINDS: readonly PluginKind[] = [
  'mcp-server',
  'agent',
  'subagent',
  'skill',
  'agent-binding',
];

// ─────────────────────────────────────────────────────────────────────────
// MCP Tool specification
// ─────────────────────────────────────────────────────────────────────────

export const MCPToolSpecSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case'),
  description: z.string().min(1).max(1000),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
});

export type MCPToolSpec = z.infer<typeof MCPToolSpecSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Skill example (for conformance testing + documentation)
// ─────────────────────────────────────────────────────────────────────────

export const SkillExampleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  input: z.unknown(),
  expectedOutput: z.unknown(),
  notes: z.string().optional(),
});

export type SkillExample = z.infer<typeof SkillExampleSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Compatibility declaration
// ─────────────────────────────────────────────────────────────────────────

export const CompatibilitySchema = z.object({
  /** Semver range for Orqenix compatibility */
  orqenix: z.string().regex(/^[\^~]?\d+\.\d+\.\d+/, 'Must be a semver range'),
  /** Optional MCP protocol version range */
  mcp: z.string().optional(),
  /** Optional Node.js version range */
  node: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// Sandbox configuration overrides
// ─────────────────────────────────────────────────────────────────────────

export const SandboxConfigSchema = z.object({
  cpuLimitPct: z.number().int().min(1).max(100).optional(),
  memoryLimitMb: z.number().int().min(64).max(8192).optional(),
  wallTimeLimitSec: z.number().int().min(1).max(3600).optional(),
  fsReadPaths: z.array(z.string()).optional(),
  fsWritePaths: z.array(z.string()).optional(),
  networkAllowed: z.boolean().optional(),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

export const SandboxModeSchema = z.enum([
  'separate_process',
  'wasm',
  'in_process_trusted', // discouraged per Anti-pattern 29
]);

export type SandboxMode = z.infer<typeof SandboxModeSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Provenance (critical for trust + audit)
// ─────────────────────────────────────────────────────────────────────────

export const ProvenanceSchema = z.object({
  /** Where this plugin was imported from (for normalized plugins) */
  imported_from: z
    .object({
      kind: z.string(),
      original_url: z.string().optional(),
      original_path: z.string().optional(),
      normalized_at: z.string().datetime(),
      normalizer_version: z.string(),
    })
    .optional(),

  /** Original format payload preserved for lossless round-trip */
  original_format_preserved: z.unknown().optional(),

  /** Observations this plugin was derived from (for self-learning skills) */
  derived_from_observations: z.array(z.string()).optional(),

  /** Verification lifecycle status */
  verification_status: z.enum([
    'unverified',
    'replay_tested',
    'verified',
    'marketplace-ready',
  ]),

  /** Optional Sigstore signature (D8.2 ships verification) */
  sigstore_signature: z
    .object({
      signature: z.string(),
      certificate: z.string(),
      log_entry: z.string(),
    })
    .optional(),

  /** BLAKE3 of canonicalized CSF (without provenance.sigstore_signature) */
  contentHash: z.string().regex(/^[0-9a-f]{32,}$/),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Plugin lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────

export const PluginLifecycleHooksSchema = z.object({
  install: z.string().optional(),
  configure: z.string().optional(),
  activate: z.string().optional(),
  deactivate: z.string().optional(),
  uninstall: z.string().optional(),
});

export type PluginLifecycleHooks = z.infer<typeof PluginLifecycleHooksSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Implementation declaration
// ─────────────────────────────────────────────────────────────────────────

export const ImplementationLanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'shell',
  'wasm',
  'declarative',
]);

export type ImplementationLanguage = z.infer<typeof ImplementationLanguageSchema>;

export const ImplementationSchema = z.object({
  language: ImplementationLanguageSchema,
  /** Entry point path or function name */
  entry: z.string().min(1),
  /** Inline source code (for declarative plugins) or external reference */
  source: z.union([
    z.string(),
    z.object({ url: z.string().url() }),
  ]).optional(),
  /** Runtime dependencies (npm package names) */
  dependencies: z.array(z.string()).optional(),
  /** Examples (used by conformance suite) */
  examples: z.array(SkillExampleSchema).optional(),
});

export type Implementation = z.infer<typeof ImplementationSchema>;

// ─────────────────────────────────────────────────────────────────────────
// CSF Manifest (the heart of the schema)
// ─────────────────────────────────────────────────────────────────────────

export const CanonicalSkillFormatSchema = z.object({
  /** Plugin name (npm-style: @author/skill-name) */
  name: z
    .string()
    .regex(
      /^(@[a-z0-9][\w-]*\/)?[a-z0-9][\w-]*$/,
      'Name must be npm-package-style'
    ),

  /** Plugin version (semver) */
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.-]+)?$/, 'Must be semver'),

  /** Plugin kind (one of 14 per ADR-E-006) */
  kind: PluginKindSchema,

  /** Manifest schema version (for future evolution) */
  manifestVersion: z.literal('1.0'),

  /** Capability declaration */
  manifest: z.object({
    /** MCP tool spec (for skill/subagent/mcp-server kinds) */
    tool: MCPToolSpecSchema.optional(),

    /** Permissions this plugin requires */
    permissions: z.array(PermissionSchema),

    /** External agent platforms this plugin is compatible with */
    external_agent_compat: z.array(z.string()),

    /** SPDX license identifier */
    license: z.string(),

    /** Optional URLs */
    homepage: z.string().url().optional(),
    repository: z.string().optional(),
    bugs: z.string().optional(),

    /** Keywords for discoverability */
    keywords: z.array(z.string()).default([]),

    /** Compatibility declaration */
    compatibility: CompatibilitySchema,

    /** Optional JSON Schema for settings */
    settingsSchema: z.record(z.unknown()).optional(),

    /** Optional defaults for settings */
    settingsDefaults: z.record(z.unknown()).optional(),

    /** Whether settings can be hot-reloaded */
    settingsHotReloadable: z.boolean().default(false),

    /** Which hierarchy levels can override these settings */
    settingsHierarchyOverride: z
      .enum(['session', 'branch', 'project', 'all', 'none'])
      .default('project'),

    /** Lifecycle hooks */
    lifecycle: PluginLifecycleHooksSchema.optional(),

    /** Sandbox mode (separate_process default per ADR-E-004) */
    sandboxMode: SandboxModeSchema.default('separate_process'),

    /** Sandbox configuration overrides */
    sandboxOverrides: SandboxConfigSchema.optional(),
  }),

  /** Implementation declaration */
  implementation: ImplementationSchema,

  /** Provenance for trust + audit */
  provenance: ProvenanceSchema,
});

export type CanonicalSkillFormat = z.infer<typeof CanonicalSkillFormatSchema>;
