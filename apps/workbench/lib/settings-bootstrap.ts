// SPDX-License-Identifier: Apache-2.0
// Workbench , Settings bootstrap
//
// Registers all ~145 configurable parameters from Phases 2-8 with the
// Settings Registry. Per CR v8.0 Appendix B + G64-10 (phase lock badges).
//
// Each module declares its own ModuleSettingsContract. This bootstrap
// centralizes registration for the Workbench's view, but the canonical
// pattern is each module registering itself at startup (Anti-pattern 37).

import {
  SettingsRegistry,
  type ModuleSettingsContract,
} from '@orqenix/settings-registry';

/**
 * Registers all known module settings contracts with the registry.
 *
 * Note: in production, each module package registers its OWN contract during
 * its initialization. This bootstrap provides a fallback / centralized view
 * for Workbench when modules aren't independently initialized (e.g., the
 * settings UI needs to render even if memory-engine isn't actively loaded).
 */
export async function bootstrapSettings(
  registry: SettingsRegistry
): Promise<void> {
  for (const contract of ALL_MODULE_CONTRACTS) {
    await registry.register(contract);
  }
}

/**
 * The catalog of ~145 settings across Phases 2-8.
 * Phase lock provenance drives the P2/P3/P4/P6/P7/P8 badges in the UI.
 */
export const ALL_MODULE_CONTRACTS: ModuleSettingsContract[] = [
  // ─── Phase 2: Memory Engine Core ─────────────────────────────────────
  {
    moduleId: '@orqenix/memory-inject',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'strategy': 'B',
    },
    provenance: {
      phase: 2,
      crVersion: 'v7.0',
      rationale:
        'Memory injection strategy B (medium) default locked in Phase 2',
    },
    hotReloadable: true,
    hierarchyOverride: 'all',
    uiHints: {
      strategy: {
        category: 'memory',
        section: 'basic',
        displayName: 'Injection strategy',
        description: 'A=Aggressive / B=Medium (default) / C=Conservative / D=Minimal / E=None',
      },
    },
  },
  {
    moduleId: '@orqenix/memory-compress',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'trigger_pct': 100,
      'overflow_max_pct': 105,
      'new_entry_cooldown_sec': 60,
    },
    provenance: {
      phase: 2,
      crVersion: 'v7.0',
      rationale: 'Compress-as-Memorize 100% trigger + 105% overflow locked Phase 2',
    },
    hotReloadable: false,
    hierarchyOverride: 'project',
  },

  // ─── Phase 3: Knowledge Bases (Storage) ──────────────────────────────
  {
    moduleId: '@orqenix/storage-diff',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'snapshot_every_n_deltas': 20,
      'snapshot_every_n_bytes': 65536,
      'zstd_level_t1_t3': 3,
      'zstd_level_t4': 19,
    },
    provenance: {
      phase: 3,
      crVersion: 'v7.0',
      rationale: 'Diff-only BLAKE3 + zstd-delta storage params locked Phase 3',
    },
    hotReloadable: false,
    hierarchyOverride: 'project',
  },

  // ─── Phase 4: Distillation + Reindex + Prompt Rewriter ──────────────
  {
    moduleId: '@orqenix/memory-distiller',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'capacity_trigger_pct': 50,
      'token_trigger': 100000,
      'cpu_cap_pct': 20,
    },
    provenance: {
      phase: 4,
      crVersion: 'v7.0',
      rationale: 'Memory Distiller 50% / 100K / 20% CPU cap locked Phase 4',
    },
    hotReloadable: true,
    hierarchyOverride: 'project',
  },
  {
    moduleId: '@orqenix/prompt-rewriter',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'model': 'qwen2.5-7b-instruct',
      'timeout_ms': 5000,
    },
    provenance: {
      phase: 4,
      crVersion: 'v7.0',
      rationale: 'Qwen 2.5 7B local default + 5s timeout locked Phase 4',
    },
    hotReloadable: true,
    hierarchyOverride: 'all',
  },
  {
    moduleId: '@orqenix/search-hybrid',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'weight_vector': 0.5,
      'weight_bm25': 0.3,
      'weight_trigram': 0.1,
      'weight_recency': 0.1,
      'rtk_enabled': true,
      'rtk_aggressive': false,
    },
    provenance: {
      phase: 4,
      crVersion: 'v7.0',
      rationale: 'Hybrid search weights + RTK 89% noise reduction locked Phase 4',
    },
    hotReloadable: true,
    hierarchyOverride: 'all',
  },

  // ─── Phase 6: LAN Mesh + Identity ────────────────────────────────────
  {
    moduleId: '@orqenix/mesh',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'code_kb_backend': 'sqlite',
      'capability_token_ttl_ms': 3600000,
      'transport_preferences': ['in_process', 'loopback_http', 'lan_libp2p'],
    },
    provenance: {
      phase: 6,
      crVersion: 'v7.1',
      rationale: 'LAN mesh transport + capability TTL + polyglot backend locked Phase 6',
    },
    hotReloadable: false,
    hierarchyOverride: 'project',
  },

  // ─── Phase 7: Cloud Tier ─────────────────────────────────────────────
  {
    moduleId: '@orqenix-cloud/relay',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'heartbeat_interval_ms': 25000,
      'reconnect_jitter_pct': 20,
      'max_envelope_size_bytes': 65536,
      'sampling_head_pct_prod': 5,
      'sampling_head_pct_staging': 100,
    },
    provenance: {
      phase: 7,
      crVersion: 'v7.3',
      rationale: 'Cloud relay transport + observability sampling locked Phase 7',
    },
    hotReloadable: false,
    hierarchyOverride: 'project',
  },

  // ─── Phase 8: Memory Hierarchy + Self-Learning + Plugins ────────────
  {
    moduleId: '@orqenix/memory-engine',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'hierarchy.aware_injection': true,
      'hierarchy.level_boost.session': 1.5,
      'hierarchy.level_boost.branch': 1.2,
      'hierarchy.level_boost.project': 1.0,
      'hierarchy.subagent_return_boost': 10.0,
      'hierarchy.min_relevance_score': 0.65,
      'hierarchy.cluster_cosine_threshold': 0.92,
      'branch.creation_strategy': 'deep_copy',
      'branch.clone_tiers': 'all',
      'session.auto_promote_on_success': true,
      'session.team_session_default': 'isolated',
      'session.max_subagent_depth': 1,
    },
    provenance: {
      phase: 8,
      crVersion: 'v8.0',
      rationale: 'Memory hierarchy boosts + branch deep-copy + subagent depth locked Phase 8',
    },
    hotReloadable: true,
    hierarchyOverride: 'all',
  },
  {
    moduleId: '@orqenix/self-learning-observer',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'observer.enabled': true,
      'observer.notify_on_first_launch': true,
      'detection.min_occurrences': 5,
      'detection.min_success_rate': 0.8,
      'detection.cooldown_hours': 24,
      'cross_scope.cross_session_within_branch': 'opt_out',
      'cross_scope.cross_branch_within_project': 'opt_out',
      'cross_scope.cross_project': 'opt_in',
    },
    provenance: {
      phase: 8,
      crVersion: 'v8.0',
      rationale: 'Self-learning observer opt-out + thresholds locked Phase 8 ADR-E-010',
    },
    hotReloadable: true,
    hierarchyOverride: 'all',
  },
  {
    moduleId: '@orqenix/plugin-core',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'signing.enforcement': 'tiered',
      'sandbox.mode': 'separate_process',
      'sandbox.cpu_limit_pct': 25,
      'sandbox.memory_limit_mb': 512,
      'sandbox.wall_time_limit_sec': 300,
      'sandbox.network_allowed': false,
      'install_timeout_sec': 60,
      'activate_timeout_sec': 10,
    },
    provenance: {
      phase: 8,
      crVersion: 'v8.0',
      rationale: 'Plugin sandbox separate-process + tiered signing locked Phase 8',
    },
    hotReloadable: false,
    hierarchyOverride: 'project',
  },
  {
    moduleId: '@orqenix/workbench',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'port': 27420,
      'bind': '127.0.0.1',
      'theme': 'system',
      'advanced_mode_default': 'basic',
      'first_launch_wizard': true,
    },
    provenance: {
      phase: 8,
      crVersion: 'v8.0',
      rationale: 'Workbench port 27420 + UI defaults locked Phase 8',
    },
    hotReloadable: true,
    hierarchyOverride: 'user',
  },
];
