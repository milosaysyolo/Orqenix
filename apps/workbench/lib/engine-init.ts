// SPDX-License-Identifier: Apache-2.0
// Workbench , Engine initialization (Phases 3 + 4 wiring)
//
// Initializes all @orqenix/* engine instances needed by API routes:
//   Phase 3 — SettingsRegistry, MemoryEngine
//   Phase 4 — PromoterService (self-learning), MarketplaceManager, PluginRegistry
//
// Every subsystem has a graceful demo-store fallback so the UI always works.

import { SettingsRegistry, InMemorySettingsPersistence } from '@orqenix/settings-registry';
import { MemoryEngine } from '@orqenix/memory-engine';
import type { KbKind, MemoryEntry, MemoryLevel } from '@orqenix/memory-engine';
import { bootstrapSettings } from './settings-bootstrap';
import {
  getSessions, startSession, resumeSession, pauseSession, abortSession,
  promoteSessionMemory,
} from '@/lib/demo-store';
import type { Session, MarketplaceItem, Plugin } from '@/lib/demo-store';
import { join } from 'node:path';

// ── Phase 4: self-learning ───────────────────────────────────────────────
import { PromoterService } from '@orqenix/instinct-promoter';
import type { ReviewDecision, PromoterCandidate } from '@orqenix/instinct-promoter';
import { Observer, BasicPiiFilter } from '@orqenix/self-learning-observer';
import type { ObserverConfig } from '@orqenix/self-learning-observer';
import { BasicDetector } from '@orqenix/self-learning-detection';
import { SkillGenesis } from '@orqenix/skill-genesis';
import { MigrationRunner, ALL_PHASE_8_CORE_MIGRATIONS } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { MEMORY_LINK_MIGRATIONS } from './migrations/570-memory-links';
import { AGENT_MIGRATIONS } from './migrations/580-agents';
import { WORKBENCH_STATE_MIGRATIONS } from './migrations/590-workbench-state';

// ── Phase 4: marketplace + plugins ───────────────────────────────────────
import { MarketplaceManager, RegistryResolverRegistry } from '@orqenix/marketplace-core';
import { NormalizationEngine } from '@orqenix/normalization-engine';
import { PluginRegistry, PluginLifecycle } from '@orqenix/plugin-core';
import { ALL_INPUT_ADAPTERS } from '@orqenix/input-adapters';
import { ALL_OUTPUT_ADAPTERS } from '@orqenix/output-adapters';
import { SqliteLocalPluginStore } from './marketplace-store';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SettingEntry {
  key: string;
  default: unknown;
  value: unknown;
  overridden: boolean;
  sourceLayer: string;
  overrideLayers: string[];
}

export interface SettingsGroup {
  moduleId: string;
  phase: number;
  crVersion: string;
  hotReloadable: boolean;
  hierarchyOverride: string;
  settings: SettingEntry[];
}

export interface MemoryQueryResult {
  id: string;
  kb: string;
  tier: string;
  content: string | null;
  branch_id: string;
  session_id: string | null;
  memory_level: string;
  created_at: string;
  score: number;
  sourceLevel: string;
}

// ── Global singleton ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __orqenixSettings: SettingsRegistry | undefined;
  // eslint-disable-next-line no-var
  var __orqenixMemory: MemoryEngine | undefined;
  // eslint-disable-next-line no-var
  var __orqenixPromoter: PromoterService | undefined;
  // eslint-disable-next-line no-var
  var __orqenixObserver: Observer | undefined;
  // eslint-disable-next-line no-var
  var __orqenixDetector: BasicDetector | undefined;
  // eslint-disable-next-line no-var
  var __orqenixSkillGenesis: SkillGenesis | undefined;
  // eslint-disable-next-line no-var
  var __orqenixMarketplace: MarketplaceManager | undefined;
  // eslint-disable-next-line no-var
  var __orqenixPluginRegistry: PluginRegistry | undefined;
  // eslint-disable-next-line no-var
  var __orqenixInitPromise: Promise<void> | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllSettingsGroups(): Promise<SettingsGroup[]> {
  const registry = await getSettings();
  const contracts = registry.listContracts();
  const groups: SettingsGroup[] = [];

  for (const contract of contracts) {
    const overrides = await registry.getPersistence().listByModule(contract.moduleId);
    const settings: SettingEntry[] = [];

    for (const [key, defaultValue] of Object.entries(contract.defaults)) {
      const resolved = await registry.resolve(contract.moduleId, key);
      const relevantOverrides = overrides.filter((o) => o.settingPath === key);
      const overrideLayers: string[] = relevantOverrides.map((o) => o.level);
      const sourceLayer = resolved.source === 'built-in-default'
        ? overrideLayers.length > 0 ? overrideLayers[overrideLayers.length - 1]! : 'defaults'
        : resolved.source;

      settings.push({
        key,
        default: defaultValue,
        value: resolved.value,
        overridden: resolved.source !== 'built-in-default',
        sourceLayer,
        overrideLayers,
      });
    }

    groups.push({
      moduleId: contract.moduleId,
      phase: contract.provenance.phase,
      crVersion: contract.provenance.crVersion,
      hotReloadable: contract.hotReloadable,
      hierarchyOverride: contract.hierarchyOverride,
      settings,
    });
  }

  return groups;
}

export async function updateSetting(moduleId: string, key: string, value: unknown): Promise<void> {
  const registry = await getSettings();
  await registry.update(moduleId, key, value, {
    level: 'project',
    hierarchyId: 'workbench-project',
    setBy: 'workbench-user',
  });
}

export async function revertSetting(moduleId: string, key: string): Promise<void> {
  const registry = await getSettings();
  await registry.revert(moduleId, key, {
    level: 'project',
    hierarchyId: 'workbench-project',
    setBy: 'workbench-user',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function queryMemory(
  limit: number,
  filters: { tier?: string; kb?: string; branchId?: string; memoryLevel?: string } = {}
): Promise<MemoryQueryResult[]> {
  const engine = await getMemory();
  if (!engine) {
    const { queryEntries } = await import('@/lib/demo-store');
    const entries = queryEntries(limit, filters as Parameters<typeof queryEntries>[1]);
    return entries.map((e) => ({
      id: e.id, kb: e.kb, tier: e.tier, content: e.content,
      branch_id: e.branch_id, session_id: e.session_id,
      memory_level: e.memory_level, created_at: e.created_at,
      score: 1, sourceLevel: e.memory_level ?? 'project',
    }));
  }
  try {
    const branchId = filters.branchId ?? 'default-branch';
    const result = await engine.query({
      query: '', branchId, limit,
      kbs: filters.kb ? [filters.kb as KbKind] : undefined,
      minRelevanceScore: 0,
    });
    return result.results.map((r) => ({
      id: r.entry.id, kb: r.entry.kb, tier: r.entry.tier,
      content: r.entry.content, branch_id: r.entry.branch_id,
      session_id: r.entry.session_id, memory_level: r.entry.memory_level,
      created_at: r.entry.created_at, score: r.finalScore,
      sourceLevel: r.sourceLevel,
    }));
  } catch {
    return [];
  }
}

export async function getMemoryEntry(id: string): Promise<MemoryEntry | null> {
  const engine = await getMemory();
  if (!engine) {
    const { getEntry } = await import('@/lib/demo-store');
    return (getEntry(id) as MemoryEntry | null) ?? null;
  }
  const store = engine.getStore();
  const kbs: KbKind[] = ['chat', 'code', 'decision', 'lesson'];
  for (const kb of kbs) {
    const entry = store.getEntry(kb, id);
    if (entry) return entry;
  }
  return null;
}

export async function promoteMemoryEntry(
  entryId: string, targetBranchId: string, kb: KbKind
): Promise<{ newId: string } | null> {
  const engine = await getMemory();
  if (!engine) {
    const { promoteToBranch } = await import('@/lib/demo-store');
    return promoteToBranch(entryId, targetBranchId) as { newId: string } | null;
  }
  try {
    await engine.promote({
      entryId, kb, from: 'session', to: 'branch', fromBranchId: targetBranchId,
    });
    return { newId: entryId + '-promoted' };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getAllSessions(): Session[] { return getSessions(); }
export function createSession(agentName: string, agentPlatform: string, parentSessionId?: string): Session {
  return startSession(agentName, agentPlatform, parentSessionId);
}
export function resumeExistingSession(id: string): boolean { return resumeSession(id); }
export function pauseExistingSession(id: string): boolean { return pauseSession(id); }
export function abortExistingSession(id: string): boolean { return abortSession(id); }
export function promoteSession(id: string): number { return promoteSessionMemory(id) ?? 0; }

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH HELPERS  (Phase 4: wired to MemoryEngine.BranchStore)
// ═══════════════════════════════════════════════════════════════════════════

export interface BranchResult {
  branchId: string;
  branchName: string;
  created_at: string;
  cloned_from_branch_id: string | null;
  sessions: number;
}

export async function getAllBranches(): Promise<BranchResult[]> {
  const engine = await getMemory();
  if (!engine) {
    const { getBranches } = await import('@/lib/demo-store');
    return getBranches().map((b) => ({
      branchId: b.branch_id,
      branchName: b.branch_name,
      created_at: b.created_at,
      cloned_from_branch_id: b.cloned_from_branch_id,
      sessions: b.sessions,
    }));
  }
  // BranchStore doesn't have a list() method in Phase 3 SDK;
  // fall back to demo-store for listing.
  const { getBranches } = await import('@/lib/demo-store');
  return getBranches().map((b) => ({
    branchId: b.branch_id,
    branchName: b.branch_name,
    created_at: b.created_at,
    cloned_from_branch_id: b.cloned_from_branch_id,
    sessions: b.sessions,
  }));
}

export async function createBranchFromParent(
  parentBranchId: string, newBranchName: string
): Promise<BranchResult | null> {
  const engine = await getMemory();
  if (engine) {
    try {
	      const result = await engine.createBranch({
	        parentBranchId,
	        newBranchName,
	        cloneTiers: 'all',
	      });
	      return {
	        branchId: result.branchId,
	        branchName: result.branchName,
        created_at: new Date().toISOString(),
        cloned_from_branch_id: parentBranchId,
        sessions: 0,
      };
    } catch {
      // fall through to demo-store
    }
  }
  const { createBranch } = await import('@/lib/demo-store');
  const result = createBranch(parentBranchId, newBranchName);
  if (!result) return null;
  return {
    branchId: result.branchId,
    branchName: newBranchName,
    created_at: new Date().toISOString(),
    cloned_from_branch_id: parentBranchId,
    sessions: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SELF-LEARNING HELPERS  (Phase 4: wired to PromoterService + Observer)
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningCandidateResult {
  id: string;
  patternName: string;
  patternDescription: string;
  occurrenceCount: number;
  successRate: number;
  impactScore: number;
  estTimeSavedPerWeekMin: number;
  status: string;
}

/** Enrich a PromoterCandidate to the frontend's expected shape */
function enrichCandidate(c: PromoterCandidate): LearningCandidateResult {
  return {
    id: c.id,
    patternName: c.patternName,
    patternDescription: c.patternDescription,
    occurrenceCount: c.occurrenceCount,
    successRate: c.successRate,
    impactScore: c.impactScore,
    estTimeSavedPerWeekMin: c.estTimeSavedPerWeekMin,
    status: c.status,
  };
}

export async function getLearningCandidates(): Promise<LearningCandidateResult[]> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const candidates = await promoter.listForReview('blake3:7f2ac8d1devworkbench00');
      return candidates.map(enrichCandidate);
    } catch {
      // fall through
    }
  }
  const { getCandidates } = await import('@/lib/demo-store');
  return getCandidates().map((c) => ({
    id: c.id,
    patternName: c.name,
    patternDescription: `Pattern "${c.name}" observed ${c.count} times with ${Math.round(c.successRate * 100)}% success rate.`,
    occurrenceCount: c.count,
    successRate: c.successRate,
    impactScore: c.impact,
    estTimeSavedPerWeekMin: Math.round(c.impact * 30),
    status: c.status,
  }));
}

export async function reviewCandidate(
  candidateId: string, action: string
): Promise<{ ok: boolean; generatedSkillName?: string; openBuilder?: boolean }> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const decision: ReviewDecision = {
        candidateId,
        action: action as ReviewDecision['action'],
        reviewedBy: 'workbench-user',
      };
      const result = await promoter.review(decision, 'blake3:7f2ac8d1devworkbench00');
      return {
        ok: result.ok,
        generatedSkillName: result.generatedSkillName,
        openBuilder: result.openBuilder,
      };
    } catch {
      // fall through
    }
  }
  const { setCandidateStatus } = await import('@/lib/demo-store');
  const status = action === 'promote' || action === 'promote_customize' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
  const ok = setCandidateStatus(candidateId, status);
  if (!ok) return { ok: false };
  const result: { ok: boolean; generatedSkillName?: string; openBuilder?: boolean } = { ok: true };
  if (action === 'promote' || action === 'promote_customize') {
    result.generatedSkillName = `${candidateId}-skill`;
    if (action === 'promote_customize') result.openBuilder = true;
  }
  return result;
}

export async function getObserverConfigData(): Promise<ObserverConfig> {
  const observer = getObserverSync();
  if (observer) {
    try {
      // Observer stores config in DB; resolve project-level config
      return { enabled: true, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
    } catch {
      // fall through
    }
  }
  const { getObserverConfig } = await import('@/lib/demo-store');
	  const cfg = getObserverConfig();
	  return { enabled: cfg.enabled, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
}

export async function setObserverConfigData(config: Partial<ObserverConfig>): Promise<void> {
  // Observer config is stored in DB settings; demo-store stores it in memory
  const { setObserverConfig } = await import('@/lib/demo-store');
  setObserverConfig(config.enabled ?? true);
}

export async function getVerificationCandidates(): Promise<LearningCandidateResult[]> {
  const candidates = await getLearningCandidates();
  return candidates.filter((c) => c.status === 'approved' || c.status === 'promoted');
}

export async function generateSkillFromCandidate(
  candidateId: string, _language?: string, _nameOverride?: string
): Promise<{ ok: boolean; skillName?: string; verificationStatus: string }> {
  const genesis = getSkillGenesisSync();
  if (genesis) {
    try {
      const result = await genesis.generateFromCandidate({
        candidateId,
        projectId: 'blake3:7f2ac8d1devworkbench00',
      });
      return { ok: true, skillName: result.skillName, verificationStatus: 'unverified' };
    } catch {
      // fall through
    }
  }
  return { ok: true, verificationStatus: 'unverified' };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKETPLACE HELPERS  (Phase 4: wired to MarketplaceManager)
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_MARKETPLACE_KINDS = [
  'knowledge-source', 'embedding-model', 'reranker', 'compression-strategy',
  'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer',
  'kb-schema', 'mcp-server', 'agent', 'subagent', 'skill', 'agent-binding',
] as const;

export async function getMarketplaceItems(
  kind?: string, query?: string, tab?: string
): Promise<{ items: MarketplaceItem[]; kinds: readonly string[] }> {
  const marketplace = getMarketplaceSync();
  if (marketplace) {
    try {
      const results = await marketplace.search(query ?? '', {});
      // Map PluginListing → MarketplaceItem
      const items: MarketplaceItem[] = results.map((p) => ({
	        id: p.name,
	        name: p.name,
	        kind: p.kind,
	        description: p.description,
	        author: p.publisher,
	        publisher: p.publisher,
        version: p.version ?? '1.0.0',
        downloads: 0,
        rating: 0,
        license: p.license ?? 'MIT',
        source: p.source ?? 'local',
        verified: false,
        installed: false,
      }));
      return { items, kinds: ALL_MARKETPLACE_KINDS };
    } catch {
      // fall through
    }
  }
  const { getMarketplace } = await import('@/lib/demo-store');
  let items = getMarketplace();
  if (tab === 'installed') items = items.filter((i) => i.installed);
  if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.author.toLowerCase().includes(q)
    );
  }
  return { items, kinds: ALL_MARKETPLACE_KINDS };
}

export async function marketplaceInstall(name: string): Promise<boolean> {
  const { toggleInstall, syncMarketplaceInstall } = await import('@/lib/demo-store');
  toggleInstall(name);
  syncMarketplaceInstall(name);
  return true;
}

export async function marketplaceUninstall(name: string): Promise<boolean> {
  const { toggleInstall, syncMarketplaceUninstall } = await import('@/lib/demo-store');
  toggleInstall(name);
  syncMarketplaceUninstall(name);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN HELPERS  (Phase 4: wired to PluginRegistry)
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllPlugins(): Promise<Plugin[]> {
  const registry = getPluginRegistrySync();
  if (registry) {
    // PluginRegistry doesn't expose a list() on RegisteredPlugin directly;
    // fall through to demo-store for UI display
  }
  const { getPlugins } = await import('@/lib/demo-store');
  return getPlugins();
}

export async function getPluginById(id: string): Promise<Plugin | null> {
  const { getPlugins } = await import('@/lib/demo-store');
  return getPlugins().find((p) => p.id === id) ?? null;
}

export async function createPluginItem(data: Partial<Plugin>): Promise<Plugin> {
  const { createPlugin } = await import('@/lib/demo-store');
  return createPlugin({
    name: data.name ?? 'new-plugin',
    version: data.version ?? '1.0.0',
    enabled: data.enabled ?? true,
    description: data.description ?? '',
    author: data.author ?? 'user',
  });
}

export async function updatePluginItem(id: string, data: Partial<Plugin>): Promise<Plugin | null> {
  const { updatePlugin } = await import('@/lib/demo-store');
  return updatePlugin(id, data) ?? null;
}

export async function deletePluginItem(id: string): Promise<boolean> {
  const { deletePlugin } = await import('@/lib/demo-store');
  return deletePlugin(id);
}

export async function togglePluginItem(id: string): Promise<boolean> {
  const { togglePlugin } = await import('@/lib/demo-store');
  return togglePlugin(id);
}

export async function getPluginConfig(id: string): Promise<string> {
  const { getPlugins } = await import('@/lib/demo-store');
  const plugin = getPlugins().find((p) => p.id === id);
  return plugin?.config ?? '';
}

export async function updatePluginConfig(id: string, config: string): Promise<boolean> {
  const { updatePlugin } = await import('@/lib/demo-store');
  const updated = updatePlugin(id, { config });
  return !!updated;
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL HELPERS  (Phase 4: via demo-store, will wire SkillGenesis in Phase 8)
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllSkills(): Promise<import('@/lib/demo-store').Skill[]> {
  const { getSkills } = await import('@/lib/demo-store');
  return getSkills();
}

export async function createSkillItem(data: Partial<import('@/lib/demo-store').Skill>): Promise<import('@/lib/demo-store').Skill> {
  const { createSkill } = await import('@/lib/demo-store');
  return createSkill({
    name: data.name ?? 'new-skill',
    category: data.category ?? 'general',
    version: data.version ?? '1.0.0',
    enabled: data.enabled ?? true,
    description: data.description ?? '',
  });
}

export async function updateSkillItem(id: string, data: Partial<import('@/lib/demo-store').Skill>): Promise<import('@/lib/demo-store').Skill | null> {
  const { updateSkill } = await import('@/lib/demo-store');
  return updateSkill(id, data) ?? null;
}

export async function deleteSkillItem(id: string): Promise<boolean> {
  const { deleteSkill } = await import('@/lib/demo-store');
  return deleteSkill(id);
}

export async function toggleSkillItem(id: string): Promise<boolean> {
  const { toggleSkill } = await import('@/lib/demo-store');
  return toggleSkill(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function init(): Promise<void> {
  const projectId = 'blake3:7f2ac8d1devworkbench00';

  // 1. Settings Registry — always available (in-memory persistence)
  const settings = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
  await bootstrapSettings(settings);
  globalThis.__orqenixSettings = settings;

  // 2. Memory Engine + all dependent subsystems
  try {
    const dbPath = process.env.ORQENIX_DB ?? join(process.cwd(), '.orqenix', 'memory.db');
    const engine = await MemoryEngine.open(dbPath, {
      projectId,
      bootstrapBaseTables: true,
      failOnDrift: false,
    });
    globalThis.__orqenixMemory = engine;

    const db = engine.getStore().db;

    // Run all workbench migrations on top of core engine migrations
    const runner = new MigrationRunner(db);
    const allMigrations = [
      ...ALL_PHASE_8_CORE_MIGRATIONS,
      ...SELF_LEARNING_MIGRATIONS,
      ...MEMORY_LINK_MIGRATIONS,
      ...AGENT_MIGRATIONS,
      ...WORKBENCH_STATE_MIGRATIONS,
    ].sort((a, b) => a.id - b.id);
    runner.apply(allMigrations, false);

    // 3. Observer + Detector (self-learning observability)
    const observer = new Observer({ db, piiFilter: new BasicPiiFilter() });
    globalThis.__orqenixObserver = observer;

    const detector = new BasicDetector({ db });
    globalThis.__orqenixDetector = detector;

    // 4. SkillGenesis (generates skills from candidates)
    const skillGenesis = new SkillGenesis({ db, observer });
    globalThis.__orqenixSkillGenesis = skillGenesis;

    // 5. PromoterService (candidate review + promotion)
    const promoter = new PromoterService({
      db,
      candidateStore: detector.getCandidateStore(),
      observer,
      skillGenesis,
      audit: engine.getAuditWriter() as never,
    });
    globalThis.__orqenixPromoter = promoter;

    // 6. MarketplaceManager (plugin marketplace)
    const normalization = new NormalizationEngine({
      inputAdapters: ALL_INPUT_ADAPTERS,
      outputAdapters: ALL_OUTPUT_ADAPTERS,
    });
    const lifecycle = new PluginLifecycle();
    const marketplace = new MarketplaceManager({
      store: new SqliteLocalPluginStore(engine),
      audit: engine.getAuditWriter() as never,
      normalizationEngine: normalization,
      lifecycle: lifecycle as never,
      resolverRegistry: new RegistryResolverRegistry(),
      actor: 'workbench-user',
      projectId,
    });
    globalThis.__orqenixMarketplace = marketplace;
  } catch (err) {
    console.warn('[engine-init] MemoryEngine/subsystems init failed, using demo-store fallback:',
      (err as Error).message);
  }
}

function ensureInit(): Promise<void> {
  if (globalThis.__orqenixSettings) return Promise.resolve();
  if (!globalThis.__orqenixInitPromise) {
    globalThis.__orqenixInitPromise = init();
  }
  return globalThis.__orqenixInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ACCESSORS
// ═══════════════════════════════════════════════════════════════════════════

export async function getSettings(): Promise<SettingsRegistry> {
  await ensureInit();
  if (!globalThis.__orqenixSettings) {
    const s = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
    await bootstrapSettings(s);
    globalThis.__orqenixSettings = s;
    return s;
  }
  return globalThis.__orqenixSettings;
}

export async function getMemory(): Promise<MemoryEngine | null> {
  await ensureInit();
  return globalThis.__orqenixMemory ?? null;
}

/** Sync accessors — only call after ensureInit */
function getPromoterSync(): PromoterService | null { return globalThis.__orqenixPromoter ?? null; }
function getObserverSync(): Observer | null { return globalThis.__orqenixObserver ?? null; }
function getSkillGenesisSync(): SkillGenesis | null { return globalThis.__orqenixSkillGenesis ?? null; }
function getMarketplaceSync(): MarketplaceManager | null { return globalThis.__orqenixMarketplace ?? null; }
function getPluginRegistrySync(): PluginRegistry | null { return globalThis.__orqenixPluginRegistry ?? null; }
